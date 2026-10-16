/** Výber NFC zvuku — čistá funkcia, bez prehrávania. */

export type NfcZvuk = "pip" | "neznamy";

export type NfcZvukOkamzik = "prilozeni" | "overeni";

/**
 * - Priloženie (ešte pred overením): krátke pípnutie, len ak má prístup a je zapnutý zvuk.
 * - Overenie: známy tag už pípnutý pri priložení → ticho; neznámy tag → dvojité nižšie pípnutie.
 * - Bez prístupu k Docházce alebo so vypnutým zvukom → žiadny zvuk (vibrácia ide mimo).
 */
export function vyberNfcZvuk(p: {
  okamzik: NfcZvukOkamzik;
  maPristup: boolean;
  zvukZapnuty: boolean;
  tagZnamy?: boolean | null;
}): NfcZvuk | null {
  if (!p.zvukZapnuty || !p.maPristup) return null;
  if (p.okamzik === "prilozeni") return "pip";
  if (p.tagZnamy === false) return "neznamy";
  return null;
}
