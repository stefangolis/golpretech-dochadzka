const path = require("path");

// Lokálny vývoj: .env. EAS Build: premenné z EAS Environment (preview / production).
if (!process.env.EAS_BUILD && !process.env.CI) {
  require("dotenv").config({ path: path.resolve(__dirname, ".env") });
}

function env(name) {
  return process.env[name]?.trim() ?? "";
}

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  name: "Golpretech Dochádzka",
  slug: "golpretech-dochadzka",
  version: "1.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  scheme: "golpretechdochadzka",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#0B3D2E",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.golpretech.dochadzka",
    buildNumber: "2",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#0B3D2E",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    package: "com.golpretech.dochadzka",
    versionCode: 2,
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: ["expo-secure-store", "expo-web-browser"],
  extra: {
    entraTenantId: env("ENTRA_TENANT_ID"),
    entraClientId: env("ENTRA_CLIENT_ID"),
    sharePointSiteId: env("SHAREPOINT_SITE_ID"),
    sharePointListZakazkyId: env("SHAREPOINT_LIST_ZAKAZKY_ID"),
    sharePointListObjednavkyId: env("SHAREPOINT_LIST_OBJEDNAVKY_ID"),
    sharePointListZaznamyId: env("SHAREPOINT_LIST_ZAZNAMY_ID"),
    sharePointListUkonyId: env("SHAREPOINT_LIST_UKONY_ID"),
    sharePointListVozidlaId: env("SHAREPOINT_LIST_VOZIDLA_ID"),
    sharePointListRezervacieId: env("SHAREPOINT_LIST_REZERVACIE_ID"),
    eas: {
      projectId: "bcabec9d-2a1f-43e9-828d-a0d57b3be143",
    },
  },
};
