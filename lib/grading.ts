export function getGradeForPercentage(percentage: number, bands: { grade_label: string; min_percentage: number; max_percentage: number }[]): string {
  const match = bands.find((b) => percentage >= b.min_percentage && percentage <= b.max_percentage);
  return match ? match.grade_label : "\u2014";
}
