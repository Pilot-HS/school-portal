// Reads a spreadsheet (.xlsx or .csv) in the browser, with no extra libraries.
// Returns the rows as text, each tagged with its row number in the file.

export type SheetRow = { rowNumber: number; cells: string[] };

/* ---------------------------------------------------------------- CSV -- */

export function parseCsv(text: string): SheetRow[] {
  const clean = text.replace(/^\uFEFF/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] || "";
  const counts = { ",": 0, ";": 0, "\t": 0 } as Record<string, number>;
  for (const ch of firstLine) if (ch in counts) counts[ch]++;
  const delimiter = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || ",";

  const rows: SheetRow[] = [];
  let cells: string[] = [];
  let cell = "";
  let inQuotes = false;
  let rowNumber = 1;

  const endRow = () => {
    cells.push(cell);
    cell = "";
    rows.push({ rowNumber, cells });
    cells = [];
    rowNumber++;
  };

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      cells.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      endRow();
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || cells.length > 0) endRow();
  return rows.map((r) => ({ rowNumber: r.rowNumber, cells: r.cells.map((c) => c.trim()) }));
}

/* --------------------------------------------------------------- XLSX -- */

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function attr(tag: string, name: string): string {
  const m = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(tag);
  return m ? decodeEntities(m[1]) : "";
}

function collectText(xml: string): string {
  const cleaned = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  let out = "";
  const re = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned))) out += m[1];
  return decodeEntities(out);
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as any]).stream().pipeThrough(new (globalThis as any).DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream as any).arrayBuffer());
}

async function unzip(buffer: ArrayBuffer): Promise<Record<string, () => Promise<string>>> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("This doesn't look like an Excel (.xlsx) file.");

  const entryCount = view.getUint16(eocd + 10, true);
  let pos = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder("utf-8");
  const files: Record<string, () => Promise<string>> = {};

  for (let n = 0; n < entryCount; n++) {
    if (view.getUint32(pos, true) !== 0x02014b50) break;
    const method = view.getUint16(pos + 10, true);
    const compSize = view.getUint32(pos + 20, true);
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const localOffset = view.getUint32(pos + 42, true);
    const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));

    files[name] = async () => {
      const lhNameLen = view.getUint16(localOffset + 26, true);
      const lhExtraLen = view.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + lhNameLen + lhExtraLen;
      const raw = bytes.subarray(start, start + compSize);
      const data = method === 0 ? raw : await inflateRaw(raw);
      return decoder.decode(data);
    };
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function columnIndex(ref: string): number {
  const letters = ref.replace(/[^A-Za-z]/g, "").toUpperCase();
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export async function parseXlsx(buffer: ArrayBuffer): Promise<SheetRow[]> {
  const files = await unzip(buffer);

  // Shared strings
  const shared: string[] = [];
  if (files["xl/sharedStrings.xml"]) {
    const xml = await files["xl/sharedStrings.xml"]();
    const re = /<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml))) shared.push(m[1] ? collectText(m[1]) : "");
  }

  // Find the first worksheet
  let sheetPath = "";
  if (files["xl/workbook.xml"] && files["xl/_rels/workbook.xml.rels"]) {
    const wb = await files["xl/workbook.xml"]();
    const rels = await files["xl/_rels/workbook.xml.rels"]();
    const firstSheetTag = /<sheet\b[^>]*>/.exec(wb)?.[0] || "";
    const rid = attr(firstSheetTag, "r:id");
    const relRe = /<Relationship\b[^>]*>/g;
    let m: RegExpExecArray | null;
    while ((m = relRe.exec(rels))) {
      if (attr(m[0], "Id") === rid) {
        const target = attr(m[0], "Target");
        sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
        break;
      }
    }
  }
  if (!sheetPath || !files[sheetPath]) {
    sheetPath =
      Object.keys(files)
        .filter((f) => /^xl\/worksheets\/[^/]+\.xml$/.test(f))
        .sort()[0] || "";
  }
  if (!sheetPath) throw new Error("No worksheet was found in this file.");

  const sheetXml = await files[sheetPath]();
  const rows: SheetRow[] = [];
  const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
  let rm: RegExpExecArray | null;
  let autoRow = 0;
  while ((rm = rowRe.exec(sheetXml))) {
    autoRow++;
    const rowNumber = parseInt(attr(rm[1], "r"), 10) || autoRow;
    const cells: string[] = [];
    const body = rm[2] || "";
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm: RegExpExecArray | null;
    let nextCol = 0;
    while ((cm = cellRe.exec(body))) {
      const ref = attr(cm[1], "r");
      const col = ref ? columnIndex(ref) : nextCol;
      nextCol = col + 1;
      const type = attr(cm[1], "t");
      const inner = cm[2] || "";
      let value = "";
      if (type === "inlineStr") {
        value = collectText(inner);
      } else {
        const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner);
        const raw = v ? decodeEntities(v[1]) : "";
        if (type === "s") value = shared[parseInt(raw, 10)] ?? "";
        else if (type === "b") value = raw === "1" ? "TRUE" : "FALSE";
        else if (type === "e") value = "";
        else value = raw;
      }
      while (cells.length < col) cells.push("");
      cells[col] = value.trim();
    }
    rows.push({ rowNumber, cells });
  }
  return rows;
}

