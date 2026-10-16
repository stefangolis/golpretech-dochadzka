/**
 * Všechny texty, které vidí uživatel (spisovná čeština).
 * Interní názvy a hodnoty v SharePointu (Prichod, SluzobnaCesta, Ziadost…) se zde NEPŘEKLÁDAJÍ —
 * jsou to jen klíče, ke kterým patří český text.
 */

/** 1 den / 2 dny / 5 dní */
export function pocetDni(n: number): string {
  if (n === 1) return "1 den";
  if (n >= 2 && n <= 4) return `${n} dny`;
  return `${n} dní`;
}

/** 1 hodina / 2 hodiny / 5 hodin (celé číslo) */
export function pocetHodinSlovy(n: number): string {
  if (n === 1) return "1 hodina";
  if (n >= 2 && n <= 4) return `${n} hodiny`;
  return `${n} hodin`;
}

export const cs = {
  nazov: "Golpretech Docházka",

  moduly: {
    dochazka: "Docházka",
    odvod: "Odvod hodin",
    vozidla: "Vozidla",
  },

  spolecne: {
    zpet: "← Zpět",
    zpetHub: "← Hub",
    ano: "Ano",
    ne: "Ne",
    ok: "OK",
    ulozit: "Uložit",
    ukladam: "Ukládám…",
    zrusit: "Zrušit",
    zavrit: "Zavřít",
    potvrdit: "Potvrdit",
    pokracovat: "Pokračovat",
    odeslat: "Odeslat",
    upravit: "Upravit",
    smazat: "Smazat",
    hotovo: "Hotovo",
    nacitam: "Načítám…",
    obnovit: "Obnovit",
    zkusitZnovu: "Zkus to znovu",
    hledat: "Hledat",
    vybrat: "Vybrat",
    nevybrano: "Nevybráno",
    chyba: "Chyba",
    neznamaChyba: "Neznámá chyba",
    nepodariloSeNacist: "Nepodařilo se načíst data.",
    nejstePrihlasen: "Nejsi přihlášen.",
    nepodariloSeZiskatToken: "Nepodařilo se získat přístupový token. Přihlas se znovu.",
    offline: "Jsi offline. Zkontroluj připojení k internetu.",
    casovyLimit: (co: string) => `${co}: vypršel časový limit spojení.`,
    skryt: "Skrýt",
    opravit: "Opravit",
    dnes: "Dnes",
    vyberte: "Vyber…",
  },

  auth: {
    platnostVyprsela: "Platnost přihlášení vypršela. Přihlas se znovu.",
    neniPripraveno: "Přihlášení ještě není připravené. Zkus to znovu.",
    zlyhalo: (typ: string) => `Přihlášení selhalo (${typ}).`,
    useAuthMimo: "useAuth musí být uvnitř AuthProvider.",
    chybiEntra:
      "Chybí ENTRA_TENANT_ID nebo ENTRA_CLIENT_ID v souboru .env (restartuj Expo po úpravě).",
    graphBezEmailu: "Účet Microsoft nemá e-mail (mail ani userPrincipalName).",
    graphMeZlyhal: (status: number, telo: string) =>
      `Načtení profilu selhalo (HTTP ${status}): ${telo}`,
  },

  prihlaseni: {
    titulek: "Golpretech Docházka",
    podtitulek: "Přihlas se firemním účtem Office 365.",
    prihlasit: "Přihlas se přes Microsoft",
    redirectUri: "Redirect URI (do Entra ID):",
  },

  hub: {
    odhlasit: "Odhlásit",
    coChceteDelat: "Co chceš dělat?",
    dnesBezZaznamu: "Dnes bez záznamu",
    dnesZapsano: (min: number) => `Dnes zapsáno: ${min} min`,
    veFronte: (stav: string, pocet: number) => `${stav} · čeká na odeslání: ${pocet}`,
  },

  notifikace: {
    kanalRezervace: "Rezervace vozidel",
    konecRezervaceTitulek: "Rezervace vozidla",
    konecRezervaceText: "Dnes ti končí rezervace vozidla, nezapomeň na odevzdání nebo prodloužení.",
  },

  odvod: {
    minuty: {
      nadZapis: (minuty: number, hm: string) =>
        `Zapisuješ ${minuty} minut (${hm}), tedy víc než 8 hodin na jeden záznam.`,
      nadDen: (datum: string, minuty: number, hm: string) =>
        `Po tomto záznamu budeš mít ${datum} odpracováno ${minuty} minut (${hm}).`,
      opravduUlozit: "Opravdu uložit?",
      pokracovat: "Pokračovat?",
    },
    validace: {
      datumNovy: "Datum může být jen dnes nebo v rámci posledního týdne (ne v budoucnosti).",
      datumUprava: "Datum může být jen v rámci posledního týdne (ne v budoucnosti).",
      vyberteZakazku: "Vyber zakázku nebo objednávku.",
      minuty: "Minuty musí být celé číslo od 1 do 720.",
      vyberteUkon: "Vyber úkon ze seznamu.",
      reworkPoznamka: "U Rework je poznámka povinná.",
    },
    titulek: "Odvod hodin",
    novyZapis: "Nový zápis",
    datum: "1. Datum *",
    zakazka: "2. Zakázka / objednávka *",
    minutyLabel: "3. Minuty (1–720) *",
    ukon: "4. Úkon *",
    poznamka: "Poznámka",
    rucne: "ručně",
    vyberteZakazku: "Vyber zakázku nebo objednávku…",
    vyberteUkon: "Vyber úkon…",
    poznamkaPovinna: "Povinná u Rework",
    poznamkaVolitelna: "Nepovinná",
    ulozitZapis: "Uložit zápis",
    skontrolujMinuty: "Zkontroluj minuty",
    ulozene: (minuty: number, ukon: string) => `Uloženo: ${minuty} min · ${ukon}`,
    skontrolujteFormular: "Zkontroluj formulář.",
    mojeZaznamy: "Moje záznamy",
    posledniTyden: "Poslední týden",
    prazdne: "Zatím žádné záznamy.",
    zobrazitVse: (n: number) => `Zobrazit všechny (${n})`,
    upravitZaznamy: "Upravit záznamy",
    klepnutimUpravite: "Ťukni a upravíš",
    upravitZaznam: "Upravit záznam",
    ulozitZmeny: "Uložit změny",
    staryZaznam: "Záznam starší než týden nelze upravit.",
    manualne: "Manuálně",
    minutyTitulek: "Minuty",
    nacteniZaznamu: "Nepodařilo se načíst záznamy.",
    datumKratky: "Datum *",
    zakazkaKratka: "Zakázka / objednávka *",
    rework: "Rework",
  },

  vozidla: {
    stav: {
      neodevzdano: (kdo: string) => `Neodevzdáno (${kdo})`,
      obsazenoDo: (datum: string, kdo: string) => `Obsazeno do ${datum} (${kdo})`,
      volneDnes: "Dnes volné",
      zadnaRezervace: "Žádná rezervace",
      prevzatoOdevzdat: (vozidlo: string) => `Vozidlo ${vozidlo} – převzato, odevzdat`,
      prevzit: (vozidlo: string) => `Vozidlo ${vozidlo} – převzít`,
      rezervovano: (vozidlo: string, obdobi: string) => `Rezervováno: ${vozidlo} ${obdobi}`,
    },
    titulek: "Vozidla",
    mojeRezervace: "Moje rezervace",
    zadnaAktivni: "Žádná aktivní rezervace.",
    prevzate: " · Převzato",
    neodovzdanoPoTermine:
      "Neodevzdáno po termínu — odevzdej vozidlo nebo prodluž rezervaci.",
    zakazka: (id: string) => `Zakázka: ${id}`,
    cil: (text: string) => `Cíl: ${text}`,
    zmenit: "Změnit",
    prevzitTlacitko: "Převzít",
    odevzdatTlacitko: "Odevzdat",
    zmenitKonec: "Změnit konec",
    zrusitRezervaci: "Zrušit rezervaci",
    zrusitRezervaciOtazka: "Zrušit rezervaci?",
    dostupnost14: "Dostupnost na 14 dní",
    zadnaAktivniVozidla: "Žádná aktivní vozidla.",
    neodovzdane: " (neodevzdáno)",
    prevzateZavorka: " (převzato)",
    novaRezervace: "Nová rezervace",
    zmenitKonecTitulek: "Změnit konec rezervace",
    zmenitRezervaci: "Změnit rezervaci",
    vozidlo: "Vozidlo",
    vozidloPovinno: "1. Vozidlo *",
    termin: "2. Termín (od – do) *",
    zakazkaPovinna: "3. Zakázka *",
    cilCesty: "4. Cíl cesty *",
    termin1: "1. Termín (od – do) *",
    zakazka2: "2. Zakázka *",
    cilCesty3: "3. Cíl cesty *",
    ulozitZmeny: "Uložit změny",
    cilPlaceholder: "např. JUTA a.s., Dvůr Králové",
    vyberteVozidlo: "Vyber vozidlo…",
    ulozitRezervaci: "Uložit rezervaci",
    rezervaceUlozena: "Rezervace uložena.",
    nacteniZakazek: "Nepodařilo se načíst zakázky.",
    terminJeden: (datum: string) => `${datum} (${pocetDni(1)})`,
    terminRozsah: (od: string, doDate: string, n: number) =>
      `${od} – ${doDate} (${pocetDni(n)})`,
    chyby: {
      vyberteVozidlo: "Vyber vozidlo.",
      odVMinulosti: "Datum Od nemůže být v minulosti.",
      doPredOdem: "Datum Do musí být stejné nebo pozdější než Od.",
      maxDelka: (n: number) => `Maximální délka rezervace je ${pocetDni(n)}.`,
      vyberteZakazku: "Vyber zakázku nebo objednávku.",
      cilPovinny: "Cíl cesty je povinný.",
      konecPredZacatkem:
        "Konec rezervace nemůže být před začátkem ani v minulosti.",
      kolize: (kdo: string, obdobi: string) =>
        `Kolize s rezervací ${kdo}, ${obdobi}.`,
      kolizePozde: (kdo: string, obdobi: string) =>
        `Pozor: kolize s rezervací ${kdo}, ${obdobi} — dohodni se, prosím.`,
    },
    api: {
      nenalezena: "Rezervace se v SharePointu nenašla.",
      http: (status: number, telo: string) => `Rezervace HTTP ${status}: ${telo}`,
      uzPrevzata: "Rezervace je už převzatá — vozidlo je potřeba odevzdat, ne zrušit.",
      uzNelzeZrusit: "Rezervaci už nelze zrušit (je vrácená nebo zrušená).",
      chybiEnv:
        "Chybí SHAREPOINT_LIST_VOZIDLA_ID nebo SHAREPOINT_LIST_REZERVACIE_ID v .env (restartuj Expo po úpravě).",
      spatnaId: (vozidla: string, rezervace: string) =>
        `Seznamy vozidel/rezervací v .env pravděpodobně nemají správné ID. SHAREPOINT_LIST_VOZIDLA_ID → „${vozidla}“ (očekávané: Vozidla), SHAREPOINT_LIST_REZERVACIE_ID → „${rezervace}“ (očekávané: Rezervacie).`,
      chybiSloupec: (sloupec: string) => `V seznamu Rezervacie chybí sloupec ${sloupec}.`,
      sloupecVolba: (nazev: string, sloupec: string, hodnota: string, povolene: string) =>
        `Sloupec „${nazev}“ (${sloupec}) v seznamu Rezervacie nepovoluje hodnotu „${hodnota}“. Povolené hodnoty: ${povolene}.`,
    },
    prevzeti: {
      titulek: "Převzetí vozidla",
      tachometr: "Stav tachometru (km) *",
      placeholderKm: "např. 125430",
      nacitamKm: "Načítám poslední stav…",
      posledniZnamy: (km: number) => `Poslední známý stav: ${km} km`,
      stavVozidla: "Stav vozidla *",
      bezVyhrad: "Bez výhrad",
      sVyhradou: "S výhradou",
      vyhrada: "Výhrada *",
      vyhradaPlaceholder: "např. škrábanec na zadním nárazníku",
      fotky: "Fotky (1–5) *",
      prevzitVozidlo: "Převzít vozidlo",
      zadajteKm: "Zadej stav tachometru (celé číslo v km).",
      vyberteStav: "Vyber stav vozidla.",
      popisVyhradu: "Popiš výhradu.",
      pridejteFotku: "Při výhradě přidej alespoň 1 fotku.",
      tachometrTitulek: "Stav tachometru",
      nizsiNezZnamy: (km: number) =>
        `Stav je nižší než poslední známý (${km} km). Zkontroluj.`,
    },
    odevzdani: {
      titulek: "Odevzdání vozidla",
      skorsie: (datum: string) =>
        `Odevzdáváš dřív — rezervace se ukončí dnes (původně do ${datum}).`,
      priPrevzeti: (km: number) => `Při převzetí: ${km} km`,
      popisPoskozeni: "Popis poškození *",
      poskozeniPlaceholder: "co a kde je poškozené",
      odevzdatVozidlo: "Odevzdat vozidlo",
      bezPoskozeni: "Bez poškození",
      sPoskozenim: "S poškozením",
      nizsiNezPrevzeti: (km: number) =>
        `Stav tachometru nemůže být nižší než při převzetí (${km} km).`,
      popisPoskozeniChyba: "Popiš poškození.",
      pridejteFotku: "Při poškození přidej alespoň 1 fotku.",
      najeto: (km: number, limit: number) =>
        `Naježděno ${km} km (víc než ${limit} km). Zkontroluj stav tachometru.`,
    },
    fotky: {
      titulek: "Fotka",
      zpracovani: "Fotku se nepodařilo zpracovat.",
      fotoaparat: "Fotoaparát",
      bezPovoleni:
        "Bez povolení fotoaparátu nelze fotit. Povol ho v nastavení nebo vyber fotku z galerie.",
      odfotit: "Vyfotit",
      zGalerie: "Z galerie",
      pocet: (n: number, max: number) => `${n}/${max} fotek`,
      nahravam: (done: number, total: number) => `Nahrávám ${done}/${total}…`,
      knihovny: (status: number, telo: string) =>
        `Knihovny dokumentů se nepodařilo načíst (HTTP ${status}): ${telo}`,
      chybiKnihovna: (nazev: string, dostupne: string) =>
        `Na SharePoint site chybí knihovna dokumentů „${nazev}“. Dostupné knihovny: ${dostupne}`,
      bezZapisu: (nazev: string) =>
        `Nemáš oprávnění zapisovat do knihovny „${nazev}“ (403). Požádej správce o přístup.`,
      nahraniZlyhalo: (cesta: string, status: number, telo: string) =>
        `Nahrání fotky ${cesta} selhalo (HTTP ${status}): ${telo}`,
    },
  },

  picker: {
    zakazkaObjednavka: "Zakázka / objednávka",
    hledat: "Hledat kód, název, zákazníka…",
    nicNenalezeno: "Nic nenalezeno.",
    nacteniSeznamu: "Nepodařilo se načíst seznam.",
    ukon: "Úkon",
    nacteniUkonu: "Nepodařilo se načíst úkony.",
    prazdnySeznamUkonu: "Seznam úkonů je prázdný.",
  },

  sharepoint: {
    chybiEnv:
      "Chybí SharePoint proměnné v .env (SITE_ID / LIST_*). Restartuj Expo po úpravě.",
    nematePristup:
      "Nemáš přístup k SharePoint seznamu (403). Požádej správce, aby ti na webu docházky přidal oprávnění Upravit (seznamy Zakázky, Přijaté objednávky a Časové záznamy).",
    prihlaseniVyprslo: "Přihlášení vypršelo. Odhlas se a přihlas se znovu.",
    chybiSiteId: "Chybí SHAREPOINT_SITE_ID v .env (restartuj Expo po úpravě).",
    chybiSeznam: (envName: string, displayName: string) =>
      `Chybí ${envName} a seznam ${displayName} se na SharePoint site nenašel.`,
    chybiSloupecDostupne: (seznam: string, sloupec: string, dostupne: string) =>
      `V seznamu ${seznam} chybí sloupec ${sloupec}. Dostupné sloupce: ${dostupne}`,
    mapovaniPoli: (msg: string, summary: string) =>
      `${msg}\nMapování polí: ${summary}`,
    neznamaPole: (seznam: string, pole: string, dostupne: string) =>
      `Seznam „${seznam}“ nezná pole: ${pole}. Interní názvy sloupců Graph API: ${dostupne}`,
  },

  dochazka: {
    typ: {
      Prichod: "Příchod",
      Odchod: "Odchod",
      SukromnyOdchod: "Soukromý odchod",
      SluzobnyOdchod: "Služební odchod",
      Lekar: "Lékař",
      FajciarskaPrestavka: "Kuřácká přestávka",
    },
    dnes: {
      cekaNaOdeslani: "čeká na odeslání",
      zrusena: "zrušená",
      schvaleno: "schváleno",
      vPraciOd: (cas: string) => `V práci od ${cas}`,
      mimoPraci: "Mimo práci",
      preruseni: (typ: string, cas: string) =>
        `${typ} od ${cas} — počítá se do odpracované doby`,
      odpracovano: (cas: string) => `Dnes odpracováno ≈ ${cas}`,
      prubezne: " (průběžně)",
      obed: "včetně odpočtu 30 min na oběd",
      zToSluzebniCesta: (cas: string) => `z toho služební cesta ${cas} (bez oběda)`,
      dovolenaNv: (cas: string) => `Dovolená / NV: ${cas}`,
      keSchvaleni: (pocet: number) => `Ke schválení: ${pocet}`,
      keSchvaleniNapoveda: "Ťukni pro zobrazení žádostí.",
      veFronte: (pocet: number) => `Čeká na odeslání: ${pocet}`,
      odesleSeSamo: "Odešle se automaticky po připojení k internetu.",
      posledniChyba: (chyba: string) => `Poslední chyba: ${chyba}`,
      odeslatTed: "Odeslat teď",
      nfcNepodporovano: "Telefon nepodporuje NFC",
      nfcNepodporovanoText: "Záznam přes nálepku na tomto telefonu není možný.",
      nfcVypnuto: "NFC je vypnuté",
      nfcVypnutoText:
        "Zapni NFC v Nastavení telefonu (Připojená zařízení → Předvolby připojení → NFC, nebo stáhni lištu shora a ťukni na NFC). Potom přilož telefon k nálepce u vchodu.",
      nfcNastaveni: "Otevřít nastavení NFC",
      prilozTelefon: "Přilož telefon k nálepce u vchodu",
      prilozTelefonText: "Obrazovka musí být zapnutá a odemčená — aplikace se otevře sama.",
      bezNalepky: "Zapsat bez nálepky",
      dnesniUdalosti: "Dnešní události",
      zadnaUdalost: "Dnes zatím žádná událost.",
      mujMesic: "Můj měsíc",
      zadosti: (keSchvaleni: number) =>
        keSchvaleni ? `Žádosti · ke schválení ${keSchvaleni}` : "Žádosti",
      hlas: "Zvuk a hlas",
      hlasPopis: "Po přiložení nálepky a po zápisu příchodu a odchodu",
    },
    mesic: {
      zustatekNenastaven: "Zůstatek zatím není nastaven – kontaktuj HR",
      fond: "Měsíční fond",
      fondPopis: (dni: number, hodinyDen: string) =>
        `${dni} pracovních dní × ${hodinyDen} (bez víkendů a svátků ČR)`,
      odpracovano: (cas: string) => `Odpracováno ≈ ${cas}`,
      dovolenaNv: (cas: string) => ` · dovolená / NV ${cas}`,
      chybiOdchod: (dni: number) => `⚠ chybí odchod: ${dni} d.`,
      zustatky: "Aktuální zůstatky",
      zustatekDovolene: "Zůstatek dovolené",
      naplanovano: (hodiny: string, dni: string) => `z toho naplánováno: ${hodiny} · ${dni}`,
      cekaNaSchvaleni: (hodiny: string, dni: string) => `čeká na schválení: ${hodiny} · ${dni}`,
      dovolenaStavK: (datum: string) => `Stav k ${datum} mínus schválené dovolené po tomto dni.`,
      zustatekPrescasu: "Zůstatek přesčasů",
      chybiOdchodNeuplne: (dni: number) =>
        `⚠ chybí odchod: ${dni} d. — tyto dny jsou započítány neúplně`,
      prescasyStavK: (datum: string) => `Orientačně, uzávěrku dělá HR. Stav k ${datum}.`,
    },
    pristup: {
      titulek: "Bez přístupu",
      text: "Nemáš přístup k Docházce, kontaktuj HR",
    },
    zapis: {
      zapsan: "zapsán",
      zapsana: "zapsána",
      bezPripojeni: " — bez připojení, odešle se později",
      polohaZjistuji: "zjišťuji…",
      polohaNepovolena: "nepovolena (zápis je možný)",
      polohaNedostupna: "nedostupná (zápis je možný)",
      polohaZjistenaPresnost: (m: string) => `zjištěna (${m} m)`,
      polohaZjistena: "zjištěna",
      nalepka: "Nálepka",
      overena: "ověřená",
      prilozenaV: (cas: string) => ` · přiložena v ${cas}`,
      bezNalepkyPoloha: (poloha: string) => `Zápis bez nálepky · poloha ${poloha}`,
      overujiNalepku: "Ověřuji nálepku…",
      nalepkuNelzeOverit: "Nálepku se nepodařilo ověřit",
      nalepkaOfflineText:
        "Bez připojení se nálepka ověří jen tehdy, pokud má aplikace uložený seznam nálepek. Zkus to znovu po připojení.",
      neznamyTag: "Neznámý tag",
      neznamyTagText: "Tato nálepka není v seznamu aktivních nálepek. Nic se nezapsalo.",
      uidNalepky: "UID nálepky (sloupec TagUID v DochadzkaNfcTagy):",
      zkopirovano: "Zkopírováno",
      kopirovatUid: "Kopírovat UID",
      zkontrolovatZnovu: "Zkontroluj znovu",
      bezNalepkyNepovoleno: "Zápis bez nálepky není povolen",
      prilozTelefon: "Přilož telefon k nálepce u vchodu.",
      uzZapsano: (typ: string, cas: string) => `Už zapsáno: ${typ} ${cas}`,
      opakovanePrilozeni: "Opakované přiložení do 60 sekund nový záznam nevytváří.",
      potvrditTed: "Potvrdit teď",
      navrat: " (návrat)",
      ulozi: (s: number) => `Uloží se za ${s} s`,
      jinaUdalost: "Jiná událost:",
      zpet: "Zpět",
    },
  },

  /** Hlasové potvrzení (cs-CZ, náhradně sk-SK, jinak ticho) */
  hlas: {
    Prichod: "Vítej v práci",
    Odchod: "Už jdeš?",
  },

  api: {
    stejnySloupec: (seznam: string, a: string, b: string, sloupec: string) =>
      `Sloupce ${a} a ${b} v seznamu ${seznam} ukazují na stejný sloupec (${sloupec}).`,
    chybiSloupec: (seznam: string, sloupec: string) =>
      `V seznamu ${seznam} chybí sloupec ${sloupec}.`,
    typ1Systemovy:
      "Sloupec Typ1 v seznamu DochadzkaUdalosti se shoduje se systémovým sloupcem Typ.",
  },

  kalendarRozsah: {
    titulek: "Termín rezervace",
    denObsazen: "Vozidlo je v tento den už rezervované.",
    obdobiObsazeno: "Ve zvoleném období je vozidlo už rezervované. Vyber kratší úsek.",
    maxDelka: (dni: number) => `Rezervace může trvat nejvýše ${pocetDni(dni)}.`,
    tuknetePrvni: "Ťukni na první den",
    napovedaPevnyZacatek: "Začátek se nemění — ťukni na nový poslední den",
    napovedaPosledni: "Ťukni na poslední den (nebo potvrď 1 den)",
    napovedaPrvniAPosledni: "Ťukni na první a potom na poslední den",
    legenda: "Červené dny = vozidlo je už rezervované",
  },

  kalendar: {
    vyberteDatum: "Vyber datum",
    vybratDny: "Vyber dny",
    zmenitDny: "Změnit dny",
    titulek: "Výběr dnů",
    napovedaVyber: "Ťukni na dny, které chceš vybrat nebo zrušit.",
    napovedaRozsahPrvni: "Ťukni na první den rozsahu.",
    napovedaRozsahPosledni: "Ťukni na poslední den rozsahu.",
    vybratRozsah: "Vyber rozsah",
    rozsahZrusit: "Zrušit rozsah",
    vymazat: "Vymazat výběr",
    nicNevybrano: "Žádný den není vybrán",
    vybrano: (n: number) => `Vybráno: ${pocetDni(n)}`,
    legendaVikend: "Víkend / svátek",
    legendaObsazeno: "Už máš žádost",
    denObsazen: "Na tento den už máš aktivní žádost.",
    denNepracovni: "Víkend nebo státní svátek nelze vybrat.",
    denMimoRozsah: "Tento den nelze vybrat.",
    predchoziMesic: "Předchozí měsíc",
    dalsiMesic: "Další měsíc",
  },

  zadosti: {
    druh: {
      SluzobnaCesta: "Služební cesta",
      HomeOffice: "Home office",
      SpatnaPritomnost: "Zpětná přítomnost",
      Dovolenka: "Dovolená",
      NahradneVolno: "Náhradní volno",
    },
    stav: {
      Ziadost: "Čeká na schválení",
      Schvalene: "Schváleno",
      Zamietnute: "Zamítnuto",
      Zrusene: "Zrušeno",
    },
    castDna: {
      Cely: "Celý den",
      Dopoludnie: "Dopoledne",
      Popoludnie: "Odpoledne",
    },

    chyby: {
      vyberteDen: "Vyber alespoň jeden den.",
      maxDni: (n: number) => `V jedné žádosti může být nejvýše ${pocetDni(n)}.`,
      denDvakrat: (den: string) => `Den ${den} je vybraný dvakrát.`,
      zpetneNejvys: (druh: string, n: number) =>
        `${druh} lze zadat nejvýše ${pocetDni(n)} zpětně.`,
      neZpetne: (druh: string) => `${druh} nelze zadat zpětně.`,
      dopreduNejvys: (druh: string, n: number) =>
        `${druh} lze zadat nejvýše ${pocetDni(n)} dopředu.`,
      zpetnaNeDoBudoucna: "Zpětnou přítomnost nelze zadat do budoucnosti.",
      nepracovniDen: (den: string) => `${den} není pracovní den (víkend nebo státní svátek).`,
      casDoPozdeji: (den: string) => `${den}: čas do musí být pozdější než čas od.`,
      odchodPozdeji: (den: string) => `${den}: čas odchodu musí být pozdější než čas příchodu.`,
      odchodVBudoucnu: (den: string) => `${den}: čas odchodu nemůže být v budoucnosti.`,
      vyplnteDuvod: "Vyplň důvod.",
      hodinyMezi: (den: string, fond: string) =>
        `${den}: počet hodin musí být mezi 0 a ${fond}.`,
      prekryv: (popis: string) => `Překrývá se s tvou žádostí: ${popis}.`,
      neplatnyCas: (den: string) => `${den}: zadej čas ve tvaru H:MM.`,
    },

    detail: {
      titulek: "Žádost",
      uzNeceka: "Žádost už nečeká na schválení.",
      nemuzete: "Tuto žádost nemůžeš schválit ani zamítnout.",
      duvodZamitnuti: "Důvod zamítnutí *",
      zamitnout: "Zamítnout",
      zamitnoutTri: "Zamítnout…",
      schvalit: "Schválit",
      schvaleno: "Schváleno",
      zamitnuto: "Zamítnuto",
    },

    keSchvaleni: {
      titulek: "Ke schválení",
      hr: "HR: zobrazují se všechny čekající žádosti.",
      nejsteSchvalovatel: "Nejsi schvalovatelem žádného zaměstnance.",
      prazdne: "Žádné žádosti nečekají na schválení.",
    },

    seznam: {
      titulek: "Žádosti",
      mojeZadosti: "Moje žádosti",
      obdobi: (dni: number) => `Posledních ${dni} dní a budoucí.`,
      prazdne: "Zatím žádné žádosti.",
      keSchvaleni: (pocet: number) => (pocet ? `Ke schválení (${pocet})` : "Ke schválení"),
      celkem: (hodiny: string) => `Celkem ${hodiny}`,
      duvod: "Důvod: ",
      poznamka: "Poznámka: ",
      zamitnuto: "Zamítnuto: ",
    },

    nova: {
      titulek: "Nová žádost",
      popisAuto: (zpet: number, dopredu: number) =>
        `Schválí se automaticky · až ${pocetDni(zpet)} zpětně, ${pocetDni(dopredu)} dopředu`,
      popisZpetna: (zpet: number) => `Zapomenutý záznam · nejvýše ${pocetDni(zpet)} zpětně`,
      popisNadrizeny: "Schvaluje nadřízený",
      dny: "Dny",
      vyberteDny: "Vyber dny v kalendáři",
      poznamkaNepovinna: "Poznámka (nepovinné)",
      casPoDnech: "Čas po dnech",
      stejnyCas: "Stejný čas pro všechny",
      vsechnyDny: "Všechny dny",
      prichodOdchod: "Příchod – odchod po dnech",
      duvod: "Důvod *",
      duvodPlaceholder: "Např. zapomenutý telefon",
      dovolenaSouhrn: (pocet: number, hodiny: string) =>
        `Vybráno: ${pocetDni(pocet)} · celkem ${hodiny}.`,
      dovolenaPozn: "Víkendy a státní svátky nelze vybrat.",
      celyDen: (hodiny: string) => `Celý den (${hodiny})`,
      pocetHodin: "Počet hodin",
      hodinyPlaceholder: "např. 4",
      zadejteHodiny: (den: string) => `${den}: zadej počet hodin.`,
      vyberteDruh: "Vyber druh žádosti.",
      nelzeOdeslat: "Žádost nelze odeslat.",
      zapsat: "Zapsat",
      odeslatKeSchvaleni: "Odeslat ke schválení",
      zapsanoTitulek: "Zapsáno",
      zapsanoText: (druh: string) => `${druh}: zapsáno a schváleno.`,
      odeslanoTitulek: "Žádost odeslána",
      odeslanoText: "Žádost čeká na schválení nadřízeným.",
      odebratDen: "Odebrat den",
      svatek: "státní svátek",
      vikend: "víkend",
    },

    api: {
      nelzeUlozit: (msg: string) => `Žádost se nepodařilo uložit: ${msg}`,
      vlastniJenSamSobe: "Vlastní žádost můžeš schválit jen tehdy, pokud jsi sám sobě nadřízený.",
      bezOpravneni: "Ke schválení ani zamítnutí této žádosti nemáš oprávnění.",
      uzVyrizena: "Žádost už byla vyřízena (schválena, zamítnuta nebo zrušena).",
      vyplnteDuvodZamitnuti: "Vyplň důvod zamítnutí.",
      bezNadrizeneho: "Nemáš nastaveného nadřízeného, kontaktuj HR.",
    },

    zruseni: {
      tlacitko: "Zrušit žádost",
      titulek: "Zrušit žádost?",
      zrusiSe: "Zruší se:",
      zustava: "Zůstává platné (den už začal nebo proběhl):",
      potvrdit: "Zrušit žádost",
      ponechat: "Ponechat",
      nicKZruseni: "Žádný den této žádosti už nelze zrušit — všechny už začaly nebo proběhly.",
      nenalezena: "Žádost nebyla nalezena.",
      cizi: "Zrušit můžeš jen vlastní žádost.",
      hotovo: (n: number) => `Zrušeno: ${pocetDni(n)}.`,
    },
  },
} as const;
