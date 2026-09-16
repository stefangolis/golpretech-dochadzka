import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "ms_access_token";
const REFRESH_TOKEN_KEY = "ms_refresh_token";
const EXPIRES_AT_KEY = "ms_expires_at";

export type StoredTokens = {
  accessToken: string;
  refreshToken: string | null;
  /** Unix ms kedy access token vyprší */
  expiresAt: number;
};

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken);
  await SecureStore.setItemAsync(EXPIRES_AT_KEY, String(tokens.expiresAt));
  if (tokens.refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
}

export async function loadTokens(): Promise<StoredTokens | null> {
  const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  const expiresAtRaw = await SecureStore.getItemAsync(EXPIRES_AT_KEY);
  if (!accessToken || !expiresAtRaw) return null;

  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  return {
    accessToken,
    refreshToken,
    expiresAt: Number(expiresAtRaw),
  };
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(EXPIRES_AT_KEY);
}