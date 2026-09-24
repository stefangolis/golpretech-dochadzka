import { env } from "../config/env";
import {
  fetchListColumns,
  fieldString,
  asSharePointValue,
  resolveListColumn,
  type ListColumnInfo,
} from "./listColumns";

export type ObjednavkaColumnMap = {
  title: string;
  zakazkaId: string;
  zakaznik: string;
  stav: string;
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
      `V zozname Prijaté objednávky chýba stĺpec ${label}. ` +
        `Dostupné stĺpce: ${columnSummary(columns)}`,
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
  };
  return cached;
}

export type ParsedObjednavka = {
  cisloObjednavky: string;
  zakazkaId: string;
  zakaznik: string;
  stav: string;
};

export function parseObjednavkaRow(
  fields: Record<string, unknown>,
  cols: ObjednavkaColumnMap,
): ParsedObjednavka {
  return {
    cisloObjednavky: fieldString(fields, cols.title),
    zakazkaId: fieldString(fields, cols.zakazkaId),
    zakaznik: fieldString(fields, cols.zakaznik),
    stav: fieldString(fields, cols.stav),
  };
}

export function isActiveObjednavka(stav: string): boolean {
  return stav.trim().toLowerCase() !== "neaktivna";
}

export { asSharePointValue };
