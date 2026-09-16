# Golpretech Dochádzka (Expo)

Mobilná appka pre zápis odpracovaných minút vo výrobe.

Stack: **Expo (managed) + TypeScript**, prihlásenie cez **Microsoft Entra ID** (`expo-auth-session` + PKCE), dáta neskôr cez Microsoft Graph → SharePoint.

## Spustenie

```powershell
cd "C:\AI\Analyza_odvodu_hodin\Nová APP\golpretech-dochadzka"
copy .env.example .env
npm install
npx expo start
```

Vyplňte v `.env` aspoň:

- `ENTRA_TENANT_ID`
- `ENTRA_CLIENT_ID`

Po zmene `.env` **reštartujte** Expo (`Ctrl+C` a znova `npx expo start`).

## Redirect URI (dôležité — Entra ID)

Appka používa scheme `golpretechdochadzka` a path `auth`.

### Čo skopírovať do Entra ID

V Azure Portal → **App registrations** → vaša app → **Authentication** → **Add a platform** → **Mobile and desktop applications** (alebo Custom redirect URI) pridajte:

```
golpretechdochadzka://auth
```

Toto je primárny redirect URI pre development build / Expo s custom scheme.

### Ako zistiť presnú URI na vašom zariadení

1. Spustite appku (`npx expo start` → Android/iOS).
2. Na prihlasovacej obrazovke je box **Redirect URI (do Entra ID)** — text je selectable.
3. Skopírujte **presne** tú hodnotu do Entra ID (musí sedieť 1:1).

V Expo Go môže byť URI iná (napr. `exp://192.168.x.x:8081/--/auth`). Ak testujete cez Expo Go, pridajte do Entra ID aj túto URI.

Odporúčanie pre produkciu / stabilný test: použiť **development build** alebo Expo scheme `golpretechdochadzka://auth`.

### Entra ID nastavenie (stručne)

- Single-tenant (len váš directory)
- Public client (žiadny client secret)
- Allow public client flows: **Yes**
- API permissions (delegated): `openid`, `profile`, `email`, `offline_access`, `User.Read`, `Sites.ReadWrite.All`
- Redirect URI: pozri vyššie

## Aktuálny stav

- [x] Scaffold Expo + TypeScript
- [x] Prihlásenie Microsoft (Authorization Code + PKCE)
- [x] Tokeny v `expo-secure-store` + refresh
- [x] Zobrazenie emailu prihláseného užívateľa (`GET /me`)
- [x] Zoznam aktívnych zákaziek / objednávok zo SharePointu (React Query)
- [x] Formulár minút + zápis do `Casove_zaznamy`
- [x] Prehľad vlastných záznamov (7 dní)

## Štruktúra

```
src/
  auth/          # OAuth + SecureStore
  api/           # Microsoft Graph (zatiaľ /me)
  screens/       # Login + Home
  navigation/
  config/
App.tsx
app.config.js
.env.example
```
## SharePoint (.env)

Vyplňte aj:

- `SHAREPOINT_SITE_ID`
- `SHAREPOINT_LIST_ZAKAZKY_ID`
- `SHAREPOINT_LIST_OBJEDNAVKY_ID`
- `SHAREPOINT_LIST_ZAZNAMY_ID`
- `SHAREPOINT_LIST_UKONY_ID`

Zoznam `Casove_zaznamy` by mal mať stĺpce: `ZamestnanecEmail`, `Datum`, `ZakazkaId`, `CisloObjednavky`, `Minuty`, `Ukon`, `MinutovaSadzba`, `Cena`, `Rework`, `Poznamka`, `CasZapisu` (+ `Title`).

Pri ukladaní sa **Cena** počíta automaticky: `MinutovaSadzba × Minuty`.

Zoznam **Úkony** (nový SharePoint list): `Title` (názov úkonu), `MinutovaSadzba` (číslo), voliteľne `Aktivny` (Áno/Nie — zobrazia sa len aktívne).

## Distribúcia (EAS Build)

Kompletný návod pre APK / App Store: **[DISTRIBUTION.md](./DISTRIBUTION.md)**

Rýchly štart pre Android (interné APK):

```powershell
npm install -g eas-cli
eas login
.\scripts\push-eas-env.ps1
npm run build:android
```

Po builde stiahnite APK z [expo.dev/builds](https://expo.dev/builds) a nainštalujte na telefóny zamestnancov.

## Lokálny Android build (Windows)

`expo prebuild` / `expo run:android` môže zlyhať, ak cesta stále obsahuje **diakritiku alebo medzery** (napr. priečinok `Nová APP`).

Po premenovaní na `Analyza_odvodu_hodin` použite junction (minule fungovalo):

```powershell
cd "C:\AI\Analyza_odvodu_hodin\Nová APP\golpretech-dochadzka"
.\scripts\run-android-dev.ps1
```

Skript vytvorí `C:\dev\golpretech-dochadzka`, spustí prebuild a `expo run:android`.

Alternatíva: celý projekt do `C:\dev\golpretech-dochadzka`.