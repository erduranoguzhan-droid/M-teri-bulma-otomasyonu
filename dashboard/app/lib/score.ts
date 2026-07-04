// Lead skoruna gore renk bandi (CSS sinifi).
export function scoreBand(score: number | undefined): string {
  if (score == null) return "s-low";
  if (score >= 75) return "s-hot";
  if (score >= 60) return "s-warm";
  if (score >= 40) return "s-mid";
  return "s-low";
}
