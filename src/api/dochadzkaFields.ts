import { cs } from "../i18n/cs";
import { env } from "../config/env";
import {
  pragueDateKey,
  type DochadzkaTyp,
} from "../utils/dochadzkaVypocet";
import {
  fetchListColumns,
  fieldString,
  resolveListColumn,
  resolveListColumnExact,
  type ListColumnInfo,
} from "./listColumns";
import { graphFetch, parseGraphErrorBody } from "./sharepointClient";

export type DochadzkaZdroj = "NFC" | "Mobil" | "Oprava";

export type DochadzkaListIds = {
  udalosti: string;
  nfcTagy: string;
  opravnenia: string;
  ziadosti: string;
};

const LIST_SOURCES: Array<{
  key: keyof DochadzkaListIds;
  envName: string;
  displayName: string;
  fromEnv: () => string;
}> = [
  {
    key: "udalosti",
    envName: "SHAREPOINT_LIST_DOCHADZKA_UDALOSTI_ID",
    displayName: "DochadzkaUdalosti",
    fromEnv: () => env.sharePointListDochadzkaUdalostiId,
  },
  {
    key: "nfcTagy",
    envName: "SHAREPOINT_LIST_DOCHADZKA_NFC_TAGY_ID",
    displayName: "DochadzkaNfcTagy",
    fromEnv: () => env.sharePointListDochadzkaNfcTagyId,
  },
  {
    key: "opravnenia",
    envName: "SHAREPOINT_LIST_DOCHADZKA_OPRAVNENIA_ID",
    displayName: "DochadzkaOpravnenia",
    fromEnv: () => env.sharePointListDochadzkaOpravneniaId,
  },
  {
    key: "ziadosti",
    envName: "SHAREPOINT_LIST_DOCHADZKA_ZIADOSTI_ID",
    displayName: "DochadzkaZiadosti",
    fromEnv: () => env.sharePointListDochadzkaZiadostiId,
  },
];

let cachedListIds: DochadzkaListIds | null = null;

async function fetchSiteLists(
  accessToken: string,
): Promise<Array<{ id: string; displayName: string; name: string }>> {
  let url = `https://graph.microsoft.com/v1.0/sites/${env.sharePointSiteId}/lists?$select=id,displayName,name`;
  const out: Array<{ id: string; displayName: string; name: string }> = [];
  while (url) {
    const res = await graphFetch(accessToken, url);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `SharePoint lists HTTP ${res.status}: ${parseGraphErrorBody(body)}`,
      );
    }
    const page = (await res.json()) as {
      value?: Array<{ id?: string; displayName?: string; name?: string }>;
      "@odata.nextLink"?: string;
    };
    for (const l of page.value ?? []) {
      if (!l.id) continue;
      out.push({ id: l.id, displayName: l.displayName ?? "", name: l.name ?? "" });
    }
    url = page["@odata.nextLink"] ?? "";
  }
  return out;
}

/**
 * ID zoznamov dochádzky z env; chýbajúce dohľadá podľa názvu zoznamu a vypíše do konzoly.
 */
export async function getDochadzkaListIds(
  accessToken: string,
): Promise<DochadzkaListIds> {
  if (cachedListIds) return cachedListIds;
  if (!env.sharePointSiteId) {
    throw new Error(cs.sharepoint.chybiSiteId);
  }

  const ids: Partial<DochadzkaListIds> = {};
  const missing = LIST_SOURCES.filter((s) => {
    const v = s.fromEnv();
    if (v) ids[s.key] = v;
    return !v;
  });

  if (missing.length) {
    const lists = await fetchSiteLists(accessToken);
    for (const s of missing) {
      const want = s.displayName.toLowerCase();
      const found = lists.find(
        (l) =>
          l.displayName.toLowerCase() === want || l.name.toLowerCase() === want,
      );
      if (!found) {
        throw new Error(cs.sharepoint.chybiSeznam(s.envName, s.displayName));
      }
      console.log(
        `[dochadzka] ${s.envName} chýba v konfigurácii — nájdený zoznam ${s.displayName}: ${found.id}`,
      );
      ids[s.key] = found.id;
    }
  }

  cachedListIds = ids as DochadzkaListIds;
  return cachedListIds;
}

