/**
 * Kalendár s výberom viacerých ľubovoľných dní — čistý modul (dátumy YYYY-MM-DD).
 */
import { cs } from "../i18n/cs";
import { dniVRozsahu, jePracovnyDen, jeStatnySviatokCR, jeVikend } from "./dochadzkaZiadosti";

export type PravidlaVyberu = {
  min: string;
  max: string;
  /** Dni s vlastnou aktívnou žiadosťou — nedajú sa vybrať (prekryv). */
  obsadene: ReadonlySet<string>;
  /** Víkendy a sviatky sa nedajú vybrať (dovolenka, náhradné voľno). */
  lenPracovne: boolean;
  /** Pri „Vybrať rozsah" preskočiť víkendy a sviatky (napr. home office). */
  rozsahLenPracovne?: boolean;
};

export type DenKalendara = {
  datum: string;
  den: number;
  vikend: boolean;
  sviatok: boolean;
  obsadeny: boolean;
  volitelny: boolean;
  vybrany: boolean;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Prečo sa deň nedá vybrať (text pre používateľa), alebo null ak sa dá. */
export function dovodNevolitelnosti(datum: string, p: PravidlaVyberu): string | null {
  if (datum < p.min || datum > p.max) return cs.kalendar.denMimoRozsah;
  if (p.obsadene.has(datum)) return cs.kalendar.denObsazen;
  if (p.lenPracovne && !jePracovnyDen(datum)) return cs.kalendar.denNepracovni;
  return null;
}

export function jeVolitelnyDen(datum: string, p: PravidlaVyberu): boolean {
  return dovodNevolitelnosti(datum, p) === null;
}

/** Ťuk na deň: vybrať / zrušiť. Nevoliteľný deň sa nedá pridať (zrušiť áno). */
export function prepniDen(vybrane: readonly string[], datum: string, p: PravidlaVyberu): string[] {
  if (vybrane.includes(datum)) return vybrane.filter((d) => d !== datum);
  if (!jeVolitelnyDen(datum, p)) return [...vybrane];
  return [...vybrane, datum].sort();
}

/**
 * „Vybrať rozsah": pridá všetky voliteľné dni medzi prvým a posledným (vrátane, v ľubovoľnom poradí).
 * Obsadené a nepovolené dni preskočí, pri `rozsahLenPracovne` aj víkendy a sviatky.
 */
export function pridajRozsah(
  vybrane: readonly string[],
  a: string,
  b: string,
  p: PravidlaVyberu,
): string[] {
  const [od, doKey] = a <= b ? [a, b] : [b, a];
  const out = new Set(vybrane);
  for (const d of dniVRozsahu(od, doKey)) {
    if (!jeVolitelnyDen(d, p)) continue;
    if (p.rozsahLenPracovne && !jePracovnyDen(d)) continue;
    out.add(d);
  }
  return [...out].sort();
}

/** Mriežka mesiaca od pondelka; null = prázdne políčko pred 1. dňom. */
export function mriezkaMesiaca(
  year: number,
  month: number,
  vybrane: readonly string[],
  p: PravidlaVyberu,
): (DenKalendara | null)[] {
  const prvy = new Date(Date.UTC(year, month - 1, 1));
  const posun = (prvy.getUTCDay() + 6) % 7;
  const pocet = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const vyb = new Set(vybrane);
  const out: (DenKalendara | null)[] = Array.from({ length: posun }, () => null);
  for (let den = 1; den <= pocet; den += 1) {
    const datum = `${year}-${pad2(month)}-${pad2(den)}`;
    out.push({
      datum,
      den,
      vikend: jeVikend(datum),
      sviatok: jeStatnySviatokCR(datum),
      obsadeny: p.obsadene.has(datum),
      volitelny: jeVolitelnyDen(datum, p),
      vybrany: vyb.has(datum),
    });
  }
  return out;
}

/** Posun mesiaca (month 1–12). */
export function posunMesiac(year: number, month: number, o: number): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + o;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

export function mesiacKluca(datum: string): { year: number; month: number } {
  return { year: Number(datum.slice(0, 4)), month: Number(datum.slice(5, 7)) };
}

/** Či mesiac (year, month) zasahuje do povoleného rozsahu. */
export function mesiacVRozsahu(year: number, month: number, p: Pick<PravidlaVyberu, "min" | "max">): boolean {
  const prvy = `${year}-${pad2(month)}-01`;
  const posledny = `${year}-${pad2(month)}-${pad2(new Date(Date.UTC(year, month, 0)).getUTCDate())}`;
  return posledny >= p.min && prvy <= p.max;
}
