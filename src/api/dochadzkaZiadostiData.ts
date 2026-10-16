import { env } from "../config/env";
import { cs } from "../i18n/cs";
import {
  rozdelPreZrusenie,
  smieRozhodnut,
  type ZiadostPolozkaNova,
  type ZiadostZaznam,
} from "../utils/dochadzkaZiadosti";
import {
  getDochadzkaListIds,
  normalizeIsoUtc,
  requireExactColumn,
} from "./dochadzkaFields";
import {
  asSharePointValue,
  fetchListColumns,
  fieldString,
  resolveListColumn,
  resolveListColumnExact,
} from "./listColumns";
import {
  createSharePointItem,
  escapeODataString,
  graphFetch,
  listAllSharePointItems,
  parseGraphErrorBody,
  updateSharePointItemFields,
} from "./sharepointClient";

export type ZiadostColumnMap = {
  title: string;
  zamestnanecEmail: string;
  druh: string;
  od: string;
  do: string;
  stav: string;
  castDna: string | null;
  hodiny: string | null;
  poznamka: string | null;
  schvalovatelEmail: string | null;
  schvalilEmail: string | null;
  schvalenieCas: string | null;
  dovodZamietnutia: string | null;
};

let cachedCols: ZiadostColumnMap | null = null;

export async function getZiadostColumnMap(
  accessToken: string,
): Promise<ZiadostColumnMap> {
  if (cachedCols) return cachedCols;
  const { ziadosti } = await getDochadzkaListIds(accessToken);
  const columns = await fetchListColumns(accessToken, env.sharePointSiteId, ziadosti);
  const L = "DochadzkaZiadosti";
  const map: ZiadostColumnMap = {
    title: resolveListColumn(columns, ["Title"], ["nadpis"]) ?? "Title",
    zamestnanecEmail: requireExactColumn(L, columns, ["ZamestnanecEmail"], "ZamestnanecEmail"),
    druh: requireExactColumn(L, columns, ["Druh"], "Druh"),
    od: requireExactColumn(L, columns, ["Od"], "Od"),
    do: requireExactColumn(L, columns, ["Do"], "Do"),
    stav: requireExactColumn(L, columns, ["Stav"], "Stav"),
    castDna: resolveListColumnExact(columns, ["CastDna", "Časť dňa"]),
    hodiny: resolveListColumnExact(columns, ["Hodiny"]),
    poznamka: resolveListColumnExact(columns, ["Poznamka", "Poznámka"]),
    schvalovatelEmail: resolveListColumnExact(columns, ["SchvalovatelEmail"]),
    schvalilEmail: resolveListColumnExact(columns, ["SchvalilEmail"]),
    schvalenieCas: resolveListColumnExact(columns, ["SchvalenieCas"]),
    dovodZamietnutia: resolveListColumnExact(columns, ["DovodZamietnutia"]),
  };
  if (map.od === map.do) throw new Error(cs.api.stejnySloupec(L, "Od", "Do", map.od));
  if (!map.schvalovatelEmail) throw new Error(cs.api.chybiSloupec(L, "SchvalovatelEmail"));
  cachedCols = map;
  return cachedCols;
}

function selectFields(cols: ZiadostColumnMap): string[] {
  return [
    ...new Set(
      [
        cols.title,
        cols.zamestnanecEmail,
        cols.druh,
        cols.od,
        cols.do,
        cols.stav,
        cols.castDna,
        cols.hodiny,
        cols.poznamka,
        cols.schvalovatelEmail,
        cols.schvalilEmail,
        cols.schvalenieCas,
        cols.dovodZamietnutia,
      ].filter((c): c is string => !!c),
    ),
  ];
}

function asNumberOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(asSharePointValue(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function parseZiadostRow(
  id: string,
  fields: Record<string, unknown>,
  cols: ZiadostColumnMap,
): ZiadostZaznam | null {
  const od = normalizeIsoUtc(fields[cols.od]);
  const doIso = normalizeIsoUtc(fields[cols.do]);
  const druh = fieldString(fields, cols.druh);
  if (!od || !doIso || !druh) return null;
  return {
    id,
    title: fieldString(fields, cols.title),
    zamestnanecEmail: fieldString(fields, cols.zamestnanecEmail),
    druh,
    od,
    do: doIso,
    castDna: fieldString(fields, cols.castDna),
    hodiny: cols.hodiny ? asNumberOrNull(fields[cols.hodiny]) : null,
    poznamka: fieldString(fields, cols.poznamka),
    stav: fieldString(fields, cols.stav) || "Ziadost",
    schvalovatelEmail: fieldString(fields, cols.schvalovatelEmail),
    schvalilEmail: fieldString(fields, cols.schvalilEmail),
    schvalenieCas: fieldString(fields, cols.schvalenieCas),
    dovodZamietnutia: fieldString(fields, cols.dovodZamietnutia),
  };
}

function isFilterHttpError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("HTTP 400") || msg.includes("HTTP 500");
}

async function listZiadosti(
  accessToken: string,
  filter: string,
  fallbackFilter: string,
): Promise<ZiadostZaznam[]> {
  const { ziadosti } = await getDochadzkaListIds(accessToken);
  const cols = await getZiadostColumnMap(accessToken);
  let rows: Array<{ id: string; fields: Record<string, unknown> }>;
  try {
    rows = await listAllSharePointItems(accessToken, ziadosti, {
      filter,
      selectFields: selectFields(cols),
    });
  } catch (err) {
    if (!isFilterHttpError(err)) throw err;
    rows = await listAllSharePointItems(accessToken, ziadosti, {
      filter: fallbackFilter,
      selectFields: selectFields(cols),
    });
  }
  const out: ZiadostZaznam[] = [];
  for (const r of rows) {
    const z = parseZiadostRow(r.id, r.fields, cols);
    if (z) out.push(z);
  }
  return out;
}

/** Moje žiadosti, ktoré končia od `odIso` ďalej (aj budúce). */
export async function fetchMojeZiadosti(
  accessToken: string,
  employeeEmail: string,
  odIso: string,
): Promise<ZiadostZaznam[]> {
  const cols = await getZiadostColumnMap(accessToken);
  const email = escapeODataString(employeeEmail.trim());
  const emailFilter = `fields/${cols.zamestnanecEmail} eq '${email}'`;
  const rows = await listZiadosti(
    accessToken,
    `${emailFilter} and fields/${cols.do} ge '${odIso}'`,
    emailFilter,
  );
  const ja = employeeEmail.trim().toLowerCase();
  const odMs = Date.parse(odIso);
  return rows.filter(
    (z) => z.zamestnanecEmail.toLowerCase() === ja && Date.parse(z.do) >= odMs,
  );
}

/**
 * Stav=Ziadost: pre schvaľovateľa jeho žiadosti, pre HR všetky. Vlastné len ak je žiadateľ
 * sám sebe schvaľovateľom.
 */
export async function fetchZiadostiNaSchvalenie(
  accessToken: string,
  employeeEmail: string,
  jeHR: boolean,
): Promise<ZiadostZaznam[]> {
  const cols = await getZiadostColumnMap(accessToken);
  const email = escapeODataString(employeeEmail.trim());
  const stavFilter = `fields/${cols.stav} eq 'Ziadost'`;
  const filter = jeHR
    ? stavFilter
    : `${stavFilter} and fields/${cols.schvalovatelEmail} eq '${email}'`;
  const rows = await listZiadosti(accessToken, filter, stavFilter);
  return rows.filter((z) => z.stav === "Ziadost" && smieRozhodnut(z, employeeEmail, jeHR));
}

async function fetchZiadostById(
  accessToken: string,
  itemId: string,
): Promise<ZiadostZaznam | null> {
  const { ziadosti } = await getDochadzkaListIds(accessToken);
  const cols = await getZiadostColumnMap(accessToken);
  const url = `https://graph.microsoft.com/v1.0/sites/${env.sharePointSiteId}/lists/${ziadosti}/items/${itemId}?$expand=fields($select=${selectFields(cols).join(",")})`;
  const res = await graphFetch(accessToken, url);
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`DochadzkaZiadosti HTTP ${res.status}: ${parseGraphErrorBody(body)}`);
  }
  const data = (await res.json()) as { id?: string; fields?: Record<string, unknown> };
  return data.fields ? parseZiadostRow(data.id ?? itemId, data.fields, cols) : null;
}

/** Aktuálne položky skupiny zo servera (kontrola pred zmenou stavu). */
async function nacitajAktualne(
  accessToken: string,
  ids: string[],
): Promise<ZiadostZaznam[]> {
  const out: ZiadostZaznam[] = [];
  for (const id of ids) {
    const z = await fetchZiadostById(accessToken, id);
    if (z) out.push(z);
  }
  if (!out.length) throw new Error(cs.zadosti.zruseni.nenalezena);
  return out;
}

export type NovaZiadostZapis = {
  zamestnanecEmail: string;
  schvalovatelEmail: string;
  polozky: ZiadostPolozkaNova[];
};

/**
 * Vytvorí položky žiadosti (jedna na deň). Ak niektorá zlyhá, už vytvorené sa zrušia.
 */
