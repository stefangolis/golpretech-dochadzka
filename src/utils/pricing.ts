/** Cena = minútová sadzba × minúty (2 desatinné miesta) */
export function computeEntryCena(
  minuty: number,
  minutovaSadzba: number,
): number {
  return Math.round(minuty * minutovaSadzba * 100) / 100;
}

export function formatSadzba(minutovaSadzba: number): string {
  const n = Number(minutovaSadzba);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function formatCena(cena: number): string {
  const n = Number(cena);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
