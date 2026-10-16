/**
 * Výber zákazky: každé číslo zákazky (VYZAK…) len raz. Ak má zákazka viac prijatých
 * objednávok, platí najnovšia. Čistý modul (bez React Native).
 */

/** Kľúč čísla zákazky: bez ohľadu na veľkosť písmen a medzery. */
export function zakazkaKluc(zakazkaId: string): string {
  return zakazkaId.replace(/\s+/g, "").toLowerCase();
}

export type ObjednavkaPoradie = {
  cisloObjednavky: string;
  /** Dátum objednávky (YYYY-MM-DD alebo ISO); prázdne = nie je k dispozícii */
  datumObjednavky?: string;
  /** SharePoint Created (ISO) */
  created?: string;
  /** SharePoint ID položky */
  itemId?: string;
};

function casMs(v: string | undefined): number | null {
  if (!v?.trim()) return null;
  const ms = Date.parse(v.trim());
  return Number.isFinite(ms) ? ms : null;
}

function idCislo(v: string | undefined): number | null {
  if (!v?.trim()) return null;
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : null;
}

function porovnajVolitelne(a: number | null, b: number | null): number {
  if (a === null || b === null || a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Kladné = `a` je novšia. Poradie: dátum objednávky (ak ho majú obe), potom Created,
 * potom vyššie ID, nakoniec číslo objednávky.
 */
export function porovnajObjednavky(a: ObjednavkaPoradie, b: ObjednavkaPoradie): number {
  return (
    porovnajVolitelne(casMs(a.datumObjednavky), casMs(b.datumObjednavky)) ||
    porovnajVolitelne(casMs(a.created), casMs(b.created)) ||
    porovnajVolitelne(idCislo(a.itemId), idCislo(b.itemId)) ||
    a.cisloObjednavky.localeCompare(b.cisloObjednavky, "sk", { numeric: true })
  );
}

export type JedinecnaZakazka<Z, O> = {
  zakazka: Z;
  /** Najnovšia objednávka zákazky; null = zákazka bez objednávky */
  objednavka: O | null;
  /** Ostatné (staršie) objednávky — len pre vyhľadávanie */
  starsieObjednavky: O[];
};

/**
 * Jedna položka na číslo zákazky (prvý výskyt v `zakazky`), s najnovšou objednávkou.
 * Objednávky bez zákazky v `zakazky` sa ignorujú.
 */
export function jedinecneZakazky<
  Z extends { zakazkaId: string },
  O extends ObjednavkaPoradie & { zakazkaId: string },
>(zakazky: readonly Z[], objednavky: readonly O[]): JedinecnaZakazka<Z, O>[] {
  const podlaZakazky = new Map<string, O[]>();
  for (const o of objednavky) {
    const k = zakazkaKluc(o.zakazkaId);
    if (!k || !o.cisloObjednavky.trim()) continue;
    const list = podlaZakazky.get(k);
    if (list) list.push(o);
    else podlaZakazky.set(k, [o]);
  }

  const out: JedinecnaZakazka<Z, O>[] = [];
  const videne = new Set<string>();
  for (const z of zakazky) {
    const k = zakazkaKluc(z.zakazkaId);
    if (!k || videne.has(k)) continue;
    videne.add(k);
    const zoradene = [...(podlaZakazky.get(k) ?? [])].sort((a, b) => porovnajObjednavky(b, a));
    out.push({
      zakazka: z,
      objednavka: zoradene[0] ?? null,
      starsieObjednavky: zoradene.slice(1),
    });
  }
  return out;
}
