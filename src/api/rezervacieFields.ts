import { env } from "../config/env";
import { toSharePointDateTime } from "../utils/dates";
import {
  fetchListColumns,
  fieldString,
  asSharePointValue,
  resolveListColumn,
} from "./listColumns";

export type RezervaciaStav =
  | "Rezervovane"
  | "Prevzate"
  | "Vratene"
  | "Zrusene"
  | string;

export type RezervaciaColumnMap = {
  title: string;
  vozidloSpz: string;
  zamestnanecEmail: string;
  od: string;
  do: string;
  zakazkaId: string | null;
  cielCesty: string | null;
  stav: string;
  prevzatieCas: string | null;
  prevzatieKm: string | null;
  prevzatieStav: string | null;
  prevzatieVyhrada: string | null;
  odovzdanieCas: string | null;
  odovzdanieKm: string | null;
  odovzdanieStav: string | null;
  odovzdaniePoskodenie: string | null;
  najazdeneKm: string | null;
  notifManazerOdoslana: string | null;
  notifOneskorenieOdoslana: string | null;
};

export type Rezervacia = {
  id: string;
  title: string;
  vozidloSpz: string;
  zamestnanecEmail: string;
  od: string;
  do: string;
  zakazkaId: string;
  cielCesty: string;
  stav: RezervaciaStav;
  prevzatieCas: string;
  prevzatieKm: number | null;
  prevzatieStav: string;
  prevzatieVyhrada: string;
  odovzdanieCas: string;
  odovzdanieKm: number | null;
  odovzdanieStav: string;
  odovzdaniePoskodenie: string;
  najazdeneKm: number | null;
  notifManazerOdoslana: boolean;
  notifOneskorenieOdoslana: boolean;
};

let cached: RezervaciaColumnMap | null = null;

export async function getRezervaciaColumnMap(
  accessToken: string,
): Promise<RezervaciaColumnMap> {
  if (cached) return cached;
  if (!env.sharePointListRezervacieId) {
    throw new Error(
      "Chýba SHAREPOINT_LIST_REZERVACIE_ID v .env (reštartujte Expo po úprave).",
    );
  }

  const columns = await fetchListColumns(
    accessToken,
    env.sharePointSiteId,
    env.sharePointListRezervacieId,
  );

  cached = {
    title: resolveListColumn(columns, ["Title"], ["nadpis"]) ?? "Title",
    vozidloSpz:
      resolveListColumn(columns, ["VozidloSPZ", "VozidloSpz", "SPZ"], [
        "spz",
        "vozidlo",
      ]) ?? "VozidloSPZ",
    zamestnanecEmail:
      resolveListColumn(
        columns,
        ["ZamestnanecEmail", "Email", "EmployeeEmail"],
        ["email", "zamestnanec"],
      ) ?? "ZamestnanecEmail",
    od: resolveListColumn(columns, ["Od", "OdDatum", "DateFrom"], ["od"]) ?? "Od",
    do: resolveListColumn(columns, ["Do", "DoDatum", "DateTo"], ["do"]) ?? "Do",
    zakazkaId:
      resolveListColumn(columns, ["ZakazkaId", "Zakazka"], ["zakazka"]) ?? null,
    cielCesty:
      resolveListColumn(columns, ["CielCesty", "Ciel", "Destination"], [
        "ciel",
        "cieľ",
      ]) ?? null,
    stav: resolveListColumn(columns, ["Stav", "Status"], ["stav"]) ?? "Stav",
    prevzatieCas:
      resolveListColumn(columns, ["PrevzatieCas"], ["prevzatiecas"]) ?? null,
    prevzatieKm:
      resolveListColumn(columns, ["PrevzatieKm"], ["prevzatiekm"]) ?? null,
    prevzatieStav:
      resolveListColumn(columns, ["PrevzatieStav"], ["prevzatiestav"]) ?? null,
    prevzatieVyhrada:
      resolveListColumn(columns, ["PrevzatieVyhrada"], ["vyhrada"]) ?? null,
    odovzdanieCas:
      resolveListColumn(columns, ["OdovzdanieCas"], ["odovzdaniecas"]) ?? null,
    odovzdanieKm:
      resolveListColumn(columns, ["OdovzdanieKm"], ["odovzdaniekm"]) ?? null,
    odovzdanieStav:
      resolveListColumn(columns, ["OdovzdanieStav"], ["odovzdaniestav"]) ??
      null,
    odovzdaniePoskodenie:
      resolveListColumn(columns, ["OdovzdaniePoskodenie"], ["poskoden"]) ??
      null,
    najazdeneKm:
      resolveListColumn(columns, ["NajazdeneKm"], ["najazdene"]) ?? null,
    notifManazerOdoslana:
      resolveListColumn(columns, ["NotifManazerOdoslana"], ["notifmanazer"]) ??
      null,
    notifOneskorenieOdoslana:
      resolveListColumn(columns, ["NotifOneskorenieOdoslana"], [
        "notifoneskor",
      ]) ?? null,
  };
  return cached;
}

function asNumberOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(asSharePointValue(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function asBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === "1" || v === "true" || v === "Yes") return true;
  const s = asSharePointValue(v).toLowerCase();
  return s === "áno" || s === "ano" || s === "yes";
}

function normalizeDateField(v: unknown): string {
  const s = asSharePointValue(v);
  if (!s) return "";
  return s.slice(0, 10);
}

export function rezervaciaSelectFields(cols: RezervaciaColumnMap): string[] {
  const fields = [
    cols.title,
    cols.vozidloSpz,
    cols.zamestnanecEmail,
    cols.od,
    cols.do,
    cols.stav,
    cols.zakazkaId,
    cols.cielCesty,
    cols.prevzatieCas,
    cols.prevzatieKm,
    cols.prevzatieStav,
    cols.prevzatieVyhrada,
    cols.odovzdanieCas,
    cols.odovzdanieKm,
    cols.odovzdanieStav,
    cols.odovzdaniePoskodenie,
    cols.najazdeneKm,
    cols.notifManazerOdoslana,
    cols.notifOneskorenieOdoslana,
  ].filter((c): c is string => !!c);
  return [...new Set(fields)];
}

export function parseRezervaciaRow(
  id: string,
  fields: Record<string, unknown>,
  cols: RezervaciaColumnMap,
): Rezervacia | null {
  const vozidloSpz = fieldString(fields, cols.vozidloSpz);
  const od = normalizeDateField(fields[cols.od]);
  const doDate = normalizeDateField(fields[cols.do]);
  if (!vozidloSpz || !od || !doDate) return null;

  return {
    id,
    title: fieldString(fields, cols.title),
    vozidloSpz,
    zamestnanecEmail: fieldString(fields, cols.zamestnanecEmail),
    od,
    do: doDate,
    zakazkaId: cols.zakazkaId ? fieldString(fields, cols.zakazkaId) : "",
    cielCesty: cols.cielCesty ? fieldString(fields, cols.cielCesty) : "",
    stav: fieldString(fields, cols.stav) || "Rezervovane",
    prevzatieCas: cols.prevzatieCas
      ? asSharePointValue(fields[cols.prevzatieCas])
      : "",
    prevzatieKm: cols.prevzatieKm
      ? asNumberOrNull(fields[cols.prevzatieKm])
      : null,
    prevzatieStav: cols.prevzatieStav
      ? fieldString(fields, cols.prevzatieStav)
      : "",
    prevzatieVyhrada: cols.prevzatieVyhrada
      ? fieldString(fields, cols.prevzatieVyhrada)
      : "",
    odovzdanieCas: cols.odovzdanieCas
      ? asSharePointValue(fields[cols.odovzdanieCas])
      : "",
    odovzdanieKm: cols.odovzdanieKm
      ? asNumberOrNull(fields[cols.odovzdanieKm])
      : null,
    odovzdanieStav: cols.odovzdanieStav
      ? fieldString(fields, cols.odovzdanieStav)
      : "",
    odovzdaniePoskodenie: cols.odovzdaniePoskodenie
      ? fieldString(fields, cols.odovzdaniePoskodenie)
      : "",
    najazdeneKm: cols.najazdeneKm
      ? asNumberOrNull(fields[cols.najazdeneKm])
      : null,
    notifManazerOdoslana: cols.notifManazerOdoslana
      ? asBool(fields[cols.notifManazerOdoslana])
      : false,
    notifOneskorenieOdoslana: cols.notifOneskorenieOdoslana
      ? asBool(fields[cols.notifOneskorenieOdoslana])
      : false,
  };
}

/** Title: "<názov> · <d. m.>–<d. m. rrrr> · <meno>" */
export function buildRezervaciaTitle(
  nazovVozidla: string,
  od: string,
  doDate: string,
  displayName: string,
): string {
  const [oy, om, odDay] = od.split("-").map(Number);
  const [dy, dm, dd] = doDate.split("-").map(Number);
  const left = `${odDay}. ${om}.`;
  const right = `${dd}. ${dm}. ${dy}`;
  void oy;
  return `${nazovVozidla} · ${left}–${right} · ${displayName}`.slice(0, 255);
}

export function buildRezervaciaCreateFields(
  cols: RezervaciaColumnMap,
  values: {
    title: string;
    vozidloSpz: string;
    zamestnanecEmail: string;
    od: string;
    do: string;
    zakazkaId: string;
    cielCesty: string;
    stav: string;
  },
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    [cols.title]: values.title,
    [cols.vozidloSpz]: values.vozidloSpz,
    [cols.zamestnanecEmail]: values.zamestnanecEmail,
    [cols.od]: toSharePointDateTime(values.od),
    [cols.do]: toSharePointDateTime(values.do),
    [cols.stav]: values.stav,
  };
  if (cols.zakazkaId) out[cols.zakazkaId] = values.zakazkaId;
  if (cols.cielCesty) out[cols.cielCesty] = values.cielCesty;
  return out;
}
