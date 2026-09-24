import { env } from "../config/env";
import {
  daysAgoDateOnly,
  toSharePointDateTime,
  todayDateOnly,
} from "../utils/dates";
import {
  createSharePointItem,
  escapeODataString,
  fetchListDisplayName,
  listAllSharePointItems,
  updateSharePointItemFields,
} from "./sharepointClient";
import { jeAktivnaRezervacia } from "../utils/rezervacie";
import { fetchListColumnChoices, type ListColumnChoiceInfo } from "./listColumns";
import {
  buildRezervaciaCreateFields,
  buildRezervaciaTitle,
  getRezervaciaColumnMap,
  parseRezervaciaRow,
  rezervaciaSelectFields,
  type Rezervacia,
  type RezervaciaColumnMap,
} from "./rezervacieFields";

let listsVerified = false;

function assertVozidlaEnv(): void {
  if (!env.sharePointListVozidlaId || !env.sharePointListRezervacieId) {
    throw new Error(
      "Chýbajú SHAREPOINT_LIST_VOZIDLA_ID alebo SHAREPOINT_LIST_REZERVACIE_ID v .env (reštartujte Expo po úprave).",
    );
  }
}

/**
 * Overí, že VOZIDLA_ID = "Vozidla" a REZERVACIE_ID = "Rezervacie".
 * Pri prehodených ID vyhodí zrozumiteľnú chybu.
 */
export async function verifyVozidlaListIds(
  accessToken: string,
): Promise<void> {
  if (listsVerified) return;
  assertVozidlaEnv();

  const [vozidlaName, rezervacieName] = await Promise.all([
    fetchListDisplayName(accessToken, env.sharePointListVozidlaId),
    fetchListDisplayName(accessToken, env.sharePointListRezervacieId),
  ]);

  const vozidlaOk = vozidlaName.toLowerCase() === "vozidla";
  const rezervacieOk = rezervacieName.toLowerCase() === "rezervacie";

  if (!vozidlaOk || !rezervacieOk) {
    throw new Error(
      "Zoznamy vozidiel/rezervácií v .env pravdepodobne nemajú správne ID. " +
        `SHAREPOINT_LIST_VOZIDLA_ID → „${vozidlaName}“ (očakávané: Vozidla), ` +
        `SHAREPOINT_LIST_REZERVACIE_ID → „${rezervacieName}“ (očakávané: Rezervacie). ` +
        "Vymeňte hodnoty v .env a reštartujte Expo.",
    );
  }

  listsVerified = true;
}

function parseRows(
  rows: Array<{ id: string; fields: Record<string, unknown> }>,
  cols: RezervaciaColumnMap,
): Rezervacia[] {
  const items: Rezervacia[] = [];
  for (const row of rows) {
    const parsed = parseRezervaciaRow(row.id, row.fields, cols);
    if (!parsed || !jeAktivnaRezervacia(parsed)) continue;
    items.push(parsed);
  }
  return items;
}

function mergeById(...groups: Rezervacia[][]): Rezervacia[] {
  const map = new Map<string, Rezervacia>();
  for (const group of groups) {
    for (const r of group) map.set(r.id, r);
  }
  return [...map.values()];
}

/** Prevzaté rezervácie bez ohľadu na Do (neodovzdané po termíne blokujú vozidlo). */
async function fetchPrevzateRows(
  accessToken: string,
  cols: RezervaciaColumnMap,
  extraFilter?: string,
): Promise<Rezervacia[]> {
  const filter = [`fields/${cols.stav} eq 'Prevzate'`, extraFilter]
    .filter(Boolean)
    .join(" and ");
  const rows = await listAllSharePointItems(
    accessToken,
    env.sharePointListRezervacieId,
    { filter, selectFields: rezervaciaSelectFields(cols) },
  );
  return parseRows(rows, cols);
}

