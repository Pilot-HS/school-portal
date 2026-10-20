// Reads a photo of an OMR sheet made by omrLayout.ts. Works on plain pixel data,
// so it needs no libraries and runs in the browser.
import { MARKERS, OPTIONS, ROLL_DIGITS, BUBBLE_R, rollBubble, versionBubble, questionBubble } from "./omrLayout";

export type RgbaImage = { data: Uint8ClampedArray | Uint8Array; width: number; height: number };

export type ScanBubble = { x: number; y: number; r: number; marked: boolean; kind: "answer" | "roll" | "version" };

export type ScanResult = {
  ok: boolean;
  error?: string;
  roll: string; // e.g. "012"; "?" where a digit could not be read
  version: string; // "A".."D", "" if none, "*" if more than one
  answers: string[]; // "A".."D", "" blank, "*" more than one
  bubbles: ScanBubble[]; // positions in the ORIGINAL image's pixels (for drawing an overlay)
  warnings: string[];
};

const fail = (error: string): ScanResult => ({ ok: false, error, roll: "", version: "", answers: [], bubbles: [], warnings: [] });

// ---- image helpers -------------------------------------------------------

function toGray(img: RgbaImage, maxSide: number) {
  const factor = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * factor));
  const h = Math.max(1, Math.round(img.height * factor));
  const gray = new Float32Array(w * h);
  const sx = img.width / w;
  const sy = img.height / h;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let sum = 0;
      let count = 0;
      for (let yy = y0; yy < y1; yy++) {
        let idx = (yy * img.width + x0) * 4;
        for (let xx = x0; xx < x1; xx++) {
          sum += 0.299 * img.data[idx] + 0.587 * img.data[idx + 1] + 0.114 * img.data[idx + 2];
          idx += 4;
          count++;
        }
      }
      gray[y * w + x] = sum / count;
    }
  }
  return { gray, w, h, toOriginal: img.width / w };
}

// Dark pixels = clearly darker than their neighbourhood (copes with shadows and uneven light)
function darkMask(gray: Float32Array, w: number, h: number): Uint8Array {
  const stride = w + 1;
  const integral = new Float64Array(stride * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x];
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + row;
    }
  }
  const half = Math.max(8, Math.floor(Math.max(w, h) / 12));
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(h, y + half + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(w, x + half + 1);
      const sum = integral[y1 * stride + x1] - integral[y0 * stride + x1] - integral[y1 * stride + x0] + integral[y0 * stride + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      mask[y * w + x] = gray[y * w + x] < mean * 0.78 ? 1 : 0;
    }
  }
  return mask;
}

type Blob = { area: number; minX: number; maxX: number; minY: number; maxY: number; cx: number; cy: number };

function findBlobs(mask: Uint8Array, w: number, h: number, minArea: number): Blob[] {
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const blobs: Blob[] = [];
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || seen[start]) continue;
    let sp = 0;
    stack[sp++] = start;
    seen[start] = 1;
    let area = 0, sx = 0, sy = 0;
    let minX = w, maxX = 0, minY = h, maxY = 0;
    while (sp > 0) {
      const p = stack[--sp];
      const x = p % w;
      const y = (p - x) / w;
      area++;
      sx += x;
      sy += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x > 0 && mask[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[sp++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[sp++] = p + 1; }
      if (y > 0 && mask[p - w] && !seen[p - w]) { seen[p - w] = 1; stack[sp++] = p - w; }
      if (y < h - 1 && mask[p + w] && !seen[p + w]) { seen[p + w] = 1; stack[sp++] = p + w; }
    }
    if (area >= minArea) blobs.push({ area, minX, maxX, minY, maxY, cx: sx / area, cy: sy / area });
  }
  return blobs;
}

// 8-number perspective transform from 4 point pairs
function solveHomography(src: number[][], dst: number[][]): number[] | null {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let pivot = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[pivot][c])) pivot = r;
    if (Math.abs(A[pivot][c]) < 1e-9) return null;
    [A[c], A[pivot]] = [A[pivot], A[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k];
    }
  }
  return A.map((row, i) => row[8] / row[i]);
}

const project = (H: number[], x: number, y: number): [number, number] => {
  const d = H[6] * x + H[7] * y + 1;
  return [(H[0] * x + H[1] * y + H[2]) / d, (H[3] * x + H[4] * y + H[5]) / d];
};