export async function vytvorZiadost(
  accessToken: string,
  zapis: NovaZiadostZapis,
): Promise<string[]> {
  const { ziadosti } = await getDochadzkaListIds(accessToken);
  const cols = await getZiadostColumnMap(accessToken);
  const vytvorene: string[] = [];
  try {
    for (const p of zapis.polozky) {
      const fields: Record<string, unknown> = {
        [cols.title]: p.title.slice(0, 255),
        [cols.zamestnanecEmail]: zapis.zamestnanecEmail,
        [cols.druh]: p.druh,
        [cols.od]: p.od,
        [cols.do]: p.do,
        [cols.stav]: p.stav,
      };
      if (cols.schvalovatelEmail) fields[cols.schvalovatelEmail] = zapis.schvalovatelEmail;
      if (cols.hodiny) fields[cols.hodiny] = p.hodiny;
      if (cols.castDna && p.castDna) fields[cols.castDna] = p.castDna;
      if (cols.poznamka && p.poznamka) fields[cols.poznamka] = p.poznamka;
      if (cols.schvalilEmail && p.schvalilEmail) fields[cols.schvalilEmail] = p.schvalilEmail;
      if (cols.schvalenieCas && p.schvalenieCas) fields[cols.schvalenieCas] = p.schvalenieCas;
      vytvorene.push(await createSharePointItem(accessToken, ziadosti, fields));
    }
  } catch (err) {
    for (const id of vytvorene) {
      await updateSharePointItemFields(accessToken, ziadosti, id, {
        [cols.stav]: "Zrusene",
      }).catch(() => undefined);
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(cs.zadosti.api.nelzeUlozit(msg));
  }
  return vytvorene;
}

async function nastavPolozky(
  accessToken: string,
  ids: string[],
  fields: (cols: ZiadostColumnMap) => Record<string, unknown>,
): Promise<void> {
  const { ziadosti } = await getDochadzkaListIds(accessToken);
  const cols = await getZiadostColumnMap(accessToken);
  const f = fields(cols);
  for (const id of ids) {
    await updateSharePointItemFields(accessToken, ziadosti, id, f);
  }
}

/**
 * Zruší dni vlastnej žiadosti, ktoré ešte nenastali (Stav=Zrusene). Stav sa pred zápisom
 * overí na serveri; dni, ktoré medzitým začali alebo už nie sú aktívne, ostanú bez zmeny.
 */
export async function zrusitZiadost(
  accessToken: string,
  employeeEmail: string,
  ids: string[],
): Promise<{ zrusene: number; ostava: number }> {
  const aktualne = await nacitajAktualne(accessToken, ids);
  const ja = employeeEmail.trim().toLowerCase();
  if (aktualne.some((z) => z.zamestnanecEmail.trim().toLowerCase() !== ja)) {
    throw new Error(cs.zadosti.zruseni.cizi);
  }
  const { zrusit, ostava } = rozdelPreZrusenie(aktualne, Date.now());
  if (!zrusit.length) throw new Error(cs.zadosti.zruseni.nicKZruseni);
  await nastavPolozky(
    accessToken,
    zrusit.map((z) => z.id),
    (cols) => ({ [cols.stav]: "Zrusene" }),
  );
  return { zrusene: zrusit.length, ostava: ostava.length };
}

async function overPreSchvalenie(
  accessToken: string,
  employeeEmail: string,
  jeHR: boolean,
  ids: string[],
): Promise<ZiadostZaznam[]> {
  const aktualne = await nacitajAktualne(accessToken, ids);
  const ja = employeeEmail.trim().toLowerCase();
  const nesmie = aktualne.find((z) => !smieRozhodnut(z, employeeEmail, jeHR));
  if (nesmie) {
    throw new Error(
      nesmie.zamestnanecEmail.trim().toLowerCase() === ja
        ? cs.zadosti.api.vlastniJenSamSobe
        : cs.zadosti.api.bezOpravneni,
    );
  }
  const cakajuce = aktualne.filter((z) => z.stav === "Ziadost");
  if (!cakajuce.length) throw new Error(cs.zadosti.api.uzVyrizena);
  return cakajuce;
}

export async function schvalitZiadost(
  accessToken: string,
  employeeEmail: string,
  jeHR: boolean,
  ids: string[],
): Promise<void> {
  const cakajuce = await overPreSchvalenie(accessToken, employeeEmail, jeHR, ids);
  const teraz = new Date().toISOString();
  await nastavPolozky(
    accessToken,
    cakajuce.map((z) => z.id),
    (cols) => {
      const f: Record<string, unknown> = { [cols.stav]: "Schvalene" };
      if (cols.schvalilEmail) f[cols.schvalilEmail] = employeeEmail;
      if (cols.schvalenieCas) f[cols.schvalenieCas] = teraz;
      return f;
    },
  );
}

export async function zamietnutZiadost(
  accessToken: string,
  employeeEmail: string,
  jeHR: boolean,
  ids: string[],
  dovod: string,
): Promise<void> {
  const text = dovod.trim();
  if (!text) throw new Error(cs.zadosti.api.vyplnteDuvodZamitnuti);
  const cakajuce = await overPreSchvalenie(accessToken, employeeEmail, jeHR, ids);
  const teraz = new Date().toISOString();
  await nastavPolozky(
    accessToken,
    cakajuce.map((z) => z.id),
    (cols) => {
      const f: Record<string, unknown> = { [cols.stav]: "Zamietnute" };
      if (cols.schvalilEmail) f[cols.schvalilEmail] = employeeEmail;
      if (cols.schvalenieCas) f[cols.schvalenieCas] = teraz;
      if (cols.dovodZamietnutia) f[cols.dovodZamietnutia] = text;
      return f;
    },
  );
}
