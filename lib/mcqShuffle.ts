// Question order for each printed version of a paper.
// Version A is the original order. B, C and D are shuffled the same way every time,
// so the answer key and the OMR checker always agree with what was printed.

export type PaperQuestion = {
  id: string;
  text: string;
  options: [string, string, string, string];
  correct: "A" | "B" | "C" | "D";
};

function hash(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function questionsForVersion(paperId: string, questions: PaperQuestion[], version: string): PaperQuestion[] {
  if (version === "A" || !version) return questions.slice();
  const rand = mulberry32(hash(`${paperId}:${version}`));
  const out = questions.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
