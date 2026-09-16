import * as AuthSession from "expo-auth-session";
import { env } from "../config/env";

export const AUTH_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Sites.ReadWrite.All",
] as const;

/** Redirect URI pre Entra ID — skopírujte do App registration → Authentication. */
export function getRedirectUri(): string {
  return AuthSession.makeRedirectUri({
    scheme: "golpretechdochadzka",
    path: "auth",
  });
}

export function getDiscovery(): AuthSession.DiscoveryDocument {
  const tenant = env.entraTenantId;
  return {
    authorizationEndpoint: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    tokenEndpoint: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
  };
}