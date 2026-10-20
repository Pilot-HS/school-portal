// Turns pasted text into MCQ questions.
//
//   Q1. What is 2 + 2?
//   A) 3
//   B) 4
//   C) 5
//   D) 6
//   Answer: B

export type ParsedQuestion = {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "A" | "B" | "C" | "D";
};

const QUESTION_START = /^(?:q(?:uestion)?\s*\d*\s*[.:)\-]|\d+\s*[.)])\s*(.*)$/i;
const OPTION = /^\(?([A-D])\s*[.):\-]\s*(.*)$/i;
const ANSWER = /^(?:answer|ans|correct(?:\s+answer)?)\s*[:\-=]?\s*\(?([A-D])\)?\s*$/i;

export function parseMcqText(text: string): { questions: ParsedQuestion[]; problems: string[] } {
  const questions: ParsedQuestion[] = [];
  const problems: string[] = [];

  type Draft = { q: string; opts: Record<string, string>; ans: string; last: string; number: number };
  let cur: Draft | null = null;
  let count = 0;

  const finish = () => {
    if (!cur) return;
    const d = cur;
    cur = null;
    const missing = ["A", "B", "C", "D"].filter((k) => !d.opts[k]);
    if (!d.q.trim()) problems.push(`Question ${d.number}: the question text is empty.`);
    else if (missing.length) problems.push(`Question ${d.number}: option ${missing.join(", ")} is missing.`);
    else if (!d.ans) problems.push(`Question ${d.number}: the answer line is missing (write "Answer: B").`);
    else
      questions.push({
        question_text: d.q.trim(),
        option_a: d.opts.A.trim(),
        option_b: d.opts.B.trim(),
        option_c: d.opts.C.trim(),
        option_d: d.opts.D.trim(),
        correct_option: d.ans as "A" | "B" | "C" | "D",
      });
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const ans = ANSWER.exec(line);
    if (ans && cur) {
      (cur as Draft).ans = ans[1].toUpperCase();
      (cur as Draft).last = "";
      continue;
    }
    const opt = OPTION.exec(line);
    if (opt && cur) {
      const key = opt[1].toUpperCase();
      (cur as Draft).opts[key] = opt[2];
      (cur as Draft).last = key;
      continue;
    }
    const start = QUESTION_START.exec(line);
    if (start && (!cur || (cur as Draft).ans || Object.keys((cur as Draft).opts).length === 4 || (cur as Draft).last === "q" || !(cur as Draft).q)) {
      finish();
      count++;
      cur = { q: start[1], opts: {}, ans: "", last: "q", number: count };
      continue;
    }
    if (start && cur && Object.keys((cur as Draft).opts).length === 0) {
      // another question line before any options: treat as a continuation
      (cur as Draft).q += " " + line;
      continue;
    }
    if (!cur) {
      count++;
      cur = { q: line, opts: {}, ans: "", last: "q", number: count };
      continue;
    }
    // continuation of the previous line
    const c = cur as Draft;
    if (c.last === "q" || !c.last) c.q += " " + line;
    else c.opts[c.last] += " " + line;
  }
  finish();
  return { questions, problems };
}
