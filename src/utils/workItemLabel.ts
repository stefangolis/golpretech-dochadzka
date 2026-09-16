/** Hlavný riadok: číslo zákazky - firma - názov */
export function buildWorkItemMainLine(
  zakazkaId: string,
  firma: string,
  nazov: string,
): string {
  const parts: string[] = [zakazkaId.trim()];
  const company = firma.trim();
  const name = nazov.trim();

  if (company && company !== "—") {
    parts.push(company);
  }
  if (
    name &&
    name !== "—" &&
    name.toLowerCase() !== zakazkaId.trim().toLowerCase()
  ) {
    parts.push(name);
  }
  return parts.join(" - ");
}

/** Spodný riadok objednávky: číslo objednávky - firma */
export function buildWorkItemOrderSubLine(
  cisloObjednavky: string,
  firmaObjednavky: string,
): string {
  const cislo = cisloObjednavky.trim();
  const firma = firmaObjednavky.trim();
  if (!cislo) return "";
  if (firma && firma !== "—") {
    return `${cislo} - ${firma}`;
  }
  return cislo;
}
