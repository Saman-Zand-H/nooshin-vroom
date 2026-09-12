export type ScreenType = "film" | "series";

/** IMDb exports may use either display labels or compact title-type names. */
export function screenType(format: string): ScreenType {
  return /series|episode/i.test(format) ? "series" : "film";
}

export function withScreenType(format: string, type: ScreenType): string {
  if (format && screenType(format) === type) return format;
  const year = format.match(/\b(?:18|19|20|21)\d{2}\b/)?.[0];
  return [type === "series" ? "Series" : "Film", year]
    .filter(Boolean)
    .join(" · ");
}
