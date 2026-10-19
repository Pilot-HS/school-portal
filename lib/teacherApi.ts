import { supabase } from "@/lib/supabaseClient";

// Calls one of our /api/teacher/... routes with the logged-in teacher's token.
export async function teacherApi(path: string, options: { method?: string; body?: any } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(path, {
    method: options.method || (options.body ? "POST" : "GET"),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
  let json: any = {};
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  return { ok: res.ok, data: json };
}
