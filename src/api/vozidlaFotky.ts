import { env } from "../config/env";
import { cs } from "../i18n/cs";
import { graphFetch, parseGraphErrorBody } from "./sharepointClient";

const LIBRARY_NAME = "VozidlaFotky";

let cachedDriveId: string | null = null;

export type FotkaKrok = "prevzatie" | "odovzdanie";

/** ID knižnice dokumentov „VozidlaFotky“ na site (podľa name / displayName). */
export async function getVozidlaFotkyDriveId(
  accessToken: string,
): Promise<string> {
  if (cachedDriveId) return cachedDriveId;

  let url = `https://graph.microsoft.com/v1.0/sites/${env.sharePointSiteId}/drives`;
  const names: string[] = [];
  const wanted = LIBRARY_NAME.toLowerCase();

  while (url) {
    const res = await graphFetch(accessToken, url);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        cs.vozidla.fotky.knihovny(res.status, parseGraphErrorBody(body)),
      );
    }
    const page = (await res.json()) as {
      value?: Array<{ id?: string; name?: string; displayName?: string }>;
      "@odata.nextLink"?: string;
    };
    for (const d of page.value ?? []) {
      const name = d.name?.trim() ?? "";
      const displayName = d.displayName?.trim() ?? "";
      if (name) names.push(name);
      if (
        d.id &&
        (name.toLowerCase() === wanted || displayName.toLowerCase() === wanted)
      ) {
        cachedDriveId = d.id;
        return d.id;
      }
    }
    url = page["@odata.nextLink"] ?? "";
  }

  throw new Error(
    cs.vozidla.fotky.chybiKnihovna(LIBRARY_NAME, names.join(", ") || "—"),
  );
}

async function uploadJpeg(
  accessToken: string,
  driveId: string,
  path: string,
  localUri: string,
): Promise<void> {
  const blob = await (await fetch(localUri)).blob();
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${encodedPath}:/content`;
  const res = await graphFetch(accessToken, url, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: blob,
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 403) {
      throw new Error(
        cs.vozidla.fotky.bezZapisu(LIBRARY_NAME),
      );
    }
    throw new Error(
      cs.vozidla.fotky.nahraniZlyhalo(path, res.status, parseGraphErrorBody(body)),
    );
  }
}

/**
 * Nahrá fotky ako {rezervaciaId}/{krok}-1.jpg … {krok}-N.jpg.
 * Priečinok vytvorí Graph automaticky podľa cesty.
 */
export async function nahratFotkyRezervacie(
  accessToken: string,
  rezervaciaId: string,
  krok: FotkaKrok,
  localUris: readonly string[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  if (localUris.length === 0) return;
  const driveId = await getVozidlaFotkyDriveId(accessToken);
  const total = localUris.length;
  for (let i = 0; i < total; i += 1) {
    onProgress?.(i + 1, total);
    await uploadJpeg(
      accessToken,
      driveId,
      `${rezervaciaId}/${krok}-${i + 1}.jpg`,
      localUris[i]!,
    );
  }
}
