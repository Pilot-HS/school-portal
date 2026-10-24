import { supabase } from "@/lib/supabaseClient";

// Calls the website editing routes with the logged-in person's token.
export async function siteApi(path: string, options: { method?: string; body?: any; form?: FormData } = {}) {
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = { Authorization: `Bearer ${data.session?.access_token}` };
  let body: any = undefined;
  if (options.form) body = options.form;
  else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  const res = await fetch(path, { method: options.method || (body ? "POST" : "GET"), headers, body, cache: "no-store" });
  let json: any = {};
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  return { ok: res.ok, status: res.status, data: json };
}
