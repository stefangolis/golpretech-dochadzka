export type WorkItemKind = "zakazka" | "objednavka";

export type WorkItem = {
  key: string;
  kind: WorkItemKind;
  zakazkaId: string;
  nazov: string;
  zakaznik: string;
  /** Firma z prijatej objednávky (ak ide o objednávku) */
  objednavkaFirma: string;
  cisloObjednavky: string;
  /** Hlavný riadok */
  label: string;
  /** Druhý riadok (voliteľný) */
  subtitle: string;
  searchText: string;
};

export type TimeEntry = {
  id: string;
  zamestnanecEmail: string;
  datum: string;
  zakazkaId: string;
  cisloObjednavky: string;
  minuty: number;
  ukon: string;
  minutovaSadzba: number;
  cena: number;
  rework: boolean;
  poznamka: string;
  casZapisu: string;
};