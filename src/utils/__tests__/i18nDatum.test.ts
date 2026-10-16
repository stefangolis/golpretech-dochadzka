import { describe, expect, it } from "vitest";
import { pocetDni } from "../../i18n/cs";
import {
  formatDenKratce,
  formatDenPlny,
  formatMesicRok,
  formatRozsahDni,
} from "../../i18n/datum";

describe("české formátování dat (cs-CZ)", () => {
  it("dny v týdnu", () => {
    expect(formatDenKratce("2026-10-14")).toBe("St 14. 10.");
    const tyden = ["12", "13", "14", "15", "16", "17", "18"].map((d) =>
      formatDenKratce(`2026-10-${d}`).slice(0, 2),
    );
    expect(tyden).toEqual(["Po", "Út", "St", "Čt", "Pá", "So", "Ne"]);
    expect(formatDenPlny("2026-10-14")).toBe("St 14. 10. 2026");
  });

  it("měsíc a rozsah", () => {
    expect(formatMesicRok(2026, 10)).toBe("Říjen 2026");
    expect(formatMesicRok(2027, 1)).toBe("Leden 2027");
    expect(formatRozsahDni("2026-10-04", "2026-10-09")).toBe("4.–9. 10.");
    expect(formatRozsahDni("2026-10-04", "2026-10-04")).toBe("4. 10.");
  });

  it("skloňování dnů", () => {
    expect([1, 2, 4, 5, 21].map(pocetDni)).toEqual(["1 den", "2 dny", "4 dny", "5 dní", "21 dní"]);
  });
});
