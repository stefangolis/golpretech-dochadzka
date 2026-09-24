import { env } from "../config/env";
import {
  fetchListColumns,
  fieldString,
  asSharePointValue,
  asSharePointYesNo,
  resolveListColumn,
  type ListColumnInfo,
} from "./listColumns";
import { listAllSharePointItems } from "./sharepointClient";
import { verifyVozidlaListIds } from "./rezervacieData";

export type VozidloColumnMap = {
  title: string;
  spz: string;
  aktivne: string;
  poslednyStavKm: string | null;
  stkDo: string | null;
  poznamka: string | null;
};

export type Vozidlo = {
  id: string;
  nazov: string;
  spz: string;
  aktivne: boolean;
  poslednyStavKm: number | null;
  stkDo: string;
  poznamka: string;
};

let cached: VozidloColumnMap | null = null;

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
      `V zozname Vozidla chýba stĺpec ${label}. ` +
        `Dostupné stĺpce: ${columnSummary(columns)}`,
    );
  }
  return resolved;
}

export async function getVozidloColumnMap(
  accessToken: string,
): Promise<VozidloColumnMap> {
  if (cached) return cached;
  if (!env.sharePointListVozidlaId) {
    throw new Error(
      "Chýba SHAREPOINT_LIST_VOZIDLA_ID v .env (reštartujte Expo po úprave).",
    );
  }

  const columns = await fetchListColumns(
    accessToken,
    env.sharePointSiteId,
    env.sharePointListVozidlaId,
  );

  cached = {
    title: requireColumn(columns, ["Title"], ["nadpis", "nazov"], "Title"),
    spz: requireColumn(
      columns,
      ["SPZ", "Spz", "EvidencneCislo"],
      ["spz"],
      "SPZ",
    ),
    aktivne: requireColumn(
      columns,
      ["Aktivne", "Aktivny"],
      ["aktiv"],
      "Aktivne",
    ),
    poslednyStavKm: resolveListColumn(
      columns,
      ["PoslednyStavKm", "PoslednyKm", "Km"],
      ["km", "stav"],
    ),
    stkDo: resolveListColumn(
      columns,
      ["STKDo", "StkDo", "STK"],
      ["stk"],
    ),
    poznamka: resolveListColumn(
      columns,
      ["Poznamka", "Poznámka", "Note"],
      ["poznam"],
    ),
  };
  return cached;
}

function asNumberOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(asSharePointValue(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function normalizeDateField(v: unknown): string {
  const s = asSharePointValue(v);
  if (!s) return "";
  return s.slice(0, 10);
}

export function parseVozidloRow(
  id: string,
  fields: Record<string, unknown>,
  cols: VozidloColumnMap,
): Vozidlo | null {
  const nazov = fieldString(fields, cols.title);
  const spz = fieldString(fields, cols.spz);
  if (!nazov && !spz) return null;

  return {
    id,
    nazov: nazov || spz,
    spz: spz || nazov,
    aktivne: asSharePointYesNo(fields[cols.aktivne]),
    poslednyStavKm: cols.poslednyStavKm
      ? asNumberOrNull(fields[cols.poslednyStavKm])
      : null,
    stkDo: cols.stkDo ? normalizeDateField(fields[cols.stkDo]) : "",
    poznamka: cols.poznamka ? fieldString(fields, cols.poznamka) : "",
  };
}

export function vozidloSelectFields(cols: VozidloColumnMap): string[] {
  const fields = [cols.title, cols.spz, cols.aktivne];
  if (cols.poslednyStavKm) fields.push(cols.poslednyStavKm);
  if (cols.stkDo) fields.push(cols.stkDo);
  if (cols.poznamka) fields.push(cols.poznamka);
  return [...new Set(fields)];
}

/** Aktívne vozidlá, zoradené podľa názvu. */
export async function fetchVozidla(accessToken: string): Promise<Vozidlo[]> {
  await verifyVozidlaListIds(accessToken);
  const cols = await getVozidloColumnMap(accessToken);
  const rows = await listAllSharePointItems(
    accessToken,
    env.sharePointListVozidlaId,
    {
      selectFields: vozidloSelectFields(cols),
    },
  );

  // TODO odstrániť po odladení
  console.log(
    "[fetchVozidla]",
    `items=${rows.length}`,
    rows[0]?.fields ?? null,
  );

  const items: Vozidlo[] = [];
  for (const row of rows) {
    const parsed = parseVozidloRow(row.id, row.fields, cols);
    if (!parsed || !parsed.aktivne) continue;
    items.push(parsed);
  }

  items.sort((a, b) => a.nazov.localeCompare(b.nazov, "sk"));
  return items;
}
