import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

function aktualnaPoloha(): number | null {
  if (!Keyboard.isVisible()) return null;
  return Keyboard.metrics()?.screenY ?? null;
}

/**
 * Horná hrana klávesnice v súradniciach okna (null = skrytá).
 * Na Androide pri edge-to-edge (Expo SDK 54+) systém okno nezmenšuje, preto sa
 * prekrytie počíta z tejto polohy (aj v Modale); na iOS ide o „will“ udalosti.
 */
export function useKlavesnica(): number | null {
  const [klavesnicaY, setKlavesnicaY] = useState<number | null>(aktualnaPoloha);

  useEffect(() => {
    const ios = Platform.OS === "ios";
    const subs = [
      Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", (e) =>
        setKlavesnicaY(e.endCoordinates.screenY),
      ),
      Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () =>
        setKlavesnicaY(null),
      ),
    ];
    if (ios) {
      subs.push(
        Keyboard.addListener("keyboardWillChangeFrame", (e) =>
          setKlavesnicaY(e.endCoordinates.height > 0 ? e.endCoordinates.screenY : null),
        ),
      );
    }
    return () => subs.forEach((s) => s.remove());
  }, []);

  return klavesnicaY;
}
