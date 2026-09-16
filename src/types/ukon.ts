export type UkonItem = {
  /** SharePoint item id */
  id: string;
  /** Názov úkonu (ukladá sa do poľa Ukon) */
  nazov: string;
  minutovaSadzba: number;
  /** Rovnaké ako nazov (zobrazenie v UI) */
  label: string;
};
