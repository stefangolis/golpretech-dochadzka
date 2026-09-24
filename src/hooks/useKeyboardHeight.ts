import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Výška klávesnice na Androide. Pri edge-to-edge (Expo SDK 54+) Android
 * nezmenšuje okno (adjustResize nefunguje), takže obsah treba odsadiť ručne.
 * Na iOS rieši posun KeyboardAvoidingView, preto vracia 0.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", (e) =>
      setHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
