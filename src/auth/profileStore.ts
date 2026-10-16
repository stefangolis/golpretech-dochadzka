import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GraphMe } from "../api/graph";

const PROFILE_KEY = "@auth/profile/v1";

export type StoredProfile = {
  email: string;
  displayName: string;
  me: GraphMe;
};

/** Posledný načítaný profil — aby štart bez siete neodhlásil používateľa (offline dochádzka). */
export async function saveProfile(profile: StoredProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile)).catch(
    () => undefined,
  );
}

export async function loadProfile(): Promise<StoredProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as StoredProfile;
    return p?.email ? p : null;
  } catch {
    return null;
  }
}

export async function clearProfile(): Promise<void> {
  await AsyncStorage.removeItem(PROFILE_KEY).catch(() => undefined);
}
