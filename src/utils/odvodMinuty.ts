/** Odvod hodín — upozornenie na veľa minút pred uložením. Čistý modul (bez React Native). */
import { cs } from "../i18n/cs";
import { formatDatumPlny } from "../i18n/datum";

/** Nad túto hranicu (8 h) sa pýtame na potvrdenie — pre jeden zápis aj súčet dňa. */
export const LIMIT_MINUT = 480;

export type KontrolaMinut = {
  minuty: number;
  datum: string;
  /** Jeden zápis má viac ako LIMIT_MINUT */
  nadZapis: boolean;
  /** Súčet vlastných zápisov v deň zápisu vrátane tohto; null = deň nie je v načítaných dátach */
  sucetDna: number | null;
  nadDen: boolean;
};

type Zaznam = { id: string; datum: string; minuty: number };

/** Súčet minút vlastných zápisov za deň (Datum); `bezId` = zápis, ktorý sa nepočíta. */
export function sucetMinutDna(
  zaznamy: readonly Zaznam[],
  datum: string,
  bezId?: string | null,
): number {
  return zaznamy.reduce(
    (sum, z) => (z.datum === datum && z.id !== bezId ? sum + z.minuty : sum),
    0,
  );
}

/**
 * Súčet dňa = vlastné zápisy v dátum zápisu (nie dnes) + tento zápis. Pri úprave sa
 * pôvodná hodnota upravovaného zápisu nezapočíta. Ak dátum nie je v okne načítaných
 * zápisov (alebo zápisy nie sú načítané), kontrola súčtu sa preskočí.
 */
export function skontrolujMinuty(input: {
  minuty: number;
  datum: string;
  zaznamy: readonly Zaznam[] | undefined;
  nacitaneOd: string;
  nacitaneDo: string;
  upravovaneId?: string | null;
}): KontrolaMinut {
  const { minuty, datum, zaznamy, nacitaneOd, nacitaneDo, upravovaneId } = input;
  const vOkne = !!zaznamy && datum >= nacitaneOd && datum <= nacitaneDo;
  const sucetDna = vOkne ? sucetMinutDna(zaznamy, datum, upravovaneId) + minuty : null;
  return {
    minuty,
    datum,
    nadZapis: minuty > LIMIT_MINUT,
    sucetDna,
    nadDen: sucetDna !== null && sucetDna > LIMIT_MINUT,
  };
}

/** 500 → "8 h 20 min" */
export function formatHodinyMinuty(min: number): string {
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

/** Text potvrdzovacieho dialógu; null = netreba sa pýtať. Pri oboch podmienkach jeden text. */
export function textUpozorneniaMinut(k: KontrolaMinut): string | null {
  const T = cs.odvod.minuty;
  const casti: string[] = [];
  if (k.nadZapis) casti.push(T.nadZapis(k.minuty, formatHodinyMinuty(k.minuty)));
  if (k.nadDen && k.sucetDna !== null) {
    casti.push(T.nadDen(formatDatumPlny(k.datum), k.sucetDna, formatHodinyMinuty(k.sucetDna)));
  }
  if (!casti.length) return null;
  casti.push(k.nadZapis ? T.opravduUlozit : T.pokracovat);
  return casti.join(" ");
}