export async function fetchRezervacieVRozsahu(
  accessToken: string,
  odDate: string,
  doDate: string,
): Promise<Rezervacia[]> {
  await verifyVozidlaListIds(accessToken);
  const cols = await getRezervaciaColumnMap(accessToken);

  const filter = [
    `fields/${cols.stav} ne 'Zrusene'`,
    `fields/${cols.stav} ne 'Vratene'`,
    `fields/${cols.do} ge '${odDate}T00:00:00Z'`,
    `fields/${cols.od} le '${doDate}T23:59:59Z'`,
  ].join(" and ");

  const [rows, prevzate] = await Promise.all([
    listAllSharePointItems(accessToken, env.sharePointListRezervacieId, {
      filter,
      selectFields: rezervaciaSelectFields(cols),
    }),
    fetchPrevzateRows(accessToken, cols),
  ]);

  const items = mergeById(
    parseRows(rows, cols),
    prevzate.filter((r) => r.od <= doDate),
  );

  items.sort((a, b) => {
    if (a.od !== b.od) return a.od.localeCompare(b.od);
    return a.vozidloSpz.localeCompare(b.vozidloSpz, "sk");
  });
  return items;
}

export async function fetchMojeRezervacie(
  accessToken: string,
  employeeEmail: string,
): Promise<Rezervacia[]> {
  await verifyVozidlaListIds(accessToken);
  const cols = await getRezervaciaColumnMap(accessToken);
  const from = daysAgoDateOnly(1);
  const emailEscaped = escapeODataString(employeeEmail.trim());
  const emailNorm = employeeEmail.trim().toLowerCase();

  const emailFilter = `fields/${cols.zamestnanecEmail} eq '${emailEscaped}'`;
  const filter = [
    emailFilter,
    `fields/${cols.stav} ne 'Zrusene'`,
    `fields/${cols.stav} ne 'Vratene'`,
    `fields/${cols.do} ge '${from}T00:00:00Z'`,
  ].join(" and ");

  const [rows, prevzate] = await Promise.all([
    listAllSharePointItems(accessToken, env.sharePointListRezervacieId, {
      filter,
      selectFields: rezervaciaSelectFields(cols),
    }),
    fetchPrevzateRows(accessToken, cols, emailFilter),
  ]);

  const items = mergeById(parseRows(rows, cols), prevzate).filter(
    (r) => r.zamestnanecEmail.trim().toLowerCase() === emailNorm,
  );

  items.sort((a, b) => {
    if (a.od !== b.od) return a.od.localeCompare(b.od);
    return a.do.localeCompare(b.do);
  });
  return items;
}

export async function createRezervacia(
  accessToken: string,
  input: {
    nazovVozidla: string;
    vozidloSpz: string;
    zamestnanecEmail: string;
    displayName: string;
    od: string;
    do: string;
    zakazkaId: string;
    cielCesty: string;
  },
): Promise<string> {
  await verifyVozidlaListIds(accessToken);
  const cols = await getRezervaciaColumnMap(accessToken);
  const title = buildRezervaciaTitle(
    input.nazovVozidla,
    input.od,
    input.do,
    input.displayName,
  );
  const fields = buildRezervaciaCreateFields(cols, {
    title,
    vozidloSpz: input.vozidloSpz,
    zamestnanecEmail: input.zamestnanecEmail,
    od: input.od,
    do: input.do,
    zakazkaId: input.zakazkaId,
    cielCesty: input.cielCesty,
    stav: "Rezervovane",
  });

  return createSharePointItem(
    accessToken,
    env.sharePointListRezervacieId,
    fields,
  );
}

export async function zrusitRezervaciu(
  accessToken: string,
  itemId: string,
): Promise<void> {
  await verifyVozidlaListIds(accessToken);
  const cols = await getRezervaciaColumnMap(accessToken);
  await updateSharePointItemFields(
    accessToken,
    env.sharePointListRezervacieId,
    itemId,
    { [cols.stav]: "Zrusene" },
  );
}