export function requireExactColumn(
  listName: string,
  columns: ListColumnInfo[],
  names: string[],
  label: string,
): string {
  const resolved = resolveListColumnExact(columns, names);
  if (!resolved) {
    const available =
      columns.map((c) => `${c.displayName} (${c.name})`).join(", ") || "—";
    throw new Error(
      cs.sharepoint.chybiSloupecDostupne(listName, label, available),
    );
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// DochadzkaUdalosti

export type UdalostColumnMap = {
  title: string;
  zamestnanecEmail: string;
  typ: string;
  cas: string;
  zdroj: string;
  tagId: string | null;
  poloha: string | null;
  offline: string | null;
  poznamka: string | null;
  stav: string;
};

export type DochadzkaUdalost = {
  id: string;
  zamestnanecEmail: string;
  typ: DochadzkaTyp | string;
  /** ISO UTC */
  cas: string;
  zdroj: string;
  tagId: string;
  poloha: string;
  offline: boolean;
  poznamka: string;
  stav: string;
};

let cachedUdalostCols: UdalostColumnMap | null = null;

export async function getUdalostColumnMap(
  accessToken: string,
): Promise<UdalostColumnMap> {
  if (cachedUdalostCols) return cachedUdalostCols;
  const { udalosti } = await getDochadzkaListIds(accessToken);
  const columns = await fetchListColumns(
    accessToken,
    env.sharePointSiteId,
    udalosti,
  );
  const L = "DochadzkaUdalosti";

  const map: UdalostColumnMap = {
    title: resolveListColumn(columns, ["Title"], ["nadpis"]) ?? "Title",
    zamestnanecEmail: requireExactColumn(
      L,
      columns,
      ["ZamestnanecEmail", "Zamestnanec email"],
      "ZamestnanecEmail",
    ),
    // Systémový stĺpec Typ / ContentType sa nesmie použiť — len Typ1 (interne _x0054_yp1).
    typ: requireExactColumn(
      L,
      columns,
      ["_x0054_yp1", "Typ1", "TypUdalosti", "Typ udalosti"],
      "Typ1",
    ),
    cas: requireExactColumn(L, columns, ["Cas", "Čas"], "Cas"),
    zdroj: requireExactColumn(L, columns, ["Zdroj"], "Zdroj"),
    tagId: resolveListColumnExact(columns, ["TagId", "TagID"]),
    poloha: resolveListColumnExact(columns, ["Poloha"]),
    offline: resolveListColumnExact(columns, ["Offline"]),
    poznamka: resolveListColumnExact(columns, ["Poznamka", "Poznámka"]),
    stav: requireExactColumn(L, columns, ["Stav"], "Stav"),
  };

  if (map.typ === "ContentType" || map.typ === "Typ") {
    throw new Error(cs.api.typ1Systemovy);
  }

  cachedUdalostCols = map;
  return cachedUdalostCols;
}

export function udalostSelectFields(cols: UdalostColumnMap): string[] {
  return [
    ...new Set(
      [
        cols.zamestnanecEmail,
        cols.typ,
        cols.cas,
        cols.zdroj,
        cols.tagId,
        cols.poloha,
        cols.offline,
        cols.poznamka,
        cols.stav,
      ].filter((c): c is string => !!c),
    ),
  ];
}

export function normalizeIsoUtc(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : "";
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : "";
}

export function parseUdalostRow(
  id: string,
  fields: Record<string, unknown>,
  cols: UdalostColumnMap,
): DochadzkaUdalost | null {
  const cas = normalizeIsoUtc(fields[cols.cas]);
  const typ = fieldString(fields, cols.typ);
  if (!cas || !typ) return null;
  return {
    id,
    zamestnanecEmail: fieldString(fields, cols.zamestnanecEmail),
    typ,
    cas,
    zdroj: fieldString(fields, cols.zdroj),
    tagId: fieldString(fields, cols.tagId),
    poloha: fieldString(fields, cols.poloha),
    offline: fieldString(fields, cols.offline).toLowerCase() === "ano",
    poznamka: fieldString(fields, cols.poznamka),
    stav: fieldString(fields, cols.stav) || "Platna",
  };
}

/** Title: "2026-10-01 · Prichod · meno" (dátum v Europe/Prague) */
export function buildUdalostTitle(
  casIso: string,
  typ: string,
  displayName: string,
): string {
  return `${pragueDateKey(casIso)} · ${typ} · ${displayName}`.slice(0, 255);
}

export type NovaUdalost = {
  zamestnanecEmail: string;
  displayName: string;
  typ: DochadzkaTyp;
  /** ISO UTC — čas ťuknutia / potvrdenia na zariadení */
  cas: string;
  zdroj: DochadzkaZdroj;
  tagId: string | null;
  poloha: string | null;
  offline: boolean;
};

export function buildUdalostCreateFields(
  cols: UdalostColumnMap,
  u: NovaUdalost,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    [cols.title]: buildUdalostTitle(u.cas, u.typ, u.displayName),
    [cols.zamestnanecEmail]: u.zamestnanecEmail,
    [cols.typ]: u.typ,
    [cols.cas]: u.cas,
    [cols.zdroj]: u.zdroj,
    [cols.stav]: "Platna",
  };
  if (cols.offline) out[cols.offline] = u.offline ? "Ano" : "Nie";
  if (cols.tagId && u.tagId) out[cols.tagId] = u.tagId;
  if (cols.poloha && u.poloha) out[cols.poloha] = u.poloha;
  return out;
}

// ---------------------------------------------------------------------------
// DochadzkaNfcTagy

export type NfcTagColumnMap = {
  title: string;
  tagUid: string;
  umiestnenie: string | null;
  aktivny: string | null;
};

let cachedNfcTagCols: NfcTagColumnMap | null = null;

export async function getNfcTagColumnMap(
  accessToken: string,
): Promise<NfcTagColumnMap> {
  if (cachedNfcTagCols) return cachedNfcTagCols;
  const { nfcTagy } = await getDochadzkaListIds(accessToken);
  const columns = await fetchListColumns(
    accessToken,
    env.sharePointSiteId,
    nfcTagy,
  );
  cachedNfcTagCols = {
    title: resolveListColumn(columns, ["Title"], ["nadpis"]) ?? "Title",
    tagUid: requireExactColumn(
      "DochadzkaNfcTagy",
      columns,
      ["TagUID", "TagUid", "UID"],
      "TagUID",
    ),
    umiestnenie: resolveListColumnExact(columns, ["Umiestnenie"]),
    // V SharePointe je stĺpec pomenovaný "Activny" (preklep), akceptujeme oba.
    aktivny: resolveListColumnExact(columns, ["Aktivny", "Activny", "Aktívny"]),
  };
  return cachedNfcTagCols;
}

// ---------------------------------------------------------------------------
// DochadzkaOpravnenia

export type OpravnenieColumnMap = {
  email: string;
  zapisBezNalepky: string;
  nadriadenyEmail: string | null;
  jeHR: string | null;
  dennyFondHod: string | null;
  dovolenkaZostatokHod: string | null;
  prescasZostatokHod: string | null;
  stavKDatumu: string | null;
};

let cachedOpravnenieCols: OpravnenieColumnMap | null = null;

export async function getOpravnenieColumnMap(
  accessToken: string,
): Promise<OpravnenieColumnMap> {
  if (cachedOpravnenieCols) return cachedOpravnenieCols;
  const { opravnenia } = await getDochadzkaListIds(accessToken);
  const columns = await fetchListColumns(
    accessToken,
    env.sharePointSiteId,
    opravnenia,
  );
  const L = "DochadzkaOpravnenia";
  cachedOpravnenieCols = {
    email: requireExactColumn(L, columns, ["Email", "E-mail"], "Email"),
    zapisBezNalepky: requireExactColumn(
      L,
      columns,
      ["ZapisBezNalepky", "Zápis bez nálepky"],
      "ZapisBezNalepky",
    ),
    nadriadenyEmail: resolveListColumnExact(columns, [
      "NadriadenyEmail",
      "Nadriadený email",
    ]),
    jeHR: resolveListColumnExact(columns, ["JeHR", "HR"]),
    dennyFondHod: resolveListColumnExact(columns, [
      "DennyFondHod",
      "Denný fond hod",
      "DennyFond",
    ]),
    dovolenkaZostatokHod: resolveListColumnExact(columns, ["DovolenkaZostatokHod"]),
    prescasZostatokHod: resolveListColumnExact(columns, ["PrescasZostatokHod"]),
    stavKDatumu: resolveListColumnExact(columns, ["StavKDatumu"]),
  };
  return cachedOpravnenieCols;
}
