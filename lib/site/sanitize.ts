// Keeps text and pictures, removes anything that could run code.
// Used whenever HTML typed or pasted by an editor is shown on the website.

const SAFE_FRAME = /^https:\/\/(www\.google\.com\/maps|maps\.google\.com|www\.youtube\.com\/embed|www\.youtube-nocookie\.com\/embed)/i;

export function sanitizeHtml(input: string): string {
  let out = String(input || "");
  out = out.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<script[^>]*>/gi, "");
  out = out.replace(/<style[\s\S]*?<\/style>/gi, "");
  out = out.replace(/<(object|embed|link|meta|base|form-action)\b[^>]*>/gi, "");
  out = out.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/(href|src|action)\s*=\s*("|')\s*(javascript|data|vbscript):[^"']*\2/gi, '$1="#"');
  out = out.replace(/<iframe[\s\S]*?<\/iframe>/gi, (m) => {
    const src = /src\s*=\s*["']([^"']+)["']/i.exec(m)?.[1] || "";
    return SAFE_FRAME.test(src.replace(/&amp;/g, "&")) ? m : "";
  });
  return out;
}
