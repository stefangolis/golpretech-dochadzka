import { env } from "../config/env";
import {
  fetchListColumns,
  fieldString,
  asSharePointValue,
  resolveListColumn,
} from "./listColumns";

export type ObjednavkaColumnMap = {
  title: string;
  zakazkaId: string;
  zakaznik: string;
  stav: string;
};

let cached: ObjednavkaColumnMap | null = null;

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
    title: resolveListColumn(columns, ["Title"], ["nadpis"]) ?? "Title",
    zakazkaId:
      resolveListColumn(columns, ["ZakazkaId", "Zakazka"], ["zakazka"]) ??
      "ZakazkaId",
    zakaznik:
      resolveListColumn(columns, ["Zakaznik", "Zakaznik0"], ["zakaznik"]) ??
      "Zakaznik",
    stav: resolveListColumn(columns, ["Stav"], ["stav"]) ?? "Stav",
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