export async function readSpreadsheet(file: File): Promise<SheetRow[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) return parseXlsx(await file.arrayBuffer());
  if (name.endsWith(".csv") || name.endsWith(".txt")) return parseCsv(await file.text());
  if (name.endsWith(".xls")) {
    throw new Error("Old Excel files (.xls) can't be read. Open it in Excel and use Save As → Excel Workbook (.xlsx) or CSV.");
  }
  throw new Error("Please choose an Excel (.xlsx) or CSV file.");
}

/* ------------------------------------------------- Student import rows -- */

export type StudentImportRecord = {
  row: number;
  full_name: string;
  roll_no: string;
  class_name: string;
  gr_number: string;
  date_of_birth: string;
  house: string;
  academic_year: string;
};

const ALIASES: Record<keyof Omit<StudentImportRecord, "row">, string[]> = {
  full_name: ["fullname", "name", "studentname", "studentsname", "nameofstudent"],
  roll_no: ["rollno", "rollnumber", "roll", "rollnum"],
  class_name: ["class", "classname", "grade", "classsection"],
  gr_number: ["grnumber", "grno", "gr", "grnum", "registrationnumber", "registrationno"],
  date_of_birth: ["dateofbirth", "dob", "birthdate", "birthday"],
  house: ["house"],
  academic_year: ["academicyear", "year", "session"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function toStudentRecords(rows: SheetRow[]): { records: StudentImportRecord[]; missing: string[] } {
  const nonEmpty = rows.filter((r) => r.cells.some((c) => c !== ""));
  if (nonEmpty.length === 0) return { records: [], missing: ["Full Name", "Roll No", "Class"] };

  // Header = first row that contains a recognisable column title
  let headerIndex = 0;
  for (let i = 0; i < Math.min(nonEmpty.length, 10); i++) {
    const keys = nonEmpty[i].cells.map(norm);
    if (keys.some((k) => ALIASES.full_name.includes(k)) && keys.some((k) => ALIASES.roll_no.includes(k))) {
      headerIndex = i;
      break;
    }
  }

  const headerKeys = nonEmpty[headerIndex].cells.map(norm);
  const colOf: Partial<Record<keyof typeof ALIASES, number>> = {};
  (Object.keys(ALIASES) as (keyof typeof ALIASES)[]).forEach((field) => {
    const idx = headerKeys.findIndex((k) => ALIASES[field].includes(k));
    if (idx >= 0) colOf[field] = idx;
  });

  const missing: string[] = [];
  if (colOf.full_name === undefined) missing.push("Full Name");
  if (colOf.roll_no === undefined) missing.push("Roll No");
  if (colOf.class_name === undefined) missing.push("Class");
  if (missing.length > 0) return { records: [], missing };

  const get = (cells: string[], field: keyof typeof ALIASES) => {
    const idx = colOf[field];
    return idx === undefined ? "" : (cells[idx] || "").trim();
  };

  const records: StudentImportRecord[] = nonEmpty.slice(headerIndex + 1).map((r) => ({
    row: r.rowNumber,
    full_name: get(r.cells, "full_name"),
    roll_no: get(r.cells, "roll_no"),
    class_name: get(r.cells, "class_name"),
    gr_number: get(r.cells, "gr_number"),
    date_of_birth: get(r.cells, "date_of_birth"),
    house: get(r.cells, "house"),
    academic_year: get(r.cells, "academic_year"),
  }));
  return { records, missing: [] };
}
