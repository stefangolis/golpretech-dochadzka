/** Výpočty pre formuláre s klávesnicou. Čistý modul (bez React Native). */

/** Voľné miesto nad / pod zaostreným poľom pri automatickom posune. */
export const OKRAJ_POLA = 24;

/**
 * O koľko bodov klávesnica prekrýva spodok view (súradnice okna).
 * 0 = neprekrýva (alebo systém okno už zmenšil); null klávesnica = skrytá.
 */
export function prekrytieKlavesnicou(
  viewY: number,
  viewVyska: number,
  klavesnicaY: number | null,
): number {
  if (klavesnicaY === null || !Number.isFinite(klavesnicaY)) return 0;
  return Math.max(0, Math.round(viewY + viewVyska - klavesnicaY));
}

/**
 * Cieľový posun ScrollView, aby bolo zaostrené pole celé vo viditeľnej časti.
 * poleY = poloha poľa v obsahu ScrollView, viditelnaVyska = výška ScrollView mínus
 * prekrytie klávesnicou. null = netreba posúvať.
 */
export function posunNaPole(p: {
  poleY: number;
  poleVyska: number;
  offset: number;
  viditelnaVyska: number;
  okraj?: number;
}): number | null {
  const okraj = p.okraj ?? OKRAJ_POLA;
  if (p.viditelnaVyska <= 0) return null;
  const hore = p.poleY - okraj;
  const dole = p.poleY + p.poleVyska + okraj;
  if (dole - hore > p.viditelnaVyska) {
    // pole je vyššie ako voľné miesto — ukáž jeho vrch
    return Math.abs(p.offset - hore) < 1 ? null : Math.max(0, hore);
  }
  if (dole > p.offset + p.viditelnaVyska) return Math.max(0, dole - p.viditelnaVyska);
  if (hore < p.offset) return Math.max(0, hore);
  return null;
}
