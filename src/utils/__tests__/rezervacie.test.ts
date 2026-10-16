import { describe, expect, it } from "vitest";
import { mozeZrusitRezervaciu } from "../rezervacie";

describe("zrušenie rezervácie", () => {
  it("zrušiť sa dá len Rezervovane; Prevzate sa odovzdáva", () => {
    expect(mozeZrusitRezervaciu({ stav: "Rezervovane" })).toBe(true);
    expect(mozeZrusitRezervaciu({ stav: "Prevzate" })).toBe(false);
    expect(mozeZrusitRezervaciu({ stav: "Vratene" })).toBe(false);
    expect(mozeZrusitRezervaciu({ stav: "Zrusene" })).toBe(false);
  });
});
