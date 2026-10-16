import { useCallback, useEffect, useRef, useState } from "react";
import { Linking } from "react-native";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useDochadzkaFrontaSync } from "../../hooks/useDochadzka";
import { useMojeOpravnenia } from "../../hooks/useDochadzkaZiadosti";
import { cs } from "../../i18n/cs";
import { navigationRef } from "../../navigation/navigationRef";
import { isoNaSekundy } from "../../utils/dochadzkaVypocet";
import {
  nacitajLaunchTagUid,
  nastavListenerPozadia,
  nastavNfcZachytenyHandler,
  normalizeTagUid,
} from "../../utils/nfc";
import {
  prehrajNfcZvukAkZapnuty,
  vibrujNfc,
} from "../../utils/nfcSignal";

/** Launch intent ostáva rovnaký po celý život aktivity — ten istý tag neotváraj dvakrát. */
let poslednyLaunchTag: { uid: string; at: number } | null = null;
let poslednyZachyt: { uid: string; at: number } | null = null;
let poslednyOdkaz: { url: string; at: number } | null = null;

function jeDochadzkaOdkaz(url: string | null): boolean {
  if (!url) return false;
  return url.startsWith("golpretechdochadzka://dochadzka");
}

function tagZOdkazu(url: string): string | null {
  const m = url.match(/[?&]tag=([^&]+)/i);
  if (!m) return null;
  try {
    return normalizeTagUid(decodeURIComponent(m[1])) || null;
  } catch {
    return normalizeTagUid(m[1]) || null;
  }
}

function otvorNavigaciu(
  screen: "DochadzkaZapis" | "DochadzkaDnes",
  params?: { zdroj: "NFC"; tagUid: string; casTuknutia: string },
) {
  const go = () => {
    if (screen === "DochadzkaZapis" && params) {
      navigationRef.navigate("Dochadzka", {
        screen: "DochadzkaZapis",
        params,
        initial: false,
      });
      return;
    }
    navigationRef.navigate("Dochadzka", {
      screen: "DochadzkaDnes",
      initial: false,
    });
  };
  if (navigationRef.isReady()) {
    go();
    return;
  }
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    if (navigationRef.isReady()) {
      clearInterval(timer);
      go();
    } else if (tries > 100) {
      clearInterval(timer);
    }
  }, 100);
}

/**
 * Prihlásený používateľ: NFC zo spustenia appky / z pozadia → obrazovka Zápis,
 * a odosielanie offline fronty dochádzky.
 */
export function DochadzkaNfcBridge() {
  useDochadzkaFrontaSync();
  const opravnenia = useMojeOpravnenia();
  const opravneniaRef = useRef(opravnenia);
  opravneniaRef.current = opravnenia;
  const [bezPristupu, setBezPristupu] = useState(false);

  const pockajNaPristup = useCallback(async (): Promise<boolean> => {
    const start = Date.now();
    while (Date.now() - start < 8_000) {
      const q = opravneniaRef.current;
      if (q.data) return q.data.vSezname === true;
      if (!q.isPending && !q.isFetching) return false;
      await new Promise((r) => setTimeout(r, 80));
    }
    return opravneniaRef.current.data?.vSezname === true;
  }, []);

  const spracujTag = useCallback(
    async (tagUid: string, opts?: { skipNavigate?: boolean }) => {
      const uid = normalizeTagUid(tagUid);
      if (!uid) return;
      const now = Date.now();
      if (poslednyZachyt?.uid === uid && now - poslednyZachyt.at < 800) return;
      poslednyZachyt = { uid, at: now };

      vibrujNfc();
      const cached = opravneniaRef.current.data;
      if (cached) {
        if (!cached.vSezname) {
          setBezPristupu(true);
          return;
        }
      } else if (!(await pockajNaPristup())) {
        setBezPristupu(true);
        return;
      }
      void prehrajNfcZvukAkZapnuty("prilozeni", true);
      if (opts?.skipNavigate) return;
      otvorNavigaciu("DochadzkaZapis", {
        zdroj: "NFC",
        tagUid: uid,
        casTuknutia: isoNaSekundy(),
      });
    },
    [pockajNaPristup],
  );

  const spracujOdkaz = useCallback(
    async (url: string | null) => {
      if (!jeDochadzkaOdkaz(url) || !url) return;
      const tag = tagZOdkazu(url);
      if (tag) {
        await spracujTag(tag);
        return;
      }
      const cached = opravneniaRef.current.data;
      const maPristup = cached ? cached.vSezname === true : await pockajNaPristup();
      if (!maPristup) {
        setBezPristupu(true);
        return;
      }
      otvorNavigaciu("DochadzkaDnes");
    },
    [pockajNaPristup, spracujTag],
  );

  useEffect(() => {
    nastavNfcZachytenyHandler((uid) => {
      void spracujTag(uid);
    });
    return () => nastavNfcZachytenyHandler(null);
  }, [spracujTag]);

  useEffect(() => {
    let cancelled = false;
    void nacitajLaunchTagUid().then((uid) => {
      if (!uid || cancelled) return;
      const now = Date.now();
      if (poslednyLaunchTag?.uid === uid && now - poslednyLaunchTag.at < 60_000) {
        return;
      }
      poslednyLaunchTag = { uid, at: now };
      void spracujTag(uid);
    });
    const off = nastavListenerPozadia((uid) => {
      void spracujTag(uid);
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [spracujTag]);

  useEffect(() => {
    let cancelled = false;
    void Linking.getInitialURL().then((url) => {
      if (cancelled || !url) return;
      const now = Date.now();
      if (poslednyOdkaz?.url === url && now - poslednyOdkaz.at < 60_000) return;
      poslednyOdkaz = { url, at: now };
      void spracujOdkaz(url);
    });
    const sub = Linking.addEventListener("url", (e) => {
      void spracujOdkaz(e.url);
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [spracujOdkaz]);

  const spatDoHubu = () => {
    setBezPristupu(false);
    if (navigationRef.isReady()) navigationRef.navigate("Hub");
  };

  return (
    <ConfirmDialog
      visible={bezPristupu}
      hideCancel
      title={cs.dochazka.pristup.titulek}
      message={cs.dochazka.pristup.text}
      confirmLabel={cs.spolecne.ok}
      onConfirm={spatDoHubu}
      onClose={spatDoHubu}
    />
  );
}
