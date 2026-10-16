import Constants from "expo-constants";
import { cs } from "../i18n/cs";

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
  sharePointListDochadzkaUdalostiId?: string;
  sharePointListDochadzkaNfcTagyId?: string;
  sharePointListDochadzkaOpravneniaId?: string;
  sharePointListDochadzkaZiadostiId?: string;
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
  get sharePointListDochadzkaUdalostiId() {
    return extra().sharePointListDochadzkaUdalostiId?.trim() ?? "";
  },
  get sharePointListDochadzkaNfcTagyId() {
    return extra().sharePointListDochadzkaNfcTagyId?.trim() ?? "";
  },
  get sharePointListDochadzkaOpravneniaId() {
    return extra().sharePointListDochadzkaOpravneniaId?.trim() ?? "";
  },
  get sharePointListDochadzkaZiadostiId() {
    return extra().sharePointListDochadzkaZiadostiId?.trim() ?? "";
  },
};

export function assertAuthConfig(): void {
  if (!env.entraTenantId || !env.entraClientId) {
    throw new Error(cs.auth.chybiEntra);
  }
}