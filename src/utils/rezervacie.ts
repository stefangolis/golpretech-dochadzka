import type { Rezervacia } from "../api/rezervacieFields";
import type { Vozidlo } from "../api/vozidlaFields";
import {
  dayAfterDateOnly,
  daysAheadDateOnly,
  formatDateShort,
  parseDateOnly,
  todayDateOnly,
} from "./dates";

/** Rezervované a Prevzaté blokujú vozidlo; Vrátené a Zrušené nikdy. */
export function jeAktivnaRezervacia(r: Pick<Rezervacia, "stav">): boolean {
  return r.stav === "Rezervovane" || r.stav === "Prevzate";
}

/** Prevzaté a neodovzdané po termíne. */
export function jeNeodovzdanaPoTermine(
  r: Pick<Rezervacia, "stav" | "do">,
  dnes: string,
): boolean {
  return r.stav === "Prevzate" && r.do < dnes;
}

/** Posledný blokovaný deň: neodovzdané po termíne blokuje aj dnešok. */
export function efektivnyKoniec(
  r: Pick<Rezervacia, "stav" | "do">,
  dnes: string,
): string {
  return jeNeodovzdanaPoTermine(r, dnes) ? dnes : r.do;
}

/** Maximálna dĺžka rezervácie (dni vrátane). */
export const REZERVACIA_MAX_DAYS = 30;
/** Ako ďaleko dopredu sa dá rezervovať (dni od dnes). */
export const REZERVACIA_MAX_DAYS_AHEAD = 90;

/** Inkluzívne prekrytie dátumových úsekov (YYYY-MM-DD). */
export function prekryv(
  aOd: string,
  aDo: string,
  bOd: string,
  bDo: string,
): boolean {
  return aOd <= bDo && bOd <= aDo;
}

export type RezervaciaKandidat = {
  vozidloSpz: string;
  od: string;
  do: string;
  excludeId?: string;
};

export function najdiKolizie(
  kandidat: RezervaciaKandidat,
  existujuce: readonly Rezervacia[],
): Rezervacia[] {
  const spz = kandidat.vozidloSpz.trim().toLowerCase();
  const dnes = todayDateOnly();
  return existujuce.filter((r) => {
    if (kandidat.excludeId && r.id === kandidat.excludeId) return false;
    if (r.vozidloSpz.trim().toLowerCase() !== spz) return false;
    if (!jeAktivnaRezervacia(r)) return false;
    return prekryv(kandidat.od, kandidat.do, r.od, efektivnyKoniec(r, dnes));
  });
}

/**
 * Obsadené dni vozidla v okne [od, do] (aktívne rezervácie).
 * `excludeId` = upravovaná rezervácia, ktorej dni sa neberú ako obsadené.
 */
export function obsadeneDniVozidla(
  rezervacie: readonly Rezervacia[],
  vozidloSpz: string,
  od: string,
  doDate: string,
  excludeId?: string,
): Set<string> {
  const set = new Set<string>();
  const spz = vozidloSpz.trim().toLowerCase();
  if (!spz) return set;
  const dnes = todayDateOnly();
  for (const r of rezervacie) {
    if (excludeId && r.id === excludeId) continue;
    if (r.vozidloSpz.trim().toLowerCase() !== spz) continue;
    if (!jeAktivnaRezervacia(r)) continue;
    const koniec = efektivnyKoniec(r, dnes);
    let d = r.od < od ? od : r.od;
    const end = koniec > doDate ? doDate : koniec;
    while (d <= end) {
      set.add(d);
      d = dayAfterDateOnly(d);
    }
  }
  return set;
}

/** Meno rezervujúceho z Title („… · meno“) alebo z emailu. */
export function menoZRezervacie(r: Pick<Rezervacia, "title" | "zamestnanecEmail">): string {
  const parts = r.title.split("·").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) return parts[parts.length - 1]!;
  const email = r.zamestnanecEmail.trim();
  if (!email) return "—";
  const local = email.split("@")[0] ?? email;
  return local || email;
}

export type ObsadenyUsek = {
  od: string;
  do: string;
  rezervaciaId: string;
  meno: string;
  stav: string;
  poTermine: boolean;
};

export type DostupnostInfo = {
  text: string;
  useky: ObsadenyUsek[];
};

export function dostupnostVozidla(
  vozidlo: Pick<Vozidlo, "spz">,
  rezervacie: readonly Rezervacia[],
  dnes: string,
  dni = 14,
): DostupnostInfo {
  const horizon = daysAheadDateOnly(dni - 1);
  const spz = vozidlo.spz.trim().toLowerCase();

  const relevant = rezervacie
    .filter((r) => {
      if (r.vozidloSpz.trim().toLowerCase() !== spz) return false;
      if (!jeAktivnaRezervacia(r)) return false;
      return prekryv(r.od, efektivnyKoniec(r, dnes), dnes, horizon);
    })
    .sort((a, b) => a.od.localeCompare(b.od));

  const useky: ObsadenyUsek[] = relevant.map((r) => ({
    od: r.od,
    do: r.do,
    rezervaciaId: r.id,
    meno: menoZRezervacie(r),
    stav: r.stav,
    poTermine: jeNeodovzdanaPoTermine(r, dnes),
  }));

  const neodovzdana = relevant.find((r) => jeNeodovzdanaPoTermine(r, dnes));
  if (neodovzdana) {
    return { text: `Neodovzdané (${menoZRezervacie(neodovzdana)})`, useky };
  }

  const coveringToday = relevant.find((r) => r.od <= dnes && r.do >= dnes);
  if (coveringToday) {
    return {
      text: `Obsadené do ${formatDateShort(coveringToday.do)} (${menoZRezervacie(coveringToday)})`,
      useky,
    };
  }

  return { text: "Voľné dnes", useky };
}

export function formatRezervaciaObdobie(od: string, doDate: string): string {
  const a = parseDateOnly(od);
  const b = parseDateOnly(doDate);
  const left = `${a.getDate()}. ${a.getMonth() + 1}.`;
  const right = `${b.getDate()}. ${b.getMonth() + 1}.`;
  if (od === doDate) return left;
  return `${left}–${right}`;
}

/** Text stavu dlaždice Vozidlá na Hube. */
export function hubVozidlaStatusText(
  rezervacie: readonly Rezervacia[],
  dnes: string,
  nazovBySpz: (spz: string) => string,
): string {
  const aktivne = rezervacie.filter(jeAktivnaRezervacia);
  if (aktivne.length === 0) return "Žiadna rezervácia";
  const nazov = (r: Rezervacia) =>
    nazovBySpz(r.vozidloSpz) || r.vozidloSpz;

  const prevzata = aktivne
    .filter((r) => r.stav === "Prevzate")
    .sort((a, b) => a.do.localeCompare(b.do))[0];
  if (prevzata) return `Vozidlo ${nazov(prevzata)} – prevzaté, odovzdať`;

  const naPrevzatie = aktivne
    .filter((r) => r.stav === "Rezervovane" && r.od <= dnes)
    .sort((a, b) => a.od.localeCompare(b.od))[0];
  if (naPrevzatie) return `Vozidlo ${nazov(naPrevzatie)} – prevziať`;

  const dalsia = [...aktivne].sort((a, b) => a.od.localeCompare(b.od))[0];
  if (!dalsia) return "Žiadna rezervácia";
  return `Rezervované: ${nazov(dalsia)} ${formatRezervaciaObdobie(dalsia.od, dalsia.do)}`;
}
