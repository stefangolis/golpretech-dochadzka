import Constants from "expo-constants";

type Extra = {
  entraTenantId?: string;
  entraClientId?: string;
  sharePointSiteId?: string;
  sharePointListZakazkyId?: string;
  sharePointListObjednavkyId?: string;
  sharePointListZaznamyId?: string;
  sharePointListUkonyId?: string;
  sharePointListVozidlaId?: string;
  sharePointListRezervacieId?: string;
};

function extra(): Extra {
  return (Constants.expoConfig?.extra ?? {}) as Extra;
}

export const env = {
  get entraTenantId() {
    return extra().entraTenantId?.trim() ?? "";
  },
  get entraClientId() {
    return extra().entraClientId?.trim() ?? "";
  },
  get sharePointSiteId() {
    return extra().sharePointSiteId?.trim() ?? "";
  },
  get sharePointListZakazkyId() {
    return extra().sharePointListZakazkyId?.trim() ?? "";
  },
  get sharePointListObjednavkyId() {
    return extra().sharePointListObjednavkyId?.trim() ?? "";
  },
  get sharePointListZaznamyId() {
    return extra().sharePointListZaznamyId?.trim() ?? "";
  },
  get sharePointListUkonyId() {
    return extra().sharePointListUkonyId?.trim() ?? "";
  },
  get sharePointListVozidlaId() {
    return extra().sharePointListVozidlaId?.trim() ?? "";
  },
  get sharePointListRezervacieId() {
    return extra().sharePointListRezervacieId?.trim() ?? "";
  },
};

export function assertAuthConfig(): void {
  if (!env.entraTenantId || !env.entraClientId) {
    throw new Error(
      "Chýba ENTRA_TENANT_ID alebo ENTRA_CLIENT_ID v súbore .env (reštartujte Expo po úprave).",
    );
  }
}