import { env } from "../config/env";
import {
  fetchListColumns,
  fieldString,
  asSharePointValue,
  resolveListColumn,
} from "./listColumns";

export type ZakazkaColumnMap = {
  title: string;
  zakazkaId: string;
  zakaznik: string;
  nazov: string | null;
  stavAktivna: string;
};

let cached: ZakazkaColumnMap | null = null;

export async function getZakazkaColumnMap(
  accessToken: string,
): Promise<ZakazkaColumnMap> {
  if (cached) return cached;

  const columns = await fetchListColumns(
    accessToken,
    env.sharePointSiteId,
    env.sharePointListZakazkyId,
  );

  const zakazkaId =
    resolveListColumn(columns, ["ZakazkaId", "Zakazka"], ["zakazka"]) ??
    "ZakazkaId";
  const title = resolveListColumn(columns, ["Title"], ["nadpis"]) ?? "Title";
  const zakaznik =
    resolveListColumn(columns, ["Zakaznik", "Zakaznik0"], ["zakaznik"]) ??
    "Zakaznik";
  const nazov = resolveListColumn(columns, ["Nazov", "Nazov0"], ["nazov"]);
  const stavAktivna =
    resolveListColumn(columns, ["StavAktivna"], ["stavaktivna", "aktivna"]) ??
    "StavAktivna";

  cached = { title, zakazkaId, zakaznik, nazov, stavAktivna };
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

  const stavRaw = fields[cols.stavAktivna];
  const stavAktivna = asStavAktivna(stavRaw);

  return { zakazkaId, title, nazov, zakaznik, stavAktivna };
}

function asStavAktivna(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === "1" || v === "true" || v === "Yes") return true;
  if (v === 0 || v === "0" || v === "false" || v === "No") return false;
  const s = asSharePointValue(v).toLowerCase();
  if (s === "áno" || s === "ano" || s === "yes") return true;
  if (s === "nie" || s === "no") return false;
  return false;
}
