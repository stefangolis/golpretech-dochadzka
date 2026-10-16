const path = require("path");

// Lokálny vývoj: .env. EAS Build: premenné z EAS Environment (preview / production).
if (!process.env.EAS_BUILD && !process.env.CI) {
  require("dotenv").config({ path: path.resolve(__dirname, ".env") });
}

function env(name) {
  return process.env[name]?.trim() ?? "";
}

/**
 * NFC nálepka (URI golpretechdochadzka://dochadzka?tag=…) otvorí appku cez NDEF_DISCOVERED.
 * `android.intentFilters` v Expo vie len akcie `android.intent.action.*`, preto vlastný plugin.
 * Prihlasovací redirect golpretechdochadzka://auth ostáva na samostatnom VIEW filtri zo `scheme`.
 */
function withDochadzkaNfcIntentFilter(config) {
  const { withAndroidManifest, AndroidConfig } = require("expo/config-plugins");
  const NDEF_ACTION = "android.nfc.action.NDEF_DISCOVERED";
  return withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    const filters = (activity["intent-filter"] ?? []).filter(
      (f) => !(f.action ?? []).some((a) => a.$?.["android:name"] === NDEF_ACTION),
    );
    filters.push({
      action: [{ $: { "android:name": NDEF_ACTION } }],
      category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
      data: [{ $: { "android:scheme": "golpretechdochadzka", "android:host": "dochadzka" } }],
    });
    activity["intent-filter"] = filters;
    return cfg;
  });
}

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  name: "Golpretech Docházka",
  slug: "golpretech-dochadzka",
  version: "1.3.0",
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
    versionCode: 3,
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-secure-store",
    "expo-web-browser",
    [
      "expo-image-picker",
      {
        cameraPermission:
          "Aplikácia potrebuje fotoaparát na fotografovanie stavu vozidla.",
        photosPermission:
          "Aplikácia potrebuje prístup k fotkám na priloženie fotografií stavu vozidla.",
        microphonePermission: false,
      },
    ],
    [
      "expo-notifications",
      {
        color: "#0B3D2E",
      },
    ],
    [
      "react-native-nfc-manager",
      {
        nfcPermission: "Aplikácia číta NFC nálepku pri vchode na zápis dochádzky.",
      },
    ],
    "expo-audio",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Aplikácia zaznamená polohu jednorazovo pri zápise dochádzky bez nálepky.",
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
        isIosBackgroundLocationEnabled: false,
      },
    ],
    withDochadzkaNfcIntentFilter,
  ],
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
    sharePointListDochadzkaUdalostiId: env("SHAREPOINT_LIST_DOCHADZKA_UDALOSTI_ID"),
    sharePointListDochadzkaNfcTagyId: env("SHAREPOINT_LIST_DOCHADZKA_NFC_TAGY_ID"),
    sharePointListDochadzkaOpravneniaId: env("SHAREPOINT_LIST_DOCHADZKA_OPRAVNENIA_ID"),
    sharePointListDochadzkaZiadostiId: env("SHAREPOINT_LIST_DOCHADZKA_ZIADOSTI_ID"),
    eas: {
      projectId: "bcabec9d-2a1f-43e9-828d-a0d57b3be143",
    },
  },
};
