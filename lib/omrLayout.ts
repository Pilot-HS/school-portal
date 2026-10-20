// Geometry of the printable OMR answer sheet (all numbers are millimetres on an A4 page).
// The sheet drawing and the photo scanner both use these numbers, so they always agree.

export const PAGE = { w: 210, h: 297 };
export const OPTIONS = ["A", "B", "C", "D"] as const;
export const BUBBLE_R = 2.0;
export const ROLL_DIGITS = 3;
export const ROWS_PER_COL = 25;
export const MAX_QUESTIONS = 100;

// Four solid corner squares. The top-left one is bigger so the scanner can tell which way up the sheet is.
export const MARKERS = [
  { name: "tl", x: 8, y: 8, size: 12 },
  { name: "tr", x: 194, y: 8, size: 8 },
  { name: "br", x: 194, y: 281, size: 8 },
  { name: "bl", x: 8, y: 281, size: 8 },
].map((m) => ({ ...m, cx: m.x + m.size / 2, cy: m.y + m.size / 2 }));

export type Pt = { x: number; y: number };

export const rollBubble = (col: number, digit: number): Pt => ({ x: 24 + col * 8, y: 74 + digit * 5 });
export const versionBubble = (i: number): Pt => ({ x: 70 + i * 8, y: 74 });
export const questionBubble = (q: number, opt: number): Pt => ({
  x: 30 + Math.floor(q / ROWS_PER_COL) * 47 + opt * 7,
  y: 135 + (q % ROWS_PER_COL) * 5.6,
});
export const questionLabelPos = (q: number): Pt => ({
  x: 30 + Math.floor(q / ROWS_PER_COL) * 47 - 5,
  y: 135 + (q % ROWS_PER_COL) * 5.6,
});

const esc = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type SheetOptions = {
  school: string;
  title: string;
  numQuestions: number;
  subtitle?: string;
};

// Returns the whole sheet as an SVG string (text is escaped).
export function omrSheetSvg(o: SheetOptions): string {
  const n = Math.max(1, Math.min(MAX_QUESTIONS, Math.floor(o.numQuestions)));
  const parts: string[] = [];
  const bubble = (p: Pt, label: string) =>
    `<circle cx="${p.x}" cy="${p.y}" r="${BUBBLE_R}" fill="#fff" stroke="#111" stroke-width="0.4"/>` +
    `<text x="${p.x}" y="${p.y + 0.85}" font-size="2.3" text-anchor="middle" fill="#9a9a9a">${label}</text>`;

  parts.push(`<rect x="0" y="0" width="${PAGE.w}" height="${PAGE.h}" fill="#fff"/>`);
  MARKERS.forEach((m) => parts.push(`<rect x="${m.x}" y="${m.y}" width="${m.size}" height="${m.size}" fill="#000"/>`));

  // Header
  parts.push(`<text x="105" y="27" font-size="5.2" font-weight="700" text-anchor="middle">${esc(o.school)}</text>`);
  parts.push(`<text x="105" y="34" font-size="4" text-anchor="middle">${esc(o.title)}${o.subtitle ? " — " + esc(o.subtitle) : ""}</text>`);
  parts.push(`<text x="24" y="45" font-size="3">Name:</text><line x1="36" y1="46" x2="118" y2="46" stroke="#111" stroke-width="0.3"/>`);
  parts.push(`<text x="124" y="45" font-size="3">Class:</text><line x1="135" y1="46" x2="158" y2="46" stroke="#111" stroke-width="0.3"/>`);
  parts.push(`<text x="162" y="45" font-size="3">Date:</text><line x1="171" y1="46" x2="190" y2="46" stroke="#111" stroke-width="0.3"/>`);
  parts.push(`<text x="105" y="55" font-size="2.6" text-anchor="middle" fill="#333">Use a black or blue pen or marker. Fill each circle completely. Do not tick or cross. Keep the sheet flat.</text>`);

  // Roll number
  parts.push(`<text x="24" y="66" font-size="3" font-weight="700">ROLL NO.</text>`);
  parts.push(`<text x="24" y="69.5" font-size="2.2" fill="#555">(e.g. 7 → 0 0 7)</text>`);
  for (let c = 0; c < ROLL_DIGITS; c++) for (let d = 0; d < 10; d++) parts.push(bubble(rollBubble(c, d), String(d)));

  // Version
  parts.push(`<text x="70" y="66" font-size="3" font-weight="700">VERSION</text>`);
  for (let i = 0; i < 4; i++) parts.push(bubble(versionBubble(i), "ABCD"[i]));

  // How to fill (not scanned)
  parts.push(`<text x="110" y="82" font-size="2.8" font-weight="700">HOW TO FILL</text>`);
  parts.push(`<circle cx="114" cy="89" r="${BUBBLE_R}" fill="#111" stroke="#111" stroke-width="0.4"/><text x="119" y="90" font-size="2.6">Correct</text>`);
  parts.push(`<circle cx="114" cy="96" r="${BUBBLE_R}" fill="#fff" stroke="#111" stroke-width="0.4"/><path d="M112.6 96 l1 1.2 l2 -2.6" stroke="#111" stroke-width="0.4" fill="none"/><text x="119" y="97" font-size="2.6">Wrong (tick)</text>`);
  parts.push(`<circle cx="114" cy="103" r="${BUBBLE_R}" fill="#fff" stroke="#111" stroke-width="0.4"/><path d="M112.8 101.8 l2.4 2.4 M115.2 101.8 l-2.4 2.4" stroke="#111" stroke-width="0.4"/><text x="119" y="104" font-size="2.6">Wrong (cross)</text>`);
  parts.push(`<text x="110" y="113" font-size="2.4" fill="#555">Only one circle per question.</text>`);

  // Answers
  parts.push(`<text x="24" y="129" font-size="3" font-weight="700">ANSWERS</text>`);
  parts.push(`<line x1="24" y1="130.2" x2="190" y2="130.2" stroke="#111" stroke-width="0.25"/>`);
  for (let q = 0; q < n; q++) {
    const l = questionLabelPos(q);
    parts.push(`<text x="${l.x}" y="${l.y + 0.9}" font-size="2.7" text-anchor="end">${q + 1}</text>`);
    for (let o2 = 0; o2 < 4; o2++) parts.push(bubble(questionBubble(q, o2), "ABCD"[o2]));
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE.w} ${PAGE.h}" width="100%" ` +
    `style="display:block;max-height:265mm;background:#fff" font-family="Arial, Helvetica, sans-serif">` +
    parts.join("") +
    `</svg>`
  );
}
