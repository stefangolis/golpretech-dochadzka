import { cachedValue } from "../utils/persistentCache";
import {
  nacitajFrontu,
  odstranZFronty,
  oznacChybuVoFronte,
} from "../utils/dochadzkaFronta";
import {
  parseAnoNie,
  parseCisloAleboNull,
  parseDatumKey,
  parseDennyFond,
  vyhodnotOpravnenia,
  type MojeOpravnenia,
  type OpravnenieZaznam,
} from "../utils/dochadzkaOpravnenia";
import { isNetworkError, withTimeout } from "../utils/network";
import { normalizeTagUid } from "../utils/nfc";
import {
  buildUdalostCreateFields,
  getDochadzkaListIds,
  getNfcTagColumnMap,
  getOpravnenieColumnMap,
  getUdalostColumnMap,
  parseUdalostRow,
  udalostSelectFields,
  type DochadzkaUdalost,
  type NovaUdalost,
} from "./dochadzkaFields";
import { asSharePointYesNo, fieldString } from "./listColumns";
import {
  createSharePointItem,
  escapeODataString,
  listAllSharePointItems,
} from "./sharepointClient";

export const DOCHADZKA_CACHE_TTL_MS = 60 * 60_000;
const ZAPIS_TIMEOUT_MS = 20_000;

const NFC_TAGY_CACHE_KEY = "@dochadzka/nfc-tagy/v1";
const OPRAVNENIA_CACHE_KEY = "@dochadzka/opravnenia/v3";

/**
 * Moje udalosti v rozsahu [odIso, doIso): server-side filter podľa emailu a Cas.
 */
export async function fetchMojeUdalosti(
  accessToken: string,
  employeeEmail: string,
  odIso: string,
  doIso: string,
): Promise<DochadzkaUdalost[]> {
  const started = Date.now();
  const { udalosti } = await getDochadzkaListIds(accessToken);
  const cols = await getUdalostColumnMap(accessToken);
  const emailNorm = employeeEmail.trim().toLowerCase();
  const emailEscaped = escapeODataString(employeeEmail.trim());

  const filter = [
    `fields/${cols.zamestnanecEmail} eq '${emailEscaped}'`,
    `fields/${cols.cas} ge '${odIso}'`,
    `fields/${cols.cas} lt '${doIso}'`,
  ].join(" and ");

  const rows = await listAllSharePointItems(accessToken, udalosti, {
    filter,
    selectFields: udalostSelectFields(cols),
  });

  console.log(
    `[fetchMojeUdalosti] items=${rows.length} ${Date.now() - started}ms`,
  );

  const odMs = Date.parse(odIso);
  const doMs = Date.parse(doIso);
  const out: DochadzkaUdalost[] = [];
  for (const row of rows) {
    const u = parseUdalostRow(row.id, row.fields, cols);
    if (!u) continue;
    if (u.zamestnanecEmail.toLowerCase() !== emailNorm) continue;
    const ms = Date.parse(u.cas);
    if (ms < odMs || ms >= doMs) continue;
    out.push(u);
  }
  return out.sort((a, b) => Date.parse(a.cas) - Date.parse(b.cas));
}

/** Nová udalosť — appka udalosti nikdy neupravuje ani nemaže. */
export async function vytvorUdalost(
  accessToken: string,
  udalost: NovaUdalost,
): Promise<string> {
  const { udalosti } = await getDochadzkaListIds(accessToken);
  const cols = await getUdalostColumnMap(accessToken);
  return withTimeout(
    createSharePointItem(
      accessToken,
      udalosti,
      buildUdalostCreateFields(cols, udalost),
    ),
    ZAPIS_TIMEOUT_MS,
    "Zápis dochádzky",
  );
}

// ---------------------------------------------------------------------------

export type NfcTagInfo = {
  uid: string;
  nazov: string;
  umiestnenie: string;
};

async function loadAktivneNfcTagy(accessToken: string): Promise<NfcTagInfo[]> {
  const { nfcTagy } = await getDochadzkaListIds(accessToken);
  const cols = await getNfcTagColumnMap(accessToken);
  const rows = await listAllSharePointItems(accessToken, nfcTagy, {
    selectFields: [cols.title, cols.tagUid, cols.umiestnenie, cols.aktivny].filter(
      (c): c is string => !!c,
    ),
  });
  const out: NfcTagInfo[] = [];
  for (const row of rows) {
    if (cols.aktivny && !asSharePointYesNo(row.fields[cols.aktivny])) continue;
    const uid = normalizeTagUid(fieldString(row.fields, cols.tagUid));
    if (!uid) continue;
    out.push({
      uid,
      nazov: fieldString(row.fields, cols.title),
      umiestnenie: fieldString(row.fields, cols.umiestnenie),
    });
  }
  return out;
}

/**
 * Overí UID voči aktívnym tagom (cache 60 min). Neznámy tag → null.
 * Ak tag v cache chýba, zoznam sa raz načíta nanovo (tag mohol pribudnúť).
 */
