import { describe, expect, it } from "vitest";
import { jedinecneZakazky, porovnajObjednavky, zakazkaKluc } from "../jedinecneZakazky";
import { den, iso, pouziFixnyCas } from "./fixnyCas";

pouziFixnyCas();

type Z = { zakazkaId: string; nazov: string };
type O = {
  zakazkaId: string;
  cisloObjednavky: string;
  datumObjednavky?: string;
  created?: string;
  itemId?: string;
};

const zak = (zakazkaId: string, nazov = zakazkaId): Z => ({ zakazkaId, nazov });

describe("jedinečné zákazky v pickeri", () => {
  it("2 objednávky k 1 zákazke → ostane novšia, staršia len pre hľadanie", () => {
    const stara: O = { zakazkaId: "VYZAK260029", cisloObjednavky: "OPVTC2600042", created: iso(den(-30), 8 * 60), itemId: "4" };
    const nova: O = { zakazkaId: "VYZAK260029", cisloObjednavky: "OPVST2600001", created: iso(den(-2), 8 * 60), itemId: "61" };
    const r = jedinecneZakazky([zak("VYZAK260029")], [stara, nova]);
    expect(r).toHaveLength(1);
    expect(r[0]!.objednavka).toBe(nova);
    expect(r[0]!.starsieObjednavky).toEqual([stara]);
  });

  it("zákazka bez objednávky ostane, objednávka bez zákazky sa ignoruje", () => {
    const r = jedinecneZakazky(
      [zak("VYZAK260002")],
      [{ zakazkaId: "VYZAK999999", cisloObjednavky: "OP1" }, { zakazkaId: "", cisloObjednavky: "OP2" }],
    );
    expect(r).toEqual([{ zakazka: zak("VYZAK260002"), objednavka: null, starsieObjednavky: [] }]);
  });

  it("veľké/malé písmená a medzery v čísle zákazky sú to isté číslo", () => {
    expect(zakazkaKluc(" vyzak 260029 ")).toBe(zakazkaKluc("VYZAK260029"));
    const r = jedinecneZakazky(
      [zak("VYZAK260029", "prvá"), zak(" vyzak260029 ", "duplicita")],
      [
        { zakazkaId: "vyzak 260029", cisloObjednavky: "OP-A", itemId: "10" },
        { zakazkaId: "VYZAK260029 ", cisloObjednavky: "OP-B", itemId: "12" },
      ],
    );
    expect(r).toHaveLength(1);
    expect(r[0]!.zakazka.nazov).toBe("prvá");
    expect(r[0]!.objednavka?.cisloObjednavky).toBe("OP-B");
  });

  it("poradie: dátum objednávky > Created > vyššie ID", () => {
    const vcera = iso(den(-1), 12 * 60);
    const dnes = iso(den(0), 9 * 60);
    // dátum objednávky rozhoduje aj proti novšiemu Created
    expect(
      porovnajObjednavky(
        { cisloObjednavky: "A", datumObjednavky: den(-1), created: vcera },
        { cisloObjednavky: "B", datumObjednavky: den(-5), created: dnes },
      ),
    ).toBeGreaterThan(0);
    // bez dátumu objednávky → Created
    expect(
      porovnajObjednavky({ cisloObjednavky: "A", created: vcera }, { cisloObjednavky: "B", created: dnes }),
    ).toBeLessThan(0);
    // rovnaký Created (prvý sync) → vyššie ID
    expect(
      porovnajObjednavky(
        { cisloObjednavky: "A", created: dnes, itemId: "143" },
        { cisloObjednavky: "B", created: dnes, itemId: "82" },
      ),
    ).toBeGreaterThan(0);
  });
});
