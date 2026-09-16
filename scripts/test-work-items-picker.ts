import assert from "node:assert/strict";
import {
  buildPickerWorkItems,
  formatTimeEntryWorkLine,
  zakazkyLookupMap,
} from "../src/api/workItemsPicker";
import type { ParsedZakazka } from "../src/api/zakazkaFields";
import type { ParsedObjednavka } from "../src/api/objednavkaFields";

function zak(
  partial: Pick<ParsedZakazka, "zakazkaId" | "stavAktivna"> &
    Partial<ParsedZakazka>,
): ParsedZakazka {
  return {
    title: partial.nazov ?? partial.zakazkaId,
    nazov: partial.nazov ?? "",
    zakaznik: partial.zakaznik ?? "",
    ...partial,
  };
}

const inactive = zak({
  zakazkaId: "VYZAK260001",
  nazov: "Uzavreta zakazka",
  zakaznik: "ACME",
  stavAktivna: false,
});
const activeStandalone = zak({
  zakazkaId: "VYZAK260002",
  nazov: "Aktivna bez objednavky",
  zakaznik: "Beta",
  stavAktivna: true,
});
const activeWithOrder = zak({
  zakazkaId: "VYZAK260003",
  nazov: "Aktivna s objednavkou",
  zakaznik: "Gama",
  stavAktivna: true,
});

const orders: ParsedObjednavka[] = [
  {
    cisloObjednavky: "PO-INACTIVE",
    zakazkaId: "VYZAK260001",
    zakaznik: "ACME",
    stav: "Otvorena",
  },
  {
    cisloObjednavky: "PO-ACTIVE",
    zakazkaId: "VYZAK260003",
    zakaznik: "Gama",
    stav: "Otvorena",
  },
  {
    cisloObjednavky: "PO-NEAKTIVNA",
    zakazkaId: "VYZAK260003",
    zakaznik: "Gama",
    stav: "Neaktivna",
  },
];

const picker = buildPickerWorkItems(
  [inactive, activeStandalone, activeWithOrder],
  orders,
);

assert.equal(
  picker.some((i) => i.zakazkaId === "VYZAK260001"),
  false,
  "neaktívna zákazka ani jej objednávka nesmú byť v pickeri",
);
assert.equal(
  picker.some((i) => i.key === "o:PO-INACTIVE"),
  false,
);
assert.equal(
  picker.some((i) => i.key === "z:VYZAK260002"),
  true,
  "aktívna zákazka bez objednávky musí ostať v pickeri",
);
assert.equal(
  picker.some((i) => i.key === "o:PO-ACTIVE"),
  true,
);
assert.equal(
  picker.some((i) => i.key === "z:VYZAK260003"),
  false,
  "zákazka s aktívnou objednávkou sa nezobrazuje samostatne",
);
assert.equal(
  picker.some((i) => i.key === "o:PO-NEAKTIVNA"),
  false,
);

const lookup = zakazkyLookupMap([inactive, activeStandalone, activeWithOrder]);
const historyLine = formatTimeEntryWorkLine(
  { zakazkaId: "VYZAK260001", cisloObjednavky: "PO-INACTIVE" },
  lookup,
);
assert.match(
  historyLine,
  /Uzavreta zakazka/,
  "história musí dohľadať názov aj neaktívnej zákazky",
);
assert.match(historyLine, /PO-INACTIVE/);

console.log("workItemsPicker tests OK");
console.log(
  "picker keys:",
  picker.map((i) => i.key).join(", "),
);
console.log("history:", historyLine);
