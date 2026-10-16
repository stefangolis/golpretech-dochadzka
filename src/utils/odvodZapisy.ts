/** Odvod hodín — zoznam mojich zápisov zoskupený podľa dňa. Čistý modul (bez React Native). */
import { formatDenKratce } from "../i18n/datum";
import { formatHodinyMinuty, sucetMinutDna } from "./odvodMinuty";

export type ZapisPreZoznam = {
  id: string;
  /** Deň, za ktorý je odvod (YYYY-MM-DD) */
  datum: string;
  minuty: number;
  /** CasZapisu (v SharePointe môže byť len dátum) */
  casZapisu: string;
  /** SharePoint Created */
  created?: string;
};

export type DenZapisov<T> = {
  datum: string;
  nadpis: string;
  /** Súčet všetkých zápisov dňa (rovnaký ako pri kontrole 480 minút) */
  sucetMin: number;
  sucetText: string;
  zapisy: T[];
};

function ms(v: string | undefined): number {
  const n = v ? Date.parse(v) : NaN;
  return Number.isFinite(n) ? n : -Infinity;
}

function idCislo(id: string): number {
  const n = Number(id);
  return Number.isFinite(n) ? n : -Infinity;
}

/** "St 14. 10." */
export function nadpisDna(datum: string): string {
  return formatDenKratce(datum);
}

/**
 * Najnovší deň (Datum) hore; v rámci dňa najnovší zápis hore podľa CasZapisu,
 * pri zhode (CasZapisu bez času) podľa Created, nakoniec podľa vyššieho ID.
 */
export function porovnajZapisy(a: ZapisPreZoznam, b: ZapisPreZoznam): number {
  if (a.datum !== b.datum) return a.datum < b.datum ? 1 : -1;
  return (
    ms(b.casZapisu) - ms(a.casZapisu) ||
    ms(b.created) - ms(a.created) ||
    idCislo(b.id) - idCislo(a.id)
  );
}

export function zoradZapisy<T extends ZapisPreZoznam>(zapisy: readonly T[]): T[] {
  return [...zapisy].sort(porovnajZapisy);
}

export function zoskupZapisyPodlaDna<T extends ZapisPreZoznam>(
  zapisy: readonly T[],
): DenZapisov<T>[] {
  const out: DenZapisov<T>[] = [];
  for (const z of zoradZapisy(zapisy)) {
    let den = out[out.length - 1];
    if (!den || den.datum !== z.datum) {
      const sucetMin = sucetMinutDna(zapisy, z.datum);
      den = {
        datum: z.datum,
        nadpis: nadpisDna(z.datum),
        sucetMin,
        sucetText: `${sucetMin} min (${formatHodinyMinuty(sucetMin)})`,
        zapisy: [],
      };
      out.push(den);
    }
    den.zapisy.push(z);
  }
  return out;
}

/** Prvých `max` zápisov (zbalený zoznam); súčty dní ostávajú za celý deň. */
export function orezDni<T>(dni: readonly DenZapisov<T>[], max: number): DenZapisov<T>[] {
  const out: DenZapisov<T>[] = [];
  let zostava = max;
  for (const den of dni) {
    if (zostava <= 0) break;
    out.push({ ...den, zapisy: den.zapisy.slice(0, zostava) });
    zostava -= den.zapisy.length;
  }
  return out;
}

/** Úprava v cache: zápis s novými hodnotami (aj iným dátumom) sa zaradí pod správny deň. */
export function nahradZapis<T extends ZapisPreZoznam>(
  zapisy: readonly T[],
  id: string,
  zmena: Partial<T>,
): T[] {
  return zoradZapisy(zapisy.map((z) => (z.id === id ? { ...z, ...zmena } : z)));
}
