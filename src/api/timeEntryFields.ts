import { env } from "../config/env";
import { graphFetch, parseGraphErrorBody } from "./sharepointClient";

export type TimeEntryLogicalField =
  | "zamestnanecEmail"
  | "datum"
  | "zakazkaId"
  | "cisloObjednavky"
  | "minuty"
  | "ukon"
  | "rework"
  | "poznamka"
  | "casZapisu";

export type TimeEntryFieldMap = {
  zamestnanecEmail: string;
  datum: string;
  zakazkaId: string;
  minuty: string;
} & Partial<
  Record<
    Exclude<
      TimeEntryLogicalField,
      "zamestnanecEmail" | "datum" | "zakazkaId" | "minuty"
    >,
    string
  >
>;

export type ColumnTypeKind =
  | "text"
  | "number"
  | "boolean"
  | "dateTime"
  | "choice"
  | "unknown";

export type ColumnTypeInfo = {
  kind: ColumnTypeKind;
  dateOnly?: boolean;
  /** Voľby pre stĺpec typu choice (napr. Rework) */
  choices?: string[];
};

type ColumnInfo = {
  name: string;
  displayName: string;
};

type GraphColumnRaw = ColumnInfo & {
  dateTime?: { format?: string };
  number?: unknown;
  boolean?: unknown;
  text?: unknown;
  choice?: { choices?: string[]; allowTextEntry?: boolean };
};

const LOGICAL_LABELS: Record<TimeEntryLogicalField, string> = {
  zamestnanecEmail: "ZamestnanecEmail",
  datum: "Datum",
  zakazkaId: "ZakazkaId",
  cisloObjednavky: "CisloObjednavky",
  minuty: "Minuty",
  ukon: "Ukon",
  rework: "Rework",
  poznamka: "Poznamka",
  casZapisu: "CasZapisu",
};

const PREFERRED: Record<TimeEntryLogicalField, string[]> = {
  zamestnanecEmail: [
    "ZamestnanecEmail",
    "Email",
    "E_mail",
    "Zamestnanec",
    "EmployeeEmail",
  ],
  datum: ["Datum", "Date", "Den"],
  zakazkaId: ["ZakazkaId", "Zakazka", "JobOrderId"],
  cisloObjednavky: [
    "CisloObjednavky",
    "CisloObjednavky0",
    "Objednavka",
    "OrderNumber",
  ],
  minuty: ["Minuty", "Minutes", "Min"],
  ukon: ["Ukon", "TypUkonu", "Activity"],
  rework: ["Rework"],
  poznamka: ["Poznamka", "Poznámka", "Note", "Notes"],
  casZapisu: ["CasZapisu", "Cas_zapisu", "Timestamp", "CreatedAt"],
};

const DISPLAY_HINTS: Record<TimeEntryLogicalField, string[]> = {
  zamestnanecEmail: ["email", "e-mail", "mail", "zamestnanec"],
  datum: ["datum", "dátum", "date"],
  zakazkaId: ["zakazka", "zákazka", "zakazkaid"],
  cisloObjednavky: ["objednav", "objednáv", "cislo", "číslo"],
  minuty: ["minut", "minút"],
  ukon: ["ukon", "úkon"],
  rework: ["rework"],
  poznamka: ["poznam", "poznám", "note"],
  casZapisu: ["zapis", "zápis", "cas zapis", "timestamp"],
};

const SKIP = new Set([
  "ContentType",
  "Modified",
  "Created",
  "Author",
  "Editor",
  "_UIVersionString",
  "Attachments",
  "Edit",
  "LinkTitleNoMenu",
  "LinkTitle",
  "DocIcon",
  "ItemChildCount",
  "FolderChildCount",
]);

let cachedMap: TimeEntryFieldMap | null = null;
let cachedTypes: Partial<Record<TimeEntryLogicalField, ColumnTypeInfo>> | null =
  null;
let cachedColumns: GraphColumnRaw[] | null = null;
let cachedListId: string | null = null;

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]/g, "");
}

function columnTypeInfo(col: GraphColumnRaw): ColumnTypeInfo {
  if (col.dateTime) {
    return {
      kind: "dateTime",
      dateOnly: col.dateTime.format === "dateOnly",
    };
  }
  if (col.number) return { kind: "number" };
  if (col.boolean) return { kind: "boolean" };
  if (col.choice) {
    return {
      kind: "choice",
      choices: col.choice.choices ?? [],
    };
  }
  if (col.text) return { kind: "text" };
  return { kind: "unknown" };
}

/** SharePoint Rework môže byť boolean alebo choice — appka pracuje s boolean. */
function formatReworkValue(
  rawValue: unknown,
  type?: ColumnTypeInfo,
): unknown {
  const isRework = Boolean(rawValue);
  if (!isRework) return undefined;

  if (type?.kind === "boolean") return true;

  if (type?.kind === "choice" && type.choices?.length) {
    const norm = (s: string) =>
      s
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{M}/gu, "");
    const yesLike = type.choices.find((c) => {
      const n = norm(c);
      return (
        n === "ano" ||
        n === "yes" ||
        n === "true" ||
        n === "rework" ||
        n.startsWith("volba 1")
      );
    });
    return yesLike ?? type.choices[0];
  }

  return undefined;
}

