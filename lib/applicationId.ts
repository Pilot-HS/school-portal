export function formatApplicationId(seq: number, createdAt: string): string {
  const year = new Date(createdAt).getFullYear();
  const padded = String(seq).padStart(4, "0");
  return `GBPILOT-${year}-${padded}`;
}
