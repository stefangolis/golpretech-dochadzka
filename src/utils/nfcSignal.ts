import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { Vibration } from "react-native";
import { nacitajHlasZapnuty } from "./hlas";
import { vyberNfcZvuk, type NfcZvuk, type NfcZvukOkamzik } from "./nfcZvuk";

const ZDROJE: Record<NfcZvuk, number> = {
  pip: require("../../assets/sounds/nfc-pip.wav"),
  neznamy: require("../../assets/sounds/nfc-neznamy.wav"),
};

let players: Partial<Record<NfcZvuk, AudioPlayer>> | null = null;
let modeReady = false;

async function pripravPrehravanie(): Promise<void> {
  if (!modeReady) {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: "mixWithOthers",
    });
    modeReady = true;
  }
  if (!players) {
    players = {
      pip: createAudioPlayer(ZDROJE.pip),
      neznamy: createAudioPlayer(ZDROJE.neznamy),
    };
  }
}

async function prehraj(typ: NfcZvuk): Promise<void> {
  try {
    await pripravPrehravanie();
    const p = players?.[typ];
    if (!p) return;
    await p.seekTo(0);
    p.play();
  } catch {
    /* zvuk nie je dostupný (Expo Go / chýbajúci native modul) */
  }
}

/** Krátka vibrácia vždy, bez ohľadu na prepínač zvuku. */
export function vibrujNfc(): void {
  try {
    Vibration.vibrate(50);
  } catch {
    /* emulátor bez vibrácie */
  }
}

export async function prehrajNfcZvukAkZapnuty(
  okamzik: NfcZvukOkamzik,
  maPristup: boolean,
  tagZnamy?: boolean | null,
): Promise<void> {
  const zvukZapnuty = await nacitajHlasZapnuty();
  const zvuk = vyberNfcZvuk({ okamzik, maPristup, zvukZapnuty, tagZnamy });
  if (zvuk) await prehraj(zvuk);
}

/** Hneď po zachytení tagu: vibrácia vždy; pípnutie len s prístupom a zapnutým zvukom. */
export function signalNfcPrilozenia(maPristup: boolean): void {
  vibrujNfc();
  void prehrajNfcZvukAkZapnuty("prilozeni", maPristup);
}

/** Po overení tagu: neznámy tag = dvojité nižšie pípnutie. */
export function signalNfcOverenia(p: {
  maPristup: boolean;
  tagZnamy: boolean | null;
}): void {
  void prehrajNfcZvukAkZapnuty("overeni", p.maPristup, p.tagZnamy);
}
