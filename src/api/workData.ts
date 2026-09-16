import { env } from "../config/env";
import type { TimeEntry } from "../types/workItems";
import {
  myEntriesMinDateOnly,
  todayDateOnly,
} from "../utils/dates";
import { computeEntryCena } from "../utils/pricing";
import {
  getObjednavkaColumnMap,
  parseObjednavkaRow,
} from "./objednavkaFields";
import {
  buildTimeEntryCreateFields,
  buildTimeEntryUpdateFields,
  clearTimeEntryFieldMapCache,
  formatFieldMapSummary,
  getTimeEntryFieldMap,
  getTimeEntryFieldTypes,
  parseStoredRework,
  readTimeEntryFromFields,
  validateCreatePayload,
} from "./timeEntryFields";
import { asSharePointValue } from "./listColumns";
import {
  createSharePointItem,
  listAllSharePointItems,
  updateSharePointItemFields,
} from "./sharepointClient";
import {
  getZakazkaColumnMap,
  parseZakazkaRow,
  type ParsedZakazka,
} from "./zakazkaFields";
import {
  buildPickerWorkItems,
  zakazkyLookupMap,
  type WorkCatalog,
} from "./workItemsPicker";

function asString(v: unknown): string {
  return asSharePointValue(v);
}

function asNumber(v: unknown): number {
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeDateField(v: unknown): string {
  const s = asString(v);
  if (!s) return "";
  return s.slice(0, 10);
}

export async function fetchWorkCatalog(
  accessToken: string,
): Promise<WorkCatalog> {
  const [zakCols, objCols] = await Promise.all([
    getZakazkaColumnMap(accessToken),
    getObjednavkaColumnMap(accessToken),
  ]);

  const [allZakazkyRows, objRows] = await Promise.all([
    listAllSharePointItems(accessToken, env.sharePointListZakazkyId),
    listAllSharePointItems(accessToken, env.sharePointListObjednavkyId, {
      filter: "fields/Stav ne 'Neaktivna'",
    }),
  ]);

  const zakazky: ParsedZakazka[] = [];
  for (const row of allZakazkyRows) {
    const parsed = parseZakazkaRow(row.fields, zakCols);
    if (!parsed.zakazkaId) continue;
    zakazky.push(parsed);
  }

  const objednavky = objRows.map((row) =>
    parseObjednavkaRow(row.fields, objCols),
  );

  return {
    pickerItems: buildPickerWorkItems(zakazky, objednavky),
    zakazkyById: zakazkyLookupMap(zakazky),
  };
}

export async function fetchActiveWorkItems(accessToken: string) {
  return (await fetchWorkCatalog(accessToken)).pickerItems;
}

/**
 * Moje záznamy: bez OData $filter / $select (častá príčina chýb na SP listoch).
 * Filtrovanie podľa emailu + dátumu na klientovi.
 */
export async function fetchMyTimeEntries(
  accessToken: string,
  employeeEmail: string,
): Promise<TimeEntry[]> {
  const from = myEntriesMinDateOnly();
  const today = todayDateOnly();
  const emailNorm = employeeEmail.trim().toLowerCase();

  const rows = await listAllSharePointItems(
    accessToken,
    env.sharePointListZaznamyId,
  );
  const fieldMap = await getTimeEntryFieldMap(accessToken);

  const entries: TimeEntry[] = [];
  for (const row of rows) {
    const f = readTimeEntryFromFields(fieldMap, row.fields);
    const mail = asString(f.zamestnanecEmail).toLowerCase();
    if (mail !== emailNorm) continue;
    const datum = normalizeDateField(f.datum);
    if (!datum || datum < from || datum > today) continue;

    entries.push({
      id: row.id,
      zamestnanecEmail: asString(f.zamestnanecEmail),
      datum,
      zakazkaId: asString(f.zakazkaId),
      cisloObjednavky: asString(f.cisloObjednavky),
      minuty: asNumber(f.minuty),
      ukon: asString(f.ukon),
      minutovaSadzba: asNumber(f.minutovaSadzba),
      cena: asNumber(f.cena),
      rework: parseStoredRework(f.rework),
      poznamka: asString(f.poznamka),
      casZapisu: asString(f.casZapisu),
    });
  }

  entries.sort((a, b) => {
    if (a.datum !== b.datum) return b.datum.localeCompare(a.datum);
    return b.casZapisu.localeCompare(a.casZapisu);
  });
  return entries;
}

export async function createTimeEntry(
  accessToken: string,
  input: {
    zamestnanecEmail: string;
    datum: string;
    zakazkaId: string;
    cisloObjednavky: string;
    minuty: number;
    ukon: string;
    minutovaSadzba: number;
    rework: boolean;
    poznamka: string;
  },
): Promise<void> {
  const casZapisu = new Date().toISOString();
  const cena = computeEntryCena(input.minuty, input.minutovaSadzba);
  const titleParts = [
    input.datum,
    input.zakazkaId || input.cisloObjednavky || "zaznam",
    input.ukon,
    `${input.minuty}min`,
  ];

  const fieldMap = await getTimeEntryFieldMap(accessToken);
  const fieldTypes = await getTimeEntryFieldTypes(accessToken);
  const values = {
    Title: titleParts.join(" · "),
    zamestnanecEmail: input.zamestnanecEmail,
    datum: input.datum,
    zakazkaId: input.zakazkaId,
    cisloObjednavky: input.cisloObjednavky || "",
    minuty: input.minuty,
    ukon: input.ukon,
    minutovaSadzba: input.minutovaSadzba,
    cena,
    rework: input.rework,
    poznamka: input.poznamka || "",
    casZapisu,
  };
  const fields = buildTimeEntryCreateFields(fieldMap, fieldTypes, values);

  try {
    await validateCreatePayload(
      accessToken,
      env.sharePointListZaznamyId,
      fields,
    );
    await createSharePointItem(
      accessToken,
      env.sharePointListZaznamyId,
      fields,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("not recognized") ||
      msg.includes("nepozná polia") ||
      msg.includes("HTTP 500") ||
      msg.includes("General exception")
    ) {
      clearTimeEntryFieldMapCache();
      const retryMap = await getTimeEntryFieldMap(accessToken);
      const retryTypes = await getTimeEntryFieldTypes(accessToken);
      const retryFields = buildTimeEntryCreateFields(
        retryMap,
        retryTypes,
        values,
      );
      await validateCreatePayload(
        accessToken,
        env.sharePointListZaznamyId,
        retryFields,
      );
      await createSharePointItem(
        accessToken,
        env.sharePointListZaznamyId,
        retryFields,
      );
      return;
    }
    throw new Error(
      `${msg}\nMapovanie polí: ${formatFieldMapSummary(fieldMap)}`,
    );
  }
}

export async function updateTimeEntry(
  accessToken: string,
  itemId: string,
  input: {
    datum: string;
    zakazkaId: string;
    cisloObjednavky: string;
    minuty: number;
    ukon: string;
    minutovaSadzba: number;
    rework: boolean;
    poznamka: string;
  },
): Promise<void> {
  const cena = computeEntryCena(input.minuty, input.minutovaSadzba);
  const titleParts = [
    input.datum,
    input.zakazkaId || input.cisloObjednavky || "zaznam",
    input.ukon,
    `${input.minuty}min`,
  ];

  const fieldMap = await getTimeEntryFieldMap(accessToken);
  const fieldTypes = await getTimeEntryFieldTypes(accessToken);
  const fields = buildTimeEntryUpdateFields(fieldMap, fieldTypes, {
    Title: titleParts.join(" · "),
    datum: input.datum,
    zakazkaId: input.zakazkaId,
    cisloObjednavky: input.cisloObjednavky || "",
    minuty: input.minuty,
    ukon: input.ukon,
    minutovaSadzba: input.minutovaSadzba,
    cena,
    rework: input.rework,
    poznamka: input.poznamka || "",
  });

  try {
    await updateSharePointItemFields(
      accessToken,
      env.sharePointListZaznamyId,
      itemId,
      fields,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("not recognized") ||
      msg.includes("HTTP 500") ||
      msg.includes("General exception")
    ) {
      clearTimeEntryFieldMapCache();
      const retryMap = await getTimeEntryFieldMap(accessToken);
      const retryTypes = await getTimeEntryFieldTypes(accessToken);
      const retryFields = buildTimeEntryUpdateFields(retryMap, retryTypes, {
        Title: titleParts.join(" · "),
        datum: input.datum,
        zakazkaId: input.zakazkaId,
        cisloObjednavky: input.cisloObjednavky || "",
        minuty: input.minuty,
        ukon: input.ukon,
        minutovaSadzba: input.minutovaSadzba,
        cena,
        rework: input.rework,
        poznamka: input.poznamka || "",
      });
      await updateSharePointItemFields(
        accessToken,
        env.sharePointListZaznamyId,
        itemId,
        retryFields,
      );
      return;
    }
    throw new Error(
      `${msg}\nMapovanie polí: ${formatFieldMapSummary(fieldMap)}`,
    );
  }
}
