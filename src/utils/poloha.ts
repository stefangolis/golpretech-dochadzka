import * as Location from "expo-location";
import { withTimeout } from "./network";

export const POLOHA_NEPOVOLENE = "nepovolene";
export const POLOHA_NEDOSTUPNA = "nedostupna";

function format(coords: { latitude: number; longitude: number; accuracy: number | null }): string {
  const acc = coords.accuracy != null ? Math.round(coords.accuracy) : "?";
  return `${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)},±${acc}`;
}

/**
 * Jednorazová poloha pre zápis bez nálepky ("lat,lon,±presnosť_m").
 * Len foreground povolenie, žiadne sledovanie. Bez povolenia → "nepovolene".
 */
export async function zistiPolohuJednorazovo(): Promise<string> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== Location.PermissionStatus.GRANTED) {
      return POLOHA_NEPOVOLENE;
    }
  } catch {
    return POLOHA_NEPOVOLENE;
  }

  try {
    const pos = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      15_000,
      "Poloha",
    );
    return format(pos.coords);
  } catch {
    try {
      const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
      if (last) return format(last.coords);
    } catch {
      /* bez polohy */
    }
    return POLOHA_NEDOSTUPNA;
  }
}
