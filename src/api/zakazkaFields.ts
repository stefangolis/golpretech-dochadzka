import { env } from "../config/env";
import {
  fetchListColumns,
  fieldString,
  asSharePointYesNo,
  resolveListColumn,
  type ListColumnInfo,
} from "./listColumns";

export type ZakazkaColumnMap = {
  title: string;
  zakazkaId: string;
  zakaznik: string;
  nazov: string | null;
  stavAktivna: string;
};

let cached: ZakazkaColumnMap | null = null;

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
      `V zozname Zákazky chýba stĺpec ${label}. ` +
        `Dostupné stĺpce: ${columnSummary(columns)}`,
    );
  }
  return resolved;
}

export async function getZakazkaColumnMap(
  accessToken: string,
): Promise<ZakazkaColumnMap> {
  if (cached) return cached;

  const columns = await fetchListColumns(
    accessToken,
    env.sharePointSiteId,
    env.sharePointListZakazkyId,
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
    nazov: resolveListColumn(columns, ["Nazov", "Nazov0"], ["nazov"]),
    stavAktivna: requireColumn(
      columns,
      ["StavAktivna", "Aktivna"],
      ["stavaktivna"],
      "StavAktivna",
    ),
  };
  return cached;
}

export type ParsedZakazka = {
  zakazkaId: string;
  title: string;
  nazov: string;
  zakaznik: string;
  stavAktivna: boolean;
};

export function parseZakazkaRow(
  fields: Record<string, unknown>,
  cols: ZakazkaColumnMap,
): ParsedZakazka {
  const zakazkaId = fieldString(fields, cols.zakazkaId);
  const title = fieldString(fields, cols.title);
  const nazovCol = fieldString(fields, cols.nazov);
  const zakaznik = fieldString(fields, cols.zakaznik);

  const nazov =
    nazovCol ||
    (title && title.toLowerCase() !== zakazkaId.toLowerCase() ? title : "");

  const stavAktivna = asSharePointYesNo(fields[cols.stavAktivna]);

  return { zakazkaId, title, nazov, zakaznik, stavAktivna };
}

export function zakazkaSelectFields(cols: ZakazkaColumnMap): string[] {
  const fields = [cols.title, cols.zakazkaId, cols.zakaznik, cols.stavAktivna];
  if (cols.nazov) fields.push(cols.nazov);
  return [...new Set(fields)];
}
