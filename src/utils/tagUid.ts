/** UID tagu: veľké písmená, bez dvojbodiek, pomlčiek a medzier (napr. "04A1B2C3D4E5F6"). */
export function normalizeTagUid(raw: unknown): string {
  if (Array.isArray(raw)) {
    return raw
      .map((b) => (Number(b) & 0xff).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }
  if (typeof raw !== "string") return "";
  return raw.replace(/[\s:\-]/g, "").toUpperCase();
}
