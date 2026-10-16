import { Platform } from "react-native";
import NfcManager, { NfcEvents, type TagEvent } from "react-native-nfc-manager";
import { normalizeTagUid } from "./tagUid";

export { normalizeTagUid };

export type NfcStav = "nepodporovane" | "vypnute" | "zapnute";

/** Spoločný handler pre popredie aj mostík (Dedup rieši mostík). */
let nfcZachytenyHandler: ((uid: string) => void) | null = null;

export function nastavNfcZachytenyHandler(h: ((uid: string) => void) | null): void {
  nfcZachytenyHandler = h;
}

export function nfcTagZachyteny(uid: string): void {
  nfcZachytenyHandler?.(uid);
}

function tagUid(tag: TagEvent | null | undefined): string {
  return tag ? normalizeTagUid(tag.id) : "";
}

let started: Promise<boolean> | null = null;

/** NfcManager.start() raz za beh appky; false = zariadenie NFC nemá. */
export function ensureNfcStarted(): Promise<boolean> {
  if (Platform.OS !== "android") return Promise.resolve(false);
  if (!started) {
    started = (async () => {
      try {
        const supported = await NfcManager.isSupported();
        if (!supported) return false;
        await NfcManager.start();
        return true;
      } catch (err) {
        console.warn("[nfc] start zlyhal", err);
        started = null;
        return false;
      }
    })();
  }
  return started;
}

export async function zistiNfcStav(): Promise<NfcStav> {
  if (!(await ensureNfcStarted())) return "nepodporovane";
  try {
    return (await NfcManager.isEnabled()) ? "zapnute" : "vypnute";
  } catch {
    return "vypnute";
  }
}

export async function otvorNfcNastavenia(): Promise<void> {
  try {
    await NfcManager.goToNfcSetting();
  } catch {
    /* nastavenia nie sú dostupné */
  }
}

/** UID tagu, ktorým bola appka spustená (zatvorená appka + priloženie k nálepke). */
export async function nacitajLaunchTagUid(): Promise<string | null> {
  if (!(await ensureNfcStarted())) return null;
  try {
    const tag = await NfcManager.getLaunchTagEvent();
    return tagUid(tag) || null;
  } catch {
    return null;
  }
}

/**
 * Tag priložený, keď appka beží, ale nepočúva v popredí (Android doručí NDEF intent).
 */
export function nastavListenerPozadia(onTag: (uid: string) => void): () => void {
  if (Platform.OS !== "android") return () => undefined;
  let active = true;
  ensureNfcStarted().then((ok) => {
    if (!ok || !active) return;
    NfcManager.setEventListener(NfcEvents.DiscoverBackgroundTag, (tag: TagEvent) => {
      const uid = tagUid(tag);
      if (uid) onTag(uid);
    });
  });
  return () => {
    active = false;
    NfcManager.setEventListener(NfcEvents.DiscoverBackgroundTag, null);
  };
}

/** Zmena zapnutia NFC v systéme (Android). */
export function nastavListenerStavuNfc(onChange: () => void): () => void {
  if (Platform.OS !== "android") return () => undefined;
  let active = true;
  ensureNfcStarted().then((ok) => {
    if (!ok || !active) return;
    NfcManager.setEventListener(NfcEvents.StateChanged, () => onChange());
  });
  return () => {
    active = false;
    NfcManager.setEventListener(NfcEvents.StateChanged, null);
  };
}

/**
 * Počúvanie v popredí (obrazovka Dochádzka). Vráti funkciu na odregistrovanie.
 */
export async function zaregistrujNfcPopredie(
  onTag: (uid: string) => void,
): Promise<() => Promise<void>> {
  if (!(await ensureNfcStarted())) return async () => undefined;
  NfcManager.setEventListener(NfcEvents.DiscoverTag, (tag: TagEvent) => {
    const uid = tagUid(tag);
    if (uid) onTag(uid);
  });
  try {
    await NfcManager.registerTagEvent();
  } catch (err) {
    console.warn("[nfc] registerTagEvent zlyhal", err);
  }
  return async () => {
    NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
    try {
      await NfcManager.unregisterTagEvent();
    } catch {
      /* už odregistrované */
    }
  };
}
