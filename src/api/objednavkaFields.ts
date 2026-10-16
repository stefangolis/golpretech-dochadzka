import { env } from "../config/env";
import { cs } from "../i18n/cs";
import {
  fetchListColumns,
  fieldString,
  asSharePointValue,
  resolveListColumn,
  resolveListColumnExact,
  type ListColumnInfo,
} from "./listColumns";

export type ObjednavkaColumnMap = {
  title: string;
  zakazkaId: string;
  zakaznik: string;
  stav: string;
  /** Voliteľný stĺpec s dátumom objednávky (sync ho zatiaľ neposiela) */
  datumObjednavky: string | null;
  created: string;
};

let cached: ObjednavkaColumnMap | null = null;

function columnSummary(columns: ListColumnInfo[]): string {
  return columns.map((c) => `${c.displayName} (${c.name})`).join(", ") || "—";
}

function requireColumn(
  columns: ListColumnInfo[],
  preferredNames: string[],
  displayHints: string[],
  label: string,
): string {
  const resolved = resolveListColumn(columns, preferredNames, displayHints);
  if (!resolved) {
    throw new Error(
      cs.sharepoint.chybiSloupecDostupne(
        "Prijaté objednávky",
        label,
        columnSummary(columns),
      ),
    );
  }
  return resolved;
}

export async function getObjednavkaColumnMap(
  accessToken: string,
): Promise<ObjednavkaColumnMap> {
  if (cached) return cached;

  const columns = await fetchListColumns(
    accessToken,
    env.sharePointSiteId,
    env.sharePointListObjednavkyId,
  );

  cached = {
    title: requireColumn(columns, ["Title"], ["nadpis"], "Title"),
    zakazkaId: requireColumn(
      columns,
      ["ZakazkaId", "Zakazka"],
      ["zakazka"],
      "ZakazkaId",
    ),
    zakaznik: requireColumn(
      columns,
      ["Zakaznik", "Zakaznik0"],
      ["zakaznik"],
      "Zakaznik",
    ),
    stav: requireColumn(columns, ["Stav"], ["stav"], "Stav"),
    datumObjednavky: resolveListColumnExact(columns, [
      "DatumObjednavky",
      "DatumDokladu",
      "Dátum objednávky",
    ]),
    created: "Created",
  };
  return cached;
}

export function objednavkaSelectFields(cols: ObjednavkaColumnMap): string[] {
  return [
    cols.title,
    cols.zakazkaId,
    cols.zakaznik,
    cols.stav,
    cols.created,
    ...(cols.datumObjednavky ? [cols.datumObjednavky] : []),
  ];
}

export type ParsedObjednavka = {
  cisloObjednavky: string;
  zakazkaId: string;
  zakaznik: string;
  stav: string;
  datumObjednavky: string;
  created: string;
  itemId: string;
};

export function parseObjednavkaRow(
  fields: Record<string, unknown>,
  cols: ObjednavkaColumnMap,
  itemId = "",
): ParsedObjednavka {
  return {
    cisloObjednavky: fieldString(fields, cols.title),
    zakazkaId: fieldString(fields, cols.zakazkaId),
    zakaznik: fieldString(fields, cols.zakaznik),
    stav: fieldString(fields, cols.stav),
    datumObjednavky: fieldString(fields, cols.datumObjednavky),
    created: fieldString(fields, cols.created),
    itemId,
  };
}

export function isActiveObjednavka(stav: string): boolean {
  return stav.trim().toLowerCase() !== "neaktivna";
}

export { asSharePointValue };
