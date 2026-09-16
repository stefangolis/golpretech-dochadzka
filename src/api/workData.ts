import { env } from "../config/env";
import type { TimeEntry } from "../types/workItems";
import {
  myEntriesMinDateOnly,
  todayDateOnly,
} from "../utils/dates";
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
  escapeODataString,
  listAllSharePointItems,
  updateSharePointItemFields,
} from "./sharepointClient";
import {
  getZakazkaColumnMap,
  parseZakazkaRow,
  type ParsedZakazka,
  type ZakazkaColumnMap,
} from "./zakazkaFields";
import {
  buildPickerWorkItems,
  zakazkaLookupKey,
  zakazkyLookupMap,
  type WorkCatalog,
  type ZakazkaLookup,
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

function zakazkaSelectFields(cols: ZakazkaColumnMap): string[] {
  const fields = [cols.title, cols.zakazkaId, cols.zakaznik, cols.stavAktivna];
  if (cols.nazov) fields.push(cols.nazov);
  return [...new Set(fields)];
}

async function fetchZakazkaByZakazkaId(
  accessToken: string,
  cols: ZakazkaColumnMap,
  zakazkaId: string,
): Promise<ParsedZakazka | null> {
  const id = zakazkaId.trim();
  if (!id) return null;
  const rows = await listAllSharePointItems(
    accessToken,
    env.sharePointListZakazkyId,
    {
      filter: `fields/${cols.zakazkaId} eq '${escapeODataString(id)}'`,
      selectFields: zakazkaSelectFields(cols),
    },
  );
  for (const row of rows) {
    const parsed = parseZakazkaRow(row.fields, cols);
    if (parsed.zakazkaId) return parsed;
  }
  return null;
}

/** Doplní lookup o zákazky zo záznamov, ktoré nie sú medzi aktívnymi. */
export async function enrichZakazkyLookupForEntries(
  accessToken: string,
  lookup: ZakazkaLookup,
  zakazkaIds: readonly string[],
): Promise<ZakazkaLookup> {
  const missing = [
    ...new Set(
      zakazkaIds
        .map((id) => id.trim())
        .filter((id) => id && !lookup[zakazkaLookupKey(id)]),
    ),
  ];
  if (missing.length === 0) return lookup;

  const cols = await getZakazkaColumnMap(accessToken);
  const next: ZakazkaLookup = { ...lookup };
  await Promise.all(
    missing.map(async (id) => {
      try {
        const parsed = await fetchZakazkaByZakazkaId(accessToken, cols, id);
        if (parsed?.zakazkaId) {
          next[zakazkaLookupKey(parsed.zakazkaId)] = parsed;
        }
      } catch {
        /* zostane kód cez formatEntryZakazkaLabel */
      }
    }),
  );
  return next;
}

export async function fetchWorkCatalog(
  accessToken: string,
): Promise<WorkCatalog> {
  const started = Date.now();
  const [zakCols, objCols] = await Promise.all([
    getZakazkaColumnMap(accessToken),
    getObjednavkaColumnMap(accessToken),
  ]);

  const [activeZakazkyRows, objRows] = await Promise.all([
    listAllSharePointItems(accessToken, env.sharePointListZakazkyId, {
      filter: `fields/${zakCols.stavAktivna} eq true`,
      selectFields: zakazkaSelectFields(zakCols),
    }),
    listAllSharePointItems(accessToken, env.sharePointListObjednavkyId, {
      filter: "fields/Stav ne 'Neaktivna'",
      selectFields: [
        objCols.title,
        objCols.zakazkaId,
        objCols.zakaznik,
        objCols.stav,
      ],
    }),
  ]);

  console.log(
    `[fetchWorkCatalog] zakazky=${activeZakazkyRows.length} objednavky=${objRows.length} ${Date.now() - started}ms`,
  );

  const zakazky: ParsedZakazka[] = [];
  for (const row of activeZakazkyRows) {
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
 * Moje záznamy: server-side filter podľa emailu a okna 7 dní.
 */
export async function fetchMyTimeEntries(
  accessToken: string,
  employeeEmail: string,
): Promise<TimeEntry[]> {
  const started = Date.now();
  const from = myEntriesMinDateOnly();
  const today = todayDateOnly();
  const emailNorm = employeeEmail.trim().toLowerCase();
  const emailEscaped = escapeODataString(employeeEmail.trim());

  const fieldMap = await getTimeEntryFieldMap(accessToken);

  const selectFields = [
    fieldMap.zamestnanecEmail,
    fieldMap.datum,
    fieldMap.zakazkaId,
    fieldMap.minuty,
    fieldMap.cisloObjednavky,
    fieldMap.ukon,
    fieldMap.rework,
    fieldMap.poznamka,
    fieldMap.casZapisu,
  ].filter((c): c is string => !!c);

  const filter = [
    `fields/${fieldMap.zamestnanecEmail} eq '${emailEscaped}'`,
    `fields/${fieldMap.datum} ge '${from}T00:00:00Z'`,
    `fields/${fieldMap.datum} le '${today}T23:59:59Z'`,
  ].join(" and ");

  const rows = await listAllSharePointItems(
    accessToken,
    env.sharePointListZaznamyId,
    { filter, selectFields },
  );

  console.log(
    `[fetchMyTimeEntries] items=${rows.length} ${Date.now() - started}ms`,
  );

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
    rework: boolean;
    poznamka: string;
  },
): Promise<void> {
  const casZapisu = new Date().toISOString();
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
    rework: boolean;
    poznamka: string;
  },
): Promise<void> {
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
    datum: input.datum,
    zakazkaId: input.zakazkaId,
    cisloObjednavky: input.cisloObjednavky || "",
    minuty: input.minuty,
    ukon: input.ukon,
    rework: input.rework,
    poznamka: input.poznamka || "",
  };
  const fields = buildTimeEntryUpdateFields(fieldMap, fieldTypes, values);

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
      const retryFields = buildTimeEntryUpdateFields(retryMap, retryTypes, values);
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
