/** Obrazovka Zápis — ktoré udalosti dávajú zmysel podľa posledného dnešného záznamu. */
import {
  isDochadzkaTyp,
  zoradPlatne,
  type DochadzkaTyp,
  type UdalostPreVypocet,
} from "./dochadzkaVypocet";

/** Automatické potvrdenie navrhnutej udalosti po priložení nálepky. */
export const AUTO_POTVRDENIE_MS = 10_000;

/** mimo = žiadny záznam / posledný Odchod; prec = prerušenie (súkromný, služobný, lekár, fajčenie). */
export type ZapisStav = "mimo" | "v_praci" | "prec";

export const TYPY_V_PRACI: readonly DochadzkaTyp[] = [
  "Odchod",
  "SukromnyOdchod",
  "SluzobnyOdchod",
  "Lekar",
  "FajciarskaPrestavka",
];

export type RelevantneTypy = {
  stav: ZapisStav;
  /** Navrhnutá udalosť (NFC automatické potvrdenie) */
  navrh: DochadzkaTyp;
  /** Povolené tlačidlá, navrhnutá je prvá */
  typy: readonly DochadzkaTyp[];
};

export function stavPreZapis(udalostiDna: UdalostPreVypocet[]): ZapisStav {
  const platne = zoradPlatne(udalostiDna).filter((u) => isDochadzkaTyp(u.typ));
  const posledna = platne[platne.length - 1];
  if (!posledna || posledna.typ === "Odchod") return "mimo";
  if (posledna.typ === "Prichod") return "v_praci";
  return "prec";
}

export function relevantneTypy(udalostiDna: UdalostPreVypocet[]): RelevantneTypy {
  const stav = stavPreZapis(udalostiDna);
  if (stav === "v_praci") return { stav, navrh: "Odchod", typy: TYPY_V_PRACI };
  return { stav, navrh: "Prichod", typy: ["Prichod"] };
}
