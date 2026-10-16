import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";
import { cs } from "../i18n/cs";
import type { DochadzkaTyp } from "./dochadzkaVypocet";

const HLAS_KEY = "@dochadzka/hlas/v1";

export const HLAS_TEXT: Partial<Record<DochadzkaTyp, string>> = cs.hlas;

/** Predvolene zapnuté. */
export async function nacitajHlasZapnuty(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(HLAS_KEY)) !== "0";
  } catch {
    return true;
  }
}

export async function ulozHlasZapnuty(zapnuty: boolean): Promise<void> {
  await AsyncStorage.setItem(HLAS_KEY, zapnuty ? "1" : "0").catch(() => undefined);
}

let jazyk: string | null = null;

/** cs-CZ, inak sk-SK, inak null (hlas sa nepoužije). Prázdny zoznam hlasov sa necachuje. */
async function zistiJazyk(): Promise<string | null> {
  if (jazyk) return jazyk;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const langs = voices.map((v) => v.language.toLowerCase().replace("_", "-"));
    const found = langs.some((l) => l.startsWith("cs"))
      ? "cs-CZ"
      : langs.some((l) => l.startsWith("sk"))
        ? "sk-SK"
        : null;
    if (found) jazyk = found;
    return found;
  } catch {
    return null;
  }
}

export async function povedzPotvrdenie(typ: DochadzkaTyp): Promise<void> {
  const text = HLAS_TEXT[typ];
  if (!text || !(await nacitajHlasZapnuty())) return;
  const lang = await zistiJazyk();
  if (!lang) return;
  try {
    Speech.speak(text, { language: lang });
  } catch {
    /* TTS nedostupné */
  }
}
