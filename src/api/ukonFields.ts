import { env } from "../config/env";
import { FALLBACK_UKONY } from "../constants/ukon";
import type { UkonItem } from "../types/ukon";
import {
  fetchListColumns,
  fieldString,
  asSharePointValue,
  asSharePointYesNo,
  resolveListColumn,
} from "./listColumns";
import { listAllSharePointItems } from "./sharepointClient";

export type UkonColumnMap = {
  title: string;
  minutovaSadzba: string;
  aktivny: string | null;
};

let cached: UkonColumnMap | null = null;

export async function getUkonColumnMap(
  accessToken: string,
): Promise<UkonColumnMap> {
  if (cached) return cached;
  if (!env.sharePointListUkonyId) {
    return {
      title: "Title",
      minutovaSadzba: "MinutovaSadzba",
      aktivny: null,
    };
  }

  const columns = await fetchListColumns(
    accessToken,
    env.sharePointSiteId,
    env.sharePointListUkonyId,
  );

  cached = {
    title: resolveListColumn(columns, ["Title"], ["nadpis", "nazov"]) ?? "Title",
    minutovaSadzba:
      resolveListColumn(
        columns,
        [
          "MinutovaSadzba",
          "Minutova_sadzba",
          "SadzbaZaMinutu",
          "Sadzba",
        ],
        ["sadzba", "minutova", "minútová"],
      ) ?? "MinutovaSadzba",
    aktivny:
      resolveListColumn(columns, ["Aktivny", "StavAktivna"], ["aktiv"]) ??
      null,
  };
  return cached;
}

function asNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(asSharePointValue(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function buildUkonItem(
  id: string,
  nazov: string,
  minutovaSadzba: number,
): UkonItem {
  return {
    id,
    nazov,
    minutovaSadzba,
    label: nazov,
  };
}

export async function fetchUkony(accessToken: string): Promise<UkonItem[]> {
  if (!env.sharePointListUkonyId) {
    return FALLBACK_UKONY.map((u, i) =>
      buildUkonItem(`fallback:${i}`, u.nazov, u.minutovaSadzba),
    );
  }

  const cols = await getUkonColumnMap(accessToken);
  const selectFields = [cols.title, cols.minutovaSadzba];
  if (cols.aktivny) selectFields.push(cols.aktivny);

  const rows = await listAllSharePointItems(
    accessToken,
    env.sharePointListUkonyId,
    { selectFields },
  );

  const items: UkonItem[] = [];
  for (const row of rows) {
    const f = row.fields;
    const nazov = fieldString(f, cols.title);
    if (!nazov) continue;

    if (cols.aktivny && !asSharePointYesNo(f[cols.aktivny])) continue;

    const minutovaSadzba = asNumber(f[cols.minutovaSadzba]);
    items.push(buildUkonItem(row.id, nazov, minutovaSadzba));
  }

  items.sort((a, b) => a.nazov.localeCompare(b.nazov, "sk"));
  return items;
}

export function findUkonByNazov(
  ukony: UkonItem[],
  nazov: string | null | undefined,
): UkonItem | null {
  if (!nazov) return null;
  const norm = nazov.trim().toLowerCase();
  return ukony.find((u) => u.nazov.trim().toLowerCase() === norm) ?? null;
}