export function parseStoredRework(value: unknown): boolean {
  if (value == null || value === "") return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const s = String(value).trim().toLowerCase();
  if (["false", "0", "nie", "no", "n"].includes(s)) return false;
  return true;
}

async function fetchListDisplayName(
  accessToken: string,
  listId: string,
): Promise<string> {
  const siteId = env.sharePointSiteId;
  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}?$select=displayName`;
  const res = await graphFetch(accessToken, url);
  if (!res.ok) return listId;
  const data = (await res.json()) as { displayName?: string };
  return data.displayName?.trim() || listId;
}

async function fetchRawListColumns(
  accessToken: string,
  listId: string,
): Promise<GraphColumnRaw[]> {
  const siteId = env.sharePointSiteId;
  let url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/columns?$top=200`;
  const cols: GraphColumnRaw[] = [];

  while (url) {
    const res = await graphFetch(accessToken, url);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `SharePoint columns HTTP ${res.status}: ${parseGraphErrorBody(body)}`,
      );
    }
    const page = (await res.json()) as {
      value?: GraphColumnRaw[];
      "@odata.nextLink"?: string;
    };
    for (const col of page.value ?? []) {
      if (!col.name || SKIP.has(col.name)) continue;
      cols.push({
        name: col.name,
        displayName: col.displayName ?? col.name,
        dateTime: col.dateTime,
        number: col.number,
        boolean: col.boolean,
        text: col.text,
        choice: col.choice,
      });
    }
    url = page["@odata.nextLink"] ?? "";
  }

  return cols;
}

function resolveColumn(
  columns: ColumnInfo[],
  logical: TimeEntryLogicalField,
): string | null {
  const label = LOGICAL_LABELS[logical];
  const labelNorm = norm(label);

  for (const col of columns) {
    if (col.displayName === label || norm(col.displayName) === labelNorm) {
      return col.name;
    }
  }

  for (const preferred of PREFERRED[logical]) {
    const hit = columns.find((c) => c.name === preferred);
    if (hit) return hit.name;
  }

  const hints = DISPLAY_HINTS[logical].map(norm);
  for (const col of columns) {
    const dn = norm(col.displayName);
    const cn = norm(col.name);
    const emailField =
      logical === "zamestnanecEmail" &&
      (dn.includes("email") || dn.includes("mail") || cn.includes("email"));
    if (emailField) return col.name;
    if (
      logical !== "zamestnanecEmail" &&
      hints.some((h) => dn.includes(h) || cn.includes(h))
    ) {
      return col.name;
    }
  }

  return null;
}

function formatFieldValue(
  logical: TimeEntryLogicalField,
  value: unknown,
  type?: ColumnTypeInfo,
): unknown {
  if (value === undefined || value === null) return undefined;

  if (type?.kind === "number") {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : undefined;
  }

  if (type?.kind === "boolean") {
    return Boolean(value);
  }

  if (type?.kind === "dateTime" && typeof value === "string") {
    const datePart = value.slice(0, 10);
    if (type.dateOnly) return datePart;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return `${value}T12:00:00Z`;
    }
    return value;
  }

  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

async function ensureFieldCache(accessToken: string): Promise<void> {
  const listId = env.sharePointListZaznamyId;
  if (cachedMap && cachedTypes && cachedListId === listId) return;

  const columns = await fetchRawListColumns(accessToken, listId);
  const map = {} as Partial<TimeEntryFieldMap>;
  const types: Partial<Record<TimeEntryLogicalField, ColumnTypeInfo>> = {};
  const byName = new Map(columns.map((c) => [c.name, c]));

  for (const logical of Object.keys(PREFERRED) as TimeEntryLogicalField[]) {
    const resolved = resolveColumn(columns, logical);
    if (resolved) {
      map[logical] = resolved;
      const raw = byName.get(resolved);
      if (raw) types[logical] = columnTypeInfo(raw);
    }
  }

  const REQUIRED: TimeEntryLogicalField[] = [
    "zamestnanecEmail",
    "datum",
    "zakazkaId",
    "minuty",
  ];
  const missing = REQUIRED.filter((k) => !map[k]);

  if (missing.length > 0) {
    const available = columns
      .map((c) => `${c.displayName} (${c.name})`)
      .join(", ");
    throw new Error(
      `V zozname Casove_zaznamy chýbajú stĺpce: ${missing.join(", ")}. ` +
        `Dostupné stĺpce: ${available || "—"}`,
    );
  }

  cachedMap = map as TimeEntryFieldMap;
  cachedTypes = types;
  cachedColumns = columns;
  cachedListId = listId;
}

export function formatFieldMapSummary(map: TimeEntryFieldMap): string {
  return (Object.keys(LOGICAL_LABELS) as TimeEntryLogicalField[])
    .filter((k) => map[k])
    .map((k) => `${LOGICAL_LABELS[k]}→${map[k]}`)
    .join(", ");
}

