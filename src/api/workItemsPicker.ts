import { asSharePointYesNo } from "./listColumns";
import type { ParsedObjednavka } from "./objednavkaFields";
import type { ParsedZakazka } from "./zakazkaFields";
import type { TimeEntry, WorkItem } from "../types/workItems";
import {
  buildWorkItemMainLine,
  buildWorkItemOrderSubLine,
} from "../utils/workItemLabel";

export type ZakazkaLookup = Record<string, ParsedZakazka>;

export type WorkCatalog = {
  /** Ponuka na výber pri novom zápise — len aktívne zákazky. */
  pickerItems: WorkItem[];
  /** Aktívne zákazky (+ historické doplnené podľa potreby). */
  zakazkyById: ZakazkaLookup;
};

function isActiveOrderStatus(stav: string): boolean {
  return stav.trim().toLowerCase() !== "neaktivna";
}

export function zakazkaLookupKey(zakazkaId: string): string {
  return zakazkaId.trim().toLowerCase();
}

export function zakazkyLookupMap(zakazky: ParsedZakazka[]): ZakazkaLookup {
  const out: ZakazkaLookup = {};
  for (const z of zakazky) {
    if (!z.zakazkaId) continue;
    out[zakazkaLookupKey(z.zakazkaId)] = z;
  }
  return out;
}

export function workItemFromZakazka(parsed: ParsedZakazka): WorkItem {
  const { zakazkaId, nazov, zakaznik } = parsed;
  const label = buildWorkItemMainLine(zakazkaId, zakaznik, nazov);
  return {
    key: `z:${zakazkaId}`,
    kind: "zakazka",
    zakazkaId,
    nazov: nazov || "—",
    zakaznik: zakaznik || "—",
    objednavkaFirma: "",
    cisloObjednavky: "",
    label,
    subtitle: "",
    searchText: `${label} ${zakazkaId} ${nazov} ${zakaznik}`.toLowerCase(),
  };
}

export function workItemFromObjednavka(
  order: ParsedObjednavka,
  zak: ParsedZakazka | undefined,
): WorkItem {
  const zakazkaId = order.zakazkaId;
  const nazov = zak?.nazov ?? "";
  const zakaznik = zak?.zakaznik ?? "";
  const label = buildWorkItemMainLine(zakazkaId, zakaznik, nazov);
  const subtitle = buildWorkItemOrderSubLine(
    order.cisloObjednavky,
    order.zakaznik,
  );

  return {
    key: `o:${order.cisloObjednavky}`,
    kind: "objednavka",
    zakazkaId,
    nazov: nazov || "—",
    zakaznik: zakaznik || "—",
    objednavkaFirma: order.zakaznik || "—",
    cisloObjednavky: order.cisloObjednavky,
    label,
    subtitle,
    searchText:
      `${label} ${subtitle} ${zakazkaId} ${nazov} ${zakaznik} ${order.zakaznik}`.toLowerCase(),
  };
}

/**
 * Ponuka pre nový zápis: len zákazky so StavAktivna=true.
 * Objednávky uzavretej zákazky sa nezobrazia, aj keď majú Stav ≠ Neaktivna.
 */
export function buildPickerWorkItems(
  zakazky: ParsedZakazka[],
  objednavky: ParsedObjednavka[],
): WorkItem[] {
  const zakazkaById = zakazkyLookupMap(zakazky);
  const items: WorkItem[] = [];
  const zakazkaIdsWithActiveOrder = new Set<string>();

  for (const order of objednavky) {
    if (!order.cisloObjednavky || !isActiveOrderStatus(order.stav)) continue;
    if (!order.zakazkaId) continue;

    const key = zakazkaLookupKey(order.zakazkaId);
    const zak = zakazkaById[key];
    if (!zak || !asSharePointYesNo(zak.stavAktivna)) continue;

    zakazkaIdsWithActiveOrder.add(key);
    items.push(workItemFromObjednavka(order, zak));
  }

  for (const zak of zakazky) {
    if (!zak.zakazkaId || !asSharePointYesNo(zak.stavAktivna)) continue;
    const key = zakazkaLookupKey(zak.zakazkaId);
    if (zakazkaIdsWithActiveOrder.has(key)) continue;
    items.push(workItemFromZakazka(zak));
  }

  items.sort((a, b) => a.label.localeCompare(b.label, "sk"));
  return items;
}

export function formatEntryZakazkaLabel(
  zakazkaId: string,
  lookup: ZakazkaLookup,
): string {
  const id = zakazkaId.trim();
  if (!id) return "—";
  const zak = lookup[zakazkaLookupKey(id)];
  if (!zak) return id;
  return buildWorkItemMainLine(zak.zakazkaId, zak.zakaznik, zak.nazov);
}

export function formatTimeEntryWorkLine(
  entry: Pick<TimeEntry, "zakazkaId" | "cisloObjednavky">,
  lookup: ZakazkaLookup,
): string {
  const zakLabel = formatEntryZakazkaLabel(entry.zakazkaId, lookup);
  if (entry.cisloObjednavky) {
    return `${entry.cisloObjednavky} / ${zakLabel}`;
  }
  return zakLabel;
}
