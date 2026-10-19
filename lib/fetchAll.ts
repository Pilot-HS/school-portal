// Supabase returns at most 1000 rows per request. This helper keeps asking
// for the next 1000 until everything has been collected.
export async function fetchAllRows(
  build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>
): Promise<any[]> {
  const all: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    const rows = data || [];
    all.push(...rows);
    if (rows.length < 1000) break;
  }
  return all;
}