export async function validateCreatePayload(
  accessToken: string,
  listId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const columns = await fetchRawListColumns(accessToken, listId);
  const names = new Set(columns.map((c) => c.name));
  const listTitle = await fetchListDisplayName(accessToken, listId);
  const unknown = Object.keys(fields).filter(
    (key) => key !== "Title" && !names.has(key),
  );

  if (unknown.length === 0) return;

  const available = columns
    .map((c) => `${c.displayName} [${c.name}]`)
    .join(", ");

  throw new Error(
    `Zoznam „${listTitle}“ nepozná polia: ${unknown.join(", ")}. ` +
      `Graph API interné názvy stĺpcov: ${available || "—"}`,
  );
}

export function clearTimeEntryFieldMapCache(): void {
  cachedMap = null;
  cachedTypes = null;
  cachedColumns = null;
  cachedListId = null;
}

export async function getTimeEntryFieldMap(
  accessToken: string,
): Promise<TimeEntryFieldMap> {
  await ensureFieldCache(accessToken);
  return cachedMap!;
}

export async function getTimeEntryFieldTypes(
  accessToken: string,
): Promise<Partial<Record<TimeEntryLogicalField, ColumnTypeInfo>>> {
  await ensureFieldCache(accessToken);
  return cachedTypes ?? {};
}

export function readTimeEntryFromFields(
  map: TimeEntryFieldMap,
  fields: Record<string, unknown>,
): {
  zamestnanecEmail: unknown;
  datum: unknown;
  zakazkaId: unknown;
  cisloObjednavky: unknown;
  minuty: unknown;
  ukon: unknown;
  rework: unknown;
  poznamka: unknown;
  casZapisu: unknown;
} {
  return {
    zamestnanecEmail: fields[map.zamestnanecEmail],
    datum: fields[map.datum],
    zakazkaId: fields[map.zakazkaId],
    cisloObjednavky: map.cisloObjednavky
      ? fields[map.cisloObjednavky]
      : undefined,
    minuty: fields[map.minuty],
    ukon: map.ukon ? fields[map.ukon] : undefined,
    rework: map.rework ? fields[map.rework] : undefined,
    poznamka: map.poznamka ? fields[map.poznamka] : undefined,
    casZapisu: map.casZapisu ? fields[map.casZapisu] : undefined,
  };
}

export function buildTimeEntryCreateFields(
  map: TimeEntryFieldMap,
  types: Partial<Record<TimeEntryLogicalField, ColumnTypeInfo>>,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const title = String(values.Title ?? "").slice(0, 255);
  const out: Record<string, unknown> = { Title: title };

  const pairs: Array<[TimeEntryLogicalField, unknown]> = [
    ["zamestnanecEmail", values.zamestnanecEmail],
    ["datum", values.datum],
    ["zakazkaId", values.zakazkaId],
    ["cisloObjednavky", values.cisloObjednavky],
    ["minuty", values.minuty],
    ["ukon", values.ukon],
    ["rework", values.rework],
    ["poznamka", values.poznamka],
    ["casZapisu", values.casZapisu],
  ];

  for (const [logical, rawValue] of pairs) {
    const col = map[logical];
    if (!col) continue;

    if (logical === "rework") {
      const formatted = formatReworkValue(rawValue, types[logical]);
      if (formatted === undefined) continue;
      out[col] = formatted;
      continue;
    }

    if (
      typeof rawValue === "string" &&
      rawValue.trim() === "" &&
      logical !== "poznamka"
    ) {
      continue;
    }

    const formatted = formatFieldValue(logical, rawValue, types[logical]);
    if (formatted === undefined) continue;
    out[col] = formatted;
  }

  return out;
}

export function buildTimeEntryUpdateFields(
  map: TimeEntryFieldMap,
  types: Partial<Record<TimeEntryLogicalField, ColumnTypeInfo>>,
  values: {
    Title: string;
    datum: string;
    zakazkaId: string;
    cisloObjednavky: string;
    minuty: number;
    ukon: string;
    rework: boolean;
    poznamka: string;
  },
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    Title: String(values.Title).slice(0, 255),
  };

  const pairs: Array<[TimeEntryLogicalField, unknown]> = [
    ["datum", values.datum],
    ["zakazkaId", values.zakazkaId],
    ["cisloObjednavky", values.cisloObjednavky],
    ["minuty", values.minuty],
    ["ukon", values.ukon],
    ["rework", values.rework],
    ["poznamka", values.poznamka],
  ];

  for (const [logical, rawValue] of pairs) {
    const col = map[logical];
    if (!col) continue;

    if (logical === "rework") {
      if (!Boolean(rawValue)) {
        out[col] = null;
      } else {
        const formatted = formatReworkValue(rawValue, types[logical]);
        if (formatted !== undefined) out[col] = formatted;
      }
      continue;
    }

    if (logical === "cisloObjednavky") {
      const cislo =
        typeof rawValue === "string" ? rawValue.trim() : String(rawValue ?? "");
      out[col] = cislo;
      continue;
    }

    const formatted = formatFieldValue(logical, rawValue, types[logical]);
    if (formatted === undefined) continue;
    out[col] = formatted;
  }

  return out;
}
