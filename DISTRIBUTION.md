# Distribúcia — Golpretech Dochádzka

Návod na zostavenie inštalačnej appky pre zamestnancov (nie Expo Go).

## Čo budete potrebovať

| Položka | Android | iOS |
|--------|---------|-----|
| Expo účet | [expo.dev](https://expo.dev) (bezplatný stačí na začiatok) | rovnako |
| Vývojársky účet | nie je nutný pre interné APK | Apple Developer Program (99 USD/rok) |
| Odporúčaný profil | **preview** (APK, priama inštalácia) | **preview** (ad hoc, max. 100 zariadení/rok) |

Balík appky: `com.golpretech.dochadzka`  
Redirect URI pre Entra ID (vždy): `golpretechdochadzka://auth`

---

## 1. Microsoft Entra ID (pred prvým buildom)

V **App registration** pre mobilnú appku:

1. **Authentication** → pridajte redirect URI:
   ```
   golpretechdochadzka://auth
   ```
2. **Mobile and desktop** → Allow public client flows: **Yes**
3. **API permissions** (delegated): `openid`, `profile`, `email`, `offline_access`, `User.Read`, `Sites.ReadWrite.All`
4. **Admin consent** pre `Sites.ReadWrite.All` (inak zamestnanci neuvidia SharePoint)

> Expo Go URI (`exp://…`) pri distribuovanom builde **nepotrebujete**.

---

## 2. EAS CLI a prihlásenie

```powershell
cd "C:\AI\Analýza odvodu hodín\Nová APP\golpretech-dochadzka"
npm install
npm install -g eas-cli
eas login
eas whoami
```

---

## 3. Environment premenné (SharePoint + Entra)

Lokálne máte `.env`. Na EAS build serveri sa `.env` neposiela — premenné musia byť v **EAS Environment**.

### Možnosť A — skript (odporúčané)

Vyplňte `.env` a spustite:

```powershell
.\scripts\push-eas-env.ps1
```

### Možnosť B — ručne v dashboarde

[expo.dev](https://expo.dev) → projekt **golpretech-dochadzka** → **Environment variables**

Pre **preview** aj **production** nastavte:

| Premenná | Príklad |
|----------|---------|
| `ENTRA_TENANT_ID` | váš tenant GUID |
| `ENTRA_CLIENT_ID` | app registration client ID |
| `SHAREPOINT_SITE_ID` | site ID z Graph |
| `SHAREPOINT_LIST_ZAKAZKY_ID` | … |
| `SHAREPOINT_LIST_OBJEDNAVKY_ID` | … |
| `SHAREPOINT_LIST_ZAZNAMY_ID` | … |
| `SHAREPOINT_LIST_UKONY_ID` | zoznam úkonov s minútovou sadzbou |
| `SHAREPOINT_LIST_VOZIDLA_ID` | zoznam služobných vozidiel (displayName: Vozidla) |
| `SHAREPOINT_LIST_REZERVACIE_ID` | zoznam rezervácií vozidiel (displayName: Rezervacie) |

---

## 4. Android — interná distribúcia (APK)

Najjednoduchšia cesta pre firemné telefóny:

```powershell
npm run build:android
# alebo: eas build --platform android --profile preview
```

- Prvý build: EAS sa opýta na **keystore** → zvoľte **Generate new keystore** (EAS ho uloží).
- Po dokončení: odkaz na stiahnutie APK na [expo.dev/builds](https://expo.dev/builds).
- APK pošlite zamestnancom (mail, Teams, QR kód). Pri inštalácii povoliť „Neznáme zdroje“.

### Google Play (voliteľne neskôr)

```powershell
npm run build:android:store
# eas build --platform android --profile production
```

Výsledok je **AAB** pre Play Console. Upload: `eas submit --platform android --profile production`.

---

## 5. iOS — interná distribúcia (ad hoc)

1. Zaregistrujte zariadenie:
   ```powershell
   eas device:create
   ```
2. Build:
   ```powershell
   npm run build:ios
   # eas build --platform ios --profile preview
   ```
3. Nainštalujte cez odkaz z EAS (Safari) alebo Apple Configurator.

Nové zariadenie = nový build (alebo `eas build:resign`).

### App Store / TestFlight

```powershell
npm run build:ios:store
eas submit --platform ios --profile production
```

---

## 6. Profily buildov (`eas.json`)

| Profil | Účel |
|--------|------|
| `development` | Dev client + expo-dev-client |
| `preview` | Interné testovanie (APK / ad hoc iOS) |
| `production` | Obchody (AAB / App Store), autoIncrement verzie |

---

## 7. Kontrola pred odoslaním zamestnancom

- [ ] Prihlásenie Microsoft funguje v **natívnej** appke (nie Expo Go)
- [ ] Načítajú sa zákazky / objednávky
- [ ] Uloženie zápisu do SharePointu
- [ ] Úprava záznamu za posledný týždeň
- [ ] Redirect URI `golpretechdochadzka://auth` je v Entra ID

---

## 8. Aktualizácia verzie

1. Zvýšte `"version"` v `app.config.js` (napr. `1.0.1`).
2. Pre Android môžete zvýšiť `android.versionCode`.
3. Spustite nový build rovnakým príkazom.
4. Profil `production` má `autoIncrement: true` — EAS môže verziu zvýšiť automaticky.

---

## Rýchla referencia príkazov

```powershell
eas login
.\scripts\push-eas-env.ps1
npm run build:android          # APK pre zamestnancov
npm run build:android:store    # Google Play
npm run build:ios              # ad hoc iOS
npm run build:ios:store        # App Store
eas build:list
```