function median(values: number[]): number {
  const s = values.slice().sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

// ---- main ---------------------------------------------------------------

export function scanOmr(img: RgbaImage, numQuestions: number): ScanResult {
  if (img.width < 300 || img.height < 300) return fail("The photo is too small. Please take a clearer photo.");
  const { gray, w, h, toOriginal } = toGray(img, 1400);
  const side = Math.max(w, h);

  // 1. Find the four corner squares
  const mask = darkMask(gray, w, h);
  const blobs = findBlobs(mask, w, h, Math.max(40, Math.round(side * side * 0.00008)));
  const squares = blobs
    .filter((b) => {
      const bw = b.maxX - b.minX + 1;
      const bh = b.maxY - b.minY + 1;
      const aspect = Math.min(bw, bh) / Math.max(bw, bh);
      const fill = b.area / (bw * bh);
      return bw > side * 0.008 && bh > side * 0.008 && bw < side * 0.14 && bh < side * 0.14 && aspect > 0.6 && fill > 0.55;
    })
    .sort((a, b) => b.area - a.area)
    .slice(0, 4);

  if (squares.length < 4) {
    return fail("Couldn't find the four black corner squares. Photograph the whole sheet, flat, with all four corners in view.");
  }
  if (squares[3].area < squares[0].area * 0.2) {
    return fail("The corner squares look uneven. Retake the photo straight on, in good light.");
  }

  // 2. Put the corners in order (largest square = top-left of the sheet), going clockwise
  const mx = squares.reduce((a, b) => a + b.cx, 0) / 4;
  const my = squares.reduce((a, b) => a + b.cy, 0) / 4;
  const clockwise = squares.slice().sort((a, b) => Math.atan2(a.cy - my, a.cx - mx) - Math.atan2(b.cy - my, b.cx - mx));
  let startIdx = 0;
  const largest = clockwise.reduce((best, b, i) => (b.area > clockwise[best].area ? i : best), 0);
  const others = clockwise.filter((_, i) => i !== largest);
  const othersMean = others.reduce((a, b) => a + b.area, 0) / 3;
  if (clockwise[largest].area > othersMean * 1.45) {
    startIdx = largest;
  } else {
    // sheet probably upright: start from the corner nearest the top-left
    startIdx = clockwise.reduce((best, b, i) => (b.cx + b.cy < clockwise[best].cx + clockwise[best].cy ? i : best), 0);
  }
  const ordered = [0, 1, 2, 3].map((k) => clockwise[(startIdx + k) % 4]); // TL, TR, BR, BL

  const H = solveHomography(
    MARKERS.map((m) => [m.cx, m.cy]),
    ordered.map((b) => [b.cx, b.cy])
  );
  if (!H) return fail("Couldn't line up the sheet. Please retake the photo.");

  const mmToPx = (() => {
    const [ax, ay] = project(H, 100, 150);
    const [bx, by] = project(H, 101, 150);
    return Math.hypot(bx - ax, by - ay);
  })();
  if (!isFinite(mmToPx) || mmToPx < 1.2) return fail("The sheet is too small in the photo. Move closer and retake it.");

  // 3. Measure every bubble
  type Item = { kind: "answer" | "roll" | "version"; q: number; opt: number; x: number; y: number; fill: number };
  const items: Item[] = [];
  const add = (kind: Item["kind"], q: number, opt: number, mmX: number, mmY: number) => {
    const [cx, cy] = project(H, mmX, mmY);
    const inner = diskMean(gray, w, h, cx, cy, Math.max(1.4, 1.15 * mmToPx));
    const ring: number[] = [];
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2;
      const [rx, ry] = project(H, mmX + 2.95 * Math.cos(ang), mmY + 2.95 * Math.sin(ang));
      ring.push(pixel(gray, w, h, rx, ry));
    }
    const bg = Math.max(30, median(ring));
    items.push({ kind, q, opt, x: cx, y: cy, fill: Math.max(0, Math.min(1, (bg - inner) / bg)) });
  };

  for (let q = 0; q < numQuestions; q++)
    for (let o = 0; o < 4; o++) {
      const p = questionBubble(q, o);
      add("answer", q, o, p.x, p.y);
    }
  for (let c = 0; c < ROLL_DIGITS; c++)
    for (let d = 0; d < 10; d++) {
      const p = rollBubble(c, d);
      add("roll", c, d, p.x, p.y);
    }
  for (let i = 0; i < 4; i++) {
    const p = versionBubble(i);
    add("version", 0, i, p.x, p.y);
  }

  // 4. Decide which bubbles are filled
  const baseline = median(items.map((i) => i.fill));
  const threshold = Math.max(0.24, baseline + 0.13);
  const marked = (i: Item) => i.fill >= threshold;

  const answers: string[] = [];
  for (let q = 0; q < numQuestions; q++) {
    const m = items.filter((i) => i.kind === "answer" && i.q === q && marked(i));
    answers.push(m.length === 0 ? "" : m.length === 1 ? OPTIONS[m[0].opt] : "*");
  }
  let roll = "";
  for (let c = 0; c < ROLL_DIGITS; c++) {
    const m = items.filter((i) => i.kind === "roll" && i.q === c && marked(i));
    roll += m.length === 1 ? String(m[0].opt) : "?";
  }
  const vm = items.filter((i) => i.kind === "version" && marked(i));
  const version = vm.length === 0 ? "" : vm.length === 1 ? OPTIONS[vm[0].opt] : "*";

  const warnings: string[] = [];
  const answerBubbles = items.filter((i) => i.kind === "answer");
  const markedShare = answerBubbles.filter(marked).length / Math.max(1, answerBubbles.length);
  if (markedShare > 0.6) warnings.push("Many circles look filled. The photo may be misaligned or too dark. Check the picture carefully.");
  if (baseline > 0.45) warnings.push("The photo is very dark or uneven. Retaking it in better light may help.");

  return {
    ok: true,
    roll,
    version,
    answers,
    bubbles: items.map((i) => ({ x: i.x * toOriginal, y: i.y * toOriginal, r: BUBBLE_R * mmToPx * toOriginal, marked: marked(i), kind: i.kind })),
    warnings,
  };
}

function pixel(gray: Float32Array, w: number, h: number, x: number, y: number): number {
  const xi = Math.max(0, Math.min(w - 1, Math.round(x)));
  const yi = Math.max(0, Math.min(h - 1, Math.round(y)));
  return gray[yi * w + xi];
}

function diskMean(gray: Float32Array, w: number, h: number, cx: number, cy: number, r: number): number {
  let sum = 0;
  let count = 0;
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(h - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) {
        sum += gray[y * w + x];
        count++;
      }
  return count ? sum / count : 255;
}
