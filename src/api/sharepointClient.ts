import { env } from "../config/env";

export function assertSharePointConfig(): void {
  if (
    !env.sharePointSiteId ||
    !env.sharePointListZakazkyId ||
    !env.sharePointListObjednavkyId ||
    !env.sharePointListZaznamyId
  ) {
    throw new Error(
      "Chýbajú SharePoint premenné v .env (SITE_ID / LIST_*). Reštartujte Expo po úprave.",
    );
  }
}

export function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

/** Čitateľná chyba z Graph API odpovede */
export function parseGraphErrorBody(body: string): string {
  try {
    const json = JSON.parse(body) as {
      error?: { message?: string; code?: string };
    };
    const msg = json.error?.message?.trim();
    if (msg) return msg;
  } catch {
    /* raw text */
  }
  return body.trim().slice(0, 500);
}

function formatSharePointHttpError(
  status: number,
  listId: string,
  body: string,
): string {
  const detail = parseGraphErrorBody(body);
  if (status === 403) {
    return (
      "Nemáte prístup k SharePoint zoznamu (403). " +
      "Požiadajte správcu, aby vám na site dochádzky pridal oprávnenie Upraviť " +
      "(zoznamy Zákazky, Prijaté objednávky a Časové záznamy)."
    );
  }
  if (status === 401) {
    return "Prihlásenie vypršalo. Odhláste sa a prihláste sa znova.";
  }
  return `SharePoint list ${listId} HTTP ${status}: ${detail}`;
}

type GraphListResponse = {
  value?: Array<{ id: string; fields?: Record<string, unknown> }>;
  "@odata.nextLink"?: string;
};

export async function graphFetch(
  accessToken: string,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  return res;
}

/** displayName SharePoint zoznamu (na overenie ID v .env) */
export async function fetchListDisplayName(
  accessToken: string,
  listId: string,
): Promise<string> {
  assertSharePointConfig();
  const siteId = env.sharePointSiteId;
  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}?$select=displayName`;
  const res = await graphFetch(accessToken, url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(formatSharePointHttpError(res.status, listId, body));
  }
  const data = (await res.json()) as { displayName?: string };
  return data.displayName?.trim() || listId;
}

/**
 * Načíta všetky položky zoznamu (s pagináciou). Filter je OData na fields/.
 */
export async function listAllSharePointItems(
  accessToken: string,
  listId: string,
  options?: {
    filter?: string;
    selectFields?: string[];
    debugLabel?: string;
  },
): Promise<Array<{ id: string; fields: Record<string, unknown> }>> {
  assertSharePointConfig();
  const siteId = env.sharePointSiteId;
  const select = options?.selectFields?.length
    ? `$expand=fields($select=${options.selectFields.join(",")})`
    : "$expand=fields";
  const filter = options?.filter
    ? `&$filter=${encodeURIComponent(options.filter)}`
    : "";

  let url =
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?${select}${filter}&$top=200`;

  const items: Array<{ id: string; fields: Record<string, unknown> }> = [];

  while (url) {
    const res = await graphFetch(accessToken, url, {
      headers: {
        Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
      },
    });
    // TODO odstrániť po odladení
    if (options?.debugLabel) {
      console.log(
        `[${options.debugLabel}]`,
        url,
        `HTTP ${res.status}`,
        `totalSoFar=${items.length}`,
      );
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(formatSharePointHttpError(res.status, listId, body));
    }
    const page = (await res.json()) as GraphListResponse;
    for (const row of page.value ?? []) {
      if (!row.id || !row.fields) continue;
      items.push({ id: row.id, fields: row.fields });
    }
    url = page["@odata.nextLink"] ?? "";
  }

  // TODO odstrániť po odladení
  if (options?.debugLabel) {
    console.log(`[${options.debugLabel}] done items=${items.length}`);
  }

  return items;
}

export async function createSharePointItem(
  accessToken: string,
  listId: string,
  fields: Record<string, unknown>,
): Promise<string> {
  assertSharePointConfig();
  const siteId = env.sharePointSiteId;
  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items`;
  const res = await graphFetch(accessToken, url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(formatSharePointHttpError(res.status, listId, body));
  }
  const data = (await res.json()) as { id?: string };
  return data.id ?? "";
}

export async function updateSharePointItemFields(
  accessToken: string,
  listId: string,
  itemId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  assertSharePointConfig();
  const siteId = env.sharePointSiteId;
  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items/${itemId}/fields`;
  const res = await graphFetch(accessToken, url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(formatSharePointHttpError(res.status, listId, body));
  }
}