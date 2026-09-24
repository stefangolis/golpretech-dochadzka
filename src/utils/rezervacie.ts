import type { Rezervacia } from "../api/rezervacieFields";
import type { Vozidlo } from "../api/vozidlaFields";
import {
  daysAheadDateOnly,
  formatDateShort,
  parseDateOnly,
} from "./dates";

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
  return existujuce.filter((r) => {
    if (kandidat.excludeId && r.id === kandidat.excludeId) return false;
    if (r.vozidloSpz.trim().toLowerCase() !== spz) return false;
    if (r.stav !== "Rezervovane" && r.stav !== "Prevzate") return false;
    return prekryv(kandidat.od, kandidat.do, r.od, r.do);
  });
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
      if (r.stav !== "Rezervovane" && r.stav !== "Prevzate") return false;
      return prekryv(r.od, r.do, dnes, horizon);
    })
    .sort((a, b) => a.od.localeCompare(b.od));

  const useky: ObsadenyUsek[] = relevant.map((r) => ({
    od: r.od,
    do: r.do,
    rezervaciaId: r.id,
    meno: menoZRezervacie(r),
    stav: r.stav,
  }));

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
  const aktivne = rezervacie.filter(
    (r) => r.stav === "Rezervovane" || r.stav === "Prevzate",
  );
  if (aktivne.length === 0) return "Žiadna rezervácia";

  const prebiehajuce = aktivne
    .filter((r) => r.od <= dnes && r.do >= dnes)
    .sort((a, b) => a.do.localeCompare(b.do));

  const pick = prebiehajuce[0]
    ?? [...aktivne].sort((a, b) => a.od.localeCompare(b.od))[0];
  if (!pick) return "Žiadna rezervácia";

  const nazov = nazovBySpz(pick.vozidloSpz) || pick.vozidloSpz;
  if (pick.stav === "Prevzate") {
    return `Prevzaté: ${nazov} — odovzdať`;
  }
  return `Rezervované: ${nazov} ${formatRezervaciaObdobie(pick.od, pick.do)}`;
}
