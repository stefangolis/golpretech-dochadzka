import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { Rezervacia } from "../api/rezervacieFields";
import { parseDateOnly } from "./dates";
import { jeAktivnaRezervacia } from "./rezervacie";

const CHANNEL_ID = "rezervacie";
const ID_PREFIX = "rez-";
const HOUR = 18;

const supported = Platform.OS === "android" || Platform.OS === "ios";

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

let permissionPromise: Promise<boolean> | null = null;

/**
 * Kanál (Android) + povolenie. Pýta sa len raz za beh; pri odmietnutí
 * appka funguje ďalej bez notifikácií.
 */
function ensurePermission(): Promise<boolean> {
  if (!supported) return Promise.resolve(false);
  if (!permissionPromise) {
    permissionPromise = (async () => {
      try {
        if (Platform.OS === "android") {
          // Na Androide 13+ sa systémový dialóg zobrazí až po vytvorení kanála.
          await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
            name: "Rezervácie vozidiel",
            importance: Notifications.AndroidImportance.HIGH,
          });
        }
        const current = await Notifications.getPermissionsAsync();
        if (current.granted) return true;
        if (!current.canAskAgain) return false;
        const requested = await Notifications.requestPermissionsAsync();
        return requested.granted;
      } catch {
        return false;
      }
    })();
  }
  return permissionPromise;
}

function notifId(rezervaciaId: string): string {
  return `${ID_PREFIX}${rezervaciaId}`;
}

/** Posledný deň rezervácie o 18:00 miestneho času. */
function triggerDate(doDate: string): Date {
  const d = parseDateOnly(doDate);
  d.setHours(HOUR, 0, 0, 0);
  return d;
}

export async function zrusitNotifikaciuRezervacie(
  rezervaciaId: string,
): Promise<void> {
  if (!supported || !rezervaciaId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notifId(rezervaciaId));
  } catch {
    /* notifikácie sú doplnková funkcia */
  }
}

/** Zruší pôvodnú a naplánuje novú pripomienku konca rezervácie. */
export async function naplanovatNotifikaciuRezervacie(
  rezervaciaId: string,
  doDate: string,
): Promise<void> {
  if (!supported || !rezervaciaId || !doDate) return;
  await zrusitNotifikaciuRezervacie(rezervaciaId);
  const date = triggerDate(doDate);
  if (date.getTime() <= Date.now()) return;
  if (!(await ensurePermission())) return;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: notifId(rezervaciaId),
      content: {
        title: "Rezervace vozidla",
        body: "Dnes ti končí rezervace vozidla, nezapomeň na odevzdání nebo prodloužení.",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: CHANNEL_ID,
      },
    });
  } catch {
    /* notifikácie sú doplnková funkcia */
  }
}

/**
 * Zosúladí naplánované pripomienky s mojimi rezerváciami
 * (zmeny urobené na inom zariadení).
 */
export async function synchronizovatNotifikacieRezervacii(
  mojeRezervacie: readonly Rezervacia[],
): Promise<void> {
  if (!supported) return;
  if (!(await ensurePermission())) return;

  const aktivne = mojeRezervacie.filter(jeAktivnaRezervacia);
  const aktivneIds = new Set(aktivne.map((r) => notifId(r.id)));

  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (!n.identifier.startsWith(ID_PREFIX)) continue;
      if (aktivneIds.has(n.identifier)) continue;
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  } catch {
    /* notifikácie sú doplnková funkcia */
  }

  for (const r of aktivne) {
    await naplanovatNotifikaciuRezervacie(r.id, r.do);
  }
}
