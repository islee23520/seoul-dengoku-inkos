/** Human-readable chapter classification, not a machine enum. */
export function koreanChapterType(value: string): string {
  const labels: Record<string, string> = { ordinary: "일상", daily: "일상", daily_life: "일상", slice_of_life: "일상", transition: "전환", setup: "도입", opening: "도입", investigation: "조사", conflict: "갈등", climax: "절정", resolution: "해결", aftermath: "후일담", main_plot: "본줄기 진행", progression: "전개" };
  const key = value.trim().toLowerCase().replace(/[- ]/g, "_");
  return labels[key] ?? (/[A-Za-z]/.test(value) && !value.startsWith("기타(") ? `기타(${value})` : value);
}
