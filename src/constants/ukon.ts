export const UKON_OPTIONS = [
  "Mechanická montáž",
  "Elektrika",
  "CAD",
  "Elektro projekce",
  "Čas na ceste",
  "Instalace",
  "Baleni",
  "Manual",
  "Testování",
] as const;

export type UkonOption = (typeof UKON_OPTIONS)[number];

/** Záloha, kým nie je nastavený SHAREPOINT_LIST_UKONY_ID */
export const FALLBACK_UKONY = UKON_OPTIONS.map((nazov) => ({
  nazov,
  minutovaSadzba: 0,
}));