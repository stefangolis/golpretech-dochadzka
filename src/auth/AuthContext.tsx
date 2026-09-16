import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { fetchMe, resolveEmployeeEmail, type GraphMe } from "../api/graph";
import { assertAuthConfig, env } from "../config/env";
import {
  AUTH_SCOPES,
  getDiscovery,
  getRedirectUri,
} from "./authConfig";
import {
  clearTokens,
  loadTokens,
  saveTokens,
  type StoredTokens,
} from "./tokenStore";

WebBrowser.maybeCompleteAuthSession();

type AuthUser = {
  email: string;
  displayName: string;
  me: GraphMe;
};

type AuthContextValue = {
  ready: boolean;
  user: AuthUser | null;
  accessToken: string | null;
  redirectUri: string;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getValidAccessToken: () => Promise<string>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function tokensFromAuthResult(
  result: AuthSession.TokenResponse,
): StoredTokens {
  const expiresIn = result.expiresIn ?? 3600;
  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken ?? null,
    expiresAt: Date.now() + expiresIn * 1000,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const redirectUri = useMemo(() => getRedirectUri(), []);

  const discovery = useMemo(() => getDiscovery(), []);

  const hydrateUser = useCallback(async (token: string) => {
    const me = await fetchMe(token);
    const email = resolveEmployeeEmail(me);
    setUser({
      email,
      displayName: me.displayName?.trim() || email,
      me,
    });
    setAccessToken(token);
  }, []);

  const refreshAccessToken = useCallback(
    async (refreshToken: string): Promise<StoredTokens> => {
      assertAuthConfig();
      const result = await AuthSession.refreshAsync(
        {
          clientId: env.entraClientId,
          refreshToken,
          scopes: [...AUTH_SCOPES],
        },
        discovery,
      );
      const stored = tokensFromAuthResult(result);
      if (!stored.refreshToken) {
        stored.refreshToken = refreshToken;
      }
      await saveTokens(stored);
      return stored;
    },
    [discovery],
  );

  const getValidAccessToken = useCallback(async (): Promise<string> => {
    const stored = await loadTokens();
    if (!stored) {
      throw new Error("Nie ste prihlásený.");
    }

    const skewMs = 60_000;
    if (stored.expiresAt - skewMs > Date.now()) {
      setAccessToken(stored.accessToken);
      return stored.accessToken;
    }

    if (!stored.refreshToken) {
      await clearTokens();
      setUser(null);
      setAccessToken(null);
      throw new Error("Platnosť prihlásenia vypršala. Prihláste sa znova.");
    }

    const refreshed = await refreshAccessToken(stored.refreshToken);
    setAccessToken(refreshed.accessToken);
    return refreshed.accessToken;
  }, [refreshAccessToken]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const stored = await loadTokens();
        if (!stored) return;

        let token = stored.accessToken;
        if (stored.expiresAt - 60_000 <= Date.now()) {
          if (!stored.refreshToken) {
            await clearTokens();
            return;
          }
          const refreshed = await refreshAccessToken(stored.refreshToken);
          token = refreshed.accessToken;
        }

        if (!cancelled) {
          await hydrateUser(token);
        }
      } catch {
        await clearTokens();
        if (!cancelled) {
          setUser(null);
          setAccessToken(null);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrateUser, refreshAccessToken]);

  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: env.entraClientId || "missing-client-id",
      scopes: [...AUTH_SCOPES],
      redirectUri,
      usePKCE: true,
      responseType: AuthSession.ResponseType.Code,
      extraParams: {
        prompt: "select_account",
      },
    },
    discovery,
  );

  const signIn = useCallback(async () => {
    assertAuthConfig();
    if (!request) {
      throw new Error("Prihlásenie ešte nie je pripravené. Skúste znova.");
    }

    const result = await promptAsync({ showInRecents: true });
    if (result.type !== "success" || !result.params.code) {
      if (result.type === "dismiss" || result.type === "cancel") {
        return;
      }
      throw new Error(`Prihlásenie zlyhalo (${result.type}).`);
    }

    const tokenResult = await AuthSession.exchangeCodeAsync(
      {
        clientId: env.entraClientId,
        code: result.params.code,
        redirectUri,
        extraParams: {
          code_verifier: request.codeVerifier ?? "",
        },
      },
      discovery,
    );

    const stored = tokensFromAuthResult(tokenResult);
    await saveTokens(stored);
    await hydrateUser(stored.accessToken);
  }, [discovery, hydrateUser, promptAsync, redirectUri, request]);

  const signOut = useCallback(async () => {
    await clearTokens();
    setUser(null);
    setAccessToken(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      user,
      accessToken,
      redirectUri,
      signIn,
      signOut,
      getValidAccessToken,
    }),
    [accessToken, getValidAccessToken, ready, redirectUri, signIn, signOut, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth musí byť v AuthProvider.");
  }
  return ctx;
}