export async function overNfcTag(
  accessToken: string,
  rawUid: string,
): Promise<NfcTagInfo | null> {
  const uid = normalizeTagUid(rawUid);
  if (!uid) return null;
  const load = () => loadAktivneNfcTagy(accessToken);
  const first = await cachedValue(NFC_TAGY_CACHE_KEY, DOCHADZKA_CACHE_TTL_MS, load);
  const hit = first.value.find((t) => t.uid === uid);
  if (hit || !first.fromCache) return hit ?? null;
  const fresh = await cachedValue(NFC_TAGY_CACHE_KEY, DOCHADZKA_CACHE_TTL_MS, load, {
    force: true,
  });
  return fresh.value.find((t) => t.uid === uid) ?? null;
}

async function loadOpravnenia(accessToken: string): Promise<OpravnenieZaznam[]> {
  const { opravnenia } = await getDochadzkaListIds(accessToken);
  const cols = await getOpravnenieColumnMap(accessToken);
  const rows = await listAllSharePointItems(accessToken, opravnenia, {
    selectFields: [
      cols.email,
      cols.zapisBezNalepky,
      cols.nadriadenyEmail,
      cols.jeHR,
      cols.dennyFondHod,
      cols.dovolenkaZostatokHod,
      cols.prescasZostatokHod,
      cols.stavKDatumu,
    ].filter((c): c is string => !!c),
  });
  const raw = (fields: Record<string, unknown>, col: string | null) =>
    col ? fields[col] : undefined;
  return rows
    .map((r) => ({
      email: fieldString(r.fields, cols.email),
      zapisBezNalepky: parseAnoNie(fieldString(r.fields, cols.zapisBezNalepky)),
      nadriadenyEmail: fieldString(r.fields, cols.nadriadenyEmail),
      jeHR: parseAnoNie(fieldString(r.fields, cols.jeHR)),
      dennyFondHod: parseDennyFond(raw(r.fields, cols.dennyFondHod)),
      dovolenkaZostatokHod: parseCisloAleboNull(raw(r.fields, cols.dovolenkaZostatokHod)),
      prescasZostatokHod: parseCisloAleboNull(raw(r.fields, cols.prescasZostatokHod)),
      stavKDatumu: parseDatumKey(raw(r.fields, cols.stavKDatumu)),
    }))
    .filter((z) => !!z.email);
}

/**
 * Moje oprávnenia z DochadzkaOpravnenia (cache 60 min, offline posledná známa hodnota).
 * Prázdne ZapisBezNalepky / JeHR = Nie, prázdny DennyFondHod = 8.
 */
export async function nacitajMojeOpravnenia(
  accessToken: string,
  employeeEmail: string,
): Promise<MojeOpravnenia> {
  const { value } = await cachedValue(
    OPRAVNENIA_CACHE_KEY,
    DOCHADZKA_CACHE_TTL_MS,
    () => loadOpravnenia(accessToken),
  );
  return vyhodnotOpravnenia(value, employeeEmail);
}

export async function maZapisBezNalepky(
  accessToken: string,
  employeeEmail: string,
): Promise<boolean> {
  return (await nacitajMojeOpravnenia(accessToken, employeeEmail)).zapisBezNalepky;
}

// ---------------------------------------------------------------------------
// Offline fronta

function udalostKey(typ: string, casIso: string): string {
  return `${typ}|${Math.floor(Date.parse(casIso) / 1000)}`;
}

export type OdoslanieFrontyVysledok = {
  odoslane: number;
  zostava: number;
};

let flushing: Promise<OdoslanieFrontyVysledok> | null = null;

/**
 * Odošle čakajúce udalosti v časovom poradí. Udalosti, ktoré už na serveri sú
 * (rovnaký typ a Cas — napr. odpoveď sa stratila), sa len odstránia z fronty.
 */
export function odosliFrontu(
  getAccessToken: () => Promise<string>,
  employeeEmail: string,
): Promise<OdoslanieFrontyVysledok> {
  if (flushing) return flushing;
  flushing = (async () => {
    const polozky = await nacitajFrontu(employeeEmail);
    if (!polozky.length) return { odoslane: 0, zostava: 0 };

    const token = await getAccessToken();
    const casy = polozky.map((p) => Date.parse(p.cas));
    const existujuce = await fetchMojeUdalosti(
      token,
      employeeEmail,
      new Date(Math.min(...casy) - 1000).toISOString(),
      new Date(Math.max(...casy) + 2000).toISOString(),
    );
    const naServeri = new Set(existujuce.map((u) => udalostKey(u.typ, u.cas)));

    let odoslane = 0;
    for (const p of polozky) {
      if (naServeri.has(udalostKey(p.typ, p.cas))) {
        await odstranZFronty(p.localId);
        continue;
      }
      try {
        await vytvorUdalost(token, {
          zamestnanecEmail: p.zamestnanecEmail,
          displayName: p.displayName,
          typ: p.typ,
          cas: p.cas,
          zdroj: p.zdroj,
          tagId: p.tagId,
          poloha: p.poloha,
          offline: true,
        });
        await odstranZFronty(p.localId);
        naServeri.add(udalostKey(p.typ, p.cas));
        odoslane++;
      } catch (err) {
        if (isNetworkError(err)) break;
        await oznacChybuVoFronte(
          p.localId,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    const zostava = (await nacitajFrontu(employeeEmail)).length;
    if (odoslane) {
      console.log(`[dochadzka] fronta: odoslané ${odoslane}, zostáva ${zostava}`);
    }
    return { odoslane, zostava };
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