/** Úprava nezačatej rezervácie: termín, zákazka, cieľ cesty (vozidlo sa nemení). */
export async function upravitRezervaciu(
  accessToken: string,
  itemId: string,
  input: {
    nazovVozidla: string;
    displayName: string;
    od: string;
    do: string;
    zakazkaId: string;
    cielCesty: string;
  },
): Promise<void> {
  await verifyVozidlaListIds(accessToken);
  const cols = await getRezervaciaColumnMap(accessToken);
  const title = buildRezervaciaTitle(
    input.nazovVozidla,
    input.od,
    input.do,
    input.displayName,
  );
  const fields: Record<string, unknown> = {
    [cols.od]: toSharePointDateTime(input.od),
    [cols.do]: toSharePointDateTime(input.do),
    [cols.title]: title,
  };
  if (cols.zakazkaId) fields[cols.zakazkaId] = input.zakazkaId.trim();
  if (cols.cielCesty) fields[cols.cielCesty] = input.cielCesty.trim();
  await updateSharePointItemFields(
    accessToken,
    env.sharePointListRezervacieId,
    itemId,
    fields,
  );
}

/** Zmena konca (predĺženie, skrátenie, odovzdanie skôr). Od sa nezapisuje. */
export async function zmenitKoniecRezervacie(
  accessToken: string,
  itemId: string,
  input: {
    noveDo: string;
    nazovVozidla: string;
    od: string;
    displayName: string;
  },
): Promise<void> {
  await verifyVozidlaListIds(accessToken);
  const cols = await getRezervaciaColumnMap(accessToken);
  const title = buildRezervaciaTitle(
    input.nazovVozidla,
    input.od,
    input.noveDo,
    input.displayName,
  );
  await updateSharePointItemFields(
    accessToken,
    env.sharePointListRezervacieId,
    itemId,
    {
      [cols.do]: toSharePointDateTime(input.noveDo),
      [cols.title]: title,
    },
  );
}

let choicesCache: Map<string, ListColumnChoiceInfo> | null = null;

function requireCol(column: string | null, label: string): string {
  if (!column) {
    throw new Error(`V zozname Rezervacie chýba stĺpec ${label}.`);
  }
  return column;
}

/**
 * Ak je stĺpec typu Voľba, overí, že zapisovaná hodnota je medzi povolenými.
 * Volá sa pred nahrávaním fotiek, aby sa nič nenahralo zbytočne.
 */
async function overitHodnotyVolieb(
  accessToken: string,
  values: Array<{ column: string; value: string }>,
): Promise<void> {
  if (!choicesCache) {
    choicesCache = await fetchListColumnChoices(
      accessToken,
      env.sharePointSiteId,
      env.sharePointListRezervacieId,
    );
  }
  for (const { column, value } of values) {
    const info = choicesCache.get(column);
    if (!info?.choices) continue;
    if (info.choices.includes(value)) continue;
    throw new Error(
      `Stĺpec „${info.displayName}“ (${column}) v zozname Rezervacie nepovoľuje hodnotu „${value}“. ` +
        `Povolené hodnoty: ${info.choices.join(", ") || "—"}.`,
    );
  }
}

export type PrevzatieInput = {
  km: number;
  prevzatieStav: string;
  vyhrada: string;
};

export async function overitPrevzatie(
  accessToken: string,
  input: Pick<PrevzatieInput, "prevzatieStav">,
): Promise<void> {
  await verifyVozidlaListIds(accessToken);
  const cols = await getRezervaciaColumnMap(accessToken);
  requireCol(cols.prevzatieCas, "PrevzatieCas");
  requireCol(cols.prevzatieKm, "PrevzatieKm");
  requireCol(cols.prevzatieVyhrada, "PrevzatieVyhrada");
  await overitHodnotyVolieb(accessToken, [
    { column: cols.stav, value: "Prevzate" },
    {
      column: requireCol(cols.prevzatieStav, "PrevzatieStav"),
      value: input.prevzatieStav,
    },
  ]);
}

export async function prevziatRezervaciu(
  accessToken: string,
  itemId: string,
  input: PrevzatieInput,
): Promise<void> {
  await verifyVozidlaListIds(accessToken);
  const cols = await getRezervaciaColumnMap(accessToken);
  await updateSharePointItemFields(
    accessToken,
    env.sharePointListRezervacieId,
    itemId,
    {
      [requireCol(cols.prevzatieCas, "PrevzatieCas")]: new Date().toISOString(),
      [requireCol(cols.prevzatieKm, "PrevzatieKm")]: input.km,
      [requireCol(cols.prevzatieStav, "PrevzatieStav")]: input.prevzatieStav,
      [requireCol(cols.prevzatieVyhrada, "PrevzatieVyhrada")]:
        input.vyhrada.trim(),
      [cols.stav]: "Prevzate",
    },
  );
}

