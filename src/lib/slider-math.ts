export function calcFont(v: number) {
  const dist = Math.abs(v - 50);
  return Math.round(14 + (dist / 50) * 20);
}
