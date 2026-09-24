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
import {
  buildRezervaciaCreateFields,
  buildRezervaciaTitle,
  getRezervaciaColumnMap,
  parseRezervaciaRow,
  rezervaciaSelectFields,
  type Rezervacia,
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

export async function fetchRezervacieVRozsahu(
  accessToken: string,
  odDate: string,
  doDate: string,
): Promise<Rezervacia[]> {
  await verifyVozidlaListIds(accessToken);
  const cols = await getRezervaciaColumnMap(accessToken);

  const filter = [
    `fields/${cols.stav} ne 'Zrusene'`,
    `fields/${cols.do} ge '${odDate}T00:00:00Z'`,
    `fields/${cols.od} le '${doDate}T23:59:59Z'`,
  ].join(" and ");

  const rows = await listAllSharePointItems(
    accessToken,
    env.sharePointListRezervacieId,
    { filter, selectFields: rezervaciaSelectFields(cols) },
  );

  const items: Rezervacia[] = [];
  for (const row of rows) {
    const parsed = parseRezervaciaRow(row.id, row.fields, cols);
    if (!parsed || parsed.stav === "Zrusene") continue;
    items.push(parsed);
  }

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

  const filter = [
    `fields/${cols.zamestnanecEmail} eq '${emailEscaped}'`,
    `fields/${cols.stav} ne 'Zrusene'`,
    `fields/${cols.do} ge '${from}T00:00:00Z'`,
  ].join(" and ");

  const rows = await listAllSharePointItems(
    accessToken,
    env.sharePointListRezervacieId,
    { filter, selectFields: rezervaciaSelectFields(cols) },
  );

  const items: Rezervacia[] = [];
  for (const row of rows) {
    const parsed = parseRezervaciaRow(row.id, row.fields, cols);
    if (!parsed || parsed.stav === "Zrusene") continue;
    if (parsed.zamestnanecEmail.trim().toLowerCase() !== emailNorm) continue;
    items.push(parsed);
  }

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

export async function predlzitRezervaciu(
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

export { todayDateOnly };