export type OdovzdanieInput = {
  km: number;
  odovzdanieStav: string;
  poskodenie: string;
  najazdeneKm: number | null;
  /** Skoršie odovzdanie: nové Do (dnes) + prepočítaný Title. */
  skrateneDo?: { noveDo: string; title: string };
};

export async function overitOdovzdanie(
  accessToken: string,
  input: Pick<OdovzdanieInput, "odovzdanieStav">,
): Promise<void> {
  await verifyVozidlaListIds(accessToken);
  const cols = await getRezervaciaColumnMap(accessToken);
  requireCol(cols.odovzdanieCas, "OdovzdanieCas");
  requireCol(cols.odovzdanieKm, "OdovzdanieKm");
  requireCol(cols.odovzdaniePoskodenie, "OdovzdaniePoskodenie");
  requireCol(cols.najazdeneKm, "NajazdeneKm");
  await overitHodnotyVolieb(accessToken, [
    { column: cols.stav, value: "Vratene" },
    {
      column: requireCol(cols.odovzdanieStav, "OdovzdanieStav"),
      value: input.odovzdanieStav,
    },
  ]);
}

export async function odovzdatRezervaciu(
  accessToken: string,
  itemId: string,
  input: OdovzdanieInput,
): Promise<void> {
  await verifyVozidlaListIds(accessToken);
  const cols = await getRezervaciaColumnMap(accessToken);
  const fields: Record<string, unknown> = {
    [requireCol(cols.odovzdanieCas, "OdovzdanieCas")]: new Date().toISOString(),
    [requireCol(cols.odovzdanieKm, "OdovzdanieKm")]: input.km,
    [requireCol(cols.odovzdanieStav, "OdovzdanieStav")]: input.odovzdanieStav,
    [requireCol(cols.odovzdaniePoskodenie, "OdovzdaniePoskodenie")]:
      input.poskodenie.trim(),
    [requireCol(cols.najazdeneKm, "NajazdeneKm")]: input.najazdeneKm,
    [cols.stav]: "Vratene",
  };
  if (input.skrateneDo) {
    fields[cols.do] = toSharePointDateTime(input.skrateneDo.noveDo);
    fields[cols.title] = input.skrateneDo.title;
  }
  await updateSharePointItemFields(
    accessToken,
    env.sharePointListRezervacieId,
    itemId,
    fields,
  );
}

/**
 * Posledný známy stav tachometra: OdovzdanieKm poslednej vrátenej rezervácie
 * vozidla (podľa OdovzdanieCas). null = žiadna vrátená rezervácia s km.
 */
export async function fetchPoslednyOdovzdanyKm(
  accessToken: string,
  vozidloSpz: string,
): Promise<number | null> {
  await verifyVozidlaListIds(accessToken);
  const cols = await getRezervaciaColumnMap(accessToken);
  const spz = vozidloSpz.trim();
  if (!spz || !cols.odovzdanieKm) return null;

  const rows = await listAllSharePointItems(
    accessToken,
    env.sharePointListRezervacieId,
    {
      filter: [
        `fields/${cols.vozidloSpz} eq '${escapeODataString(spz)}'`,
        `fields/${cols.stav} eq 'Vratene'`,
      ].join(" and "),
      selectFields: rezervaciaSelectFields(cols),
    },
  );

  let best: { cas: string; km: number } | null = null;
  for (const row of rows) {
    const r = parseRezervaciaRow(row.id, row.fields, cols);
    if (!r || r.stav !== "Vratene" || r.odovzdanieKm == null) continue;
    if (r.vozidloSpz.trim().toLowerCase() !== spz.toLowerCase()) continue;
    const cas = r.odovzdanieCas || r.do;
    if (!best || cas > best.cas) best = { cas, km: r.odovzdanieKm };
  }
  return best?.km ?? null;
}

export { todayDateOnly };
