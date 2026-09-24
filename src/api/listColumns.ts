import { graphFetch, parseGraphErrorBody } from "./sharepointClient";

export type ListColumnInfo = {
  name: string;
  displayName: string;
};

const SKIP = new Set([
  "id",
  "ContentType",
  "Modified",
  "Created",
  "Author",
  "Editor",
  "_UIVersionString",
  "Attachments",
  "Edit",
  "LinkTitleNoMenu",
  "LinkTitle",
  "DocIcon",
  "ItemChildCount",
  "FolderChildCount",
  "_ComplianceFlags",
  "_ComplianceTag",
  "_ComplianceTagWrittenTime",
  "_ComplianceTagUserId",
  "AppAuthor",
  "AppEditor",
]);

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]/g, "");
}

export async function fetchListColumns(
  accessToken: string,
  siteId: string,
  listId: string,
): Promise<ListColumnInfo[]> {
  let url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/columns?$select=name,displayName&$top=200`;
  const cols: ListColumnInfo[] = [];

  while (url) {
    const res = await graphFetch(accessToken, url);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `SharePoint columns HTTP ${res.status}: ${parseGraphErrorBody(body)}`,
      );
    }
    const page = (await res.json()) as {
      value?: ListColumnInfo[];
      "@odata.nextLink"?: string;
    };
    for (const col of page.value ?? []) {
      if (!col.name || SKIP.has(col.name)) continue;
      cols.push({
        name: col.name,
        displayName: col.displayName ?? col.name,
      });
    }
    url = page["@odata.nextLink"] ?? "";
  }

  return cols;
}

/** Nájde interný názov stĺpca podľa preferovaných mien alebo zobrazovaného názvu */
export function resolveListColumn(
  columns: ListColumnInfo[],
  preferredNames: string[],
  displayHints: string[] = [],
): string | null {
  for (const preferred of preferredNames) {
    const byName = columns.find((c) => c.name === preferred);
    if (byName) return byName.name;
    const byDisplay = columns.find(
      (c) => norm(c.displayName) === norm(preferred),
    );
    if (byDisplay) return byDisplay.name;
  }

  const hints = displayHints.map(norm);
  for (const col of columns) {
    const dn = norm(col.displayName);
    const cn = norm(col.name);
    if (hints.every((h) => dn.includes(h) || cn.includes(h))) {
      return col.name;
    }
  }

  return null;
}

/**
 * Presná zhoda interného alebo zobrazovaného názvu, bez hľadania podreťazca.
 * Pre krátke názvy (Od, Do, Stav), ktoré sa nachádzajú aj v iných stĺpcoch.
 */
export function resolveListColumnExact(
  columns: ListColumnInfo[],
  names: string[],
): string | null {
  for (const name of names) {
    const byName = columns.find((c) => c.name === name);
    if (byName) return byName.name;
  }
  for (const name of names) {
    const byDisplay = columns.find(
      (c) => norm(c.displayName) === norm(name),
    );
    if (byDisplay) return byDisplay.name;
  }
  return null;
}

export function fieldString(
  fields: Record<string, unknown>,
  columnName: string | null | undefined,
): string {
  if (!columnName) return "";
  return asSharePointValue(fields[columnName]);
}

export function asSharePointValue(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (v == null) return "";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.LookupValue === "string") return o.LookupValue.trim();
    if (typeof o.Value === "string") return o.Value.trim();
    if (typeof o.value === "string") return o.value.trim();
    if (typeof o.displayName === "string") return o.displayName.trim();
    if (typeof o.Email === "string") return o.Email.trim();
    if (typeof o.Label === "string") return o.Label.trim();
  }
  return String(v).trim();
}

function foldYesNoText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "");
}

/**
 * SharePoint Áno/Nie (Graph: boolean, 0/1, alebo text Áno/Yes).
 */
export function asSharePointYesNo(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === "1") return true;
  if (v === 0 || v === "0") return false;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const key of ["LookupValue", "Value", "value", "Bool", "Label"]) {
      if (o[key] !== undefined) return asSharePointYesNo(o[key]);
    }
  }
  const s = foldYesNoText(asSharePointValue(v));
  if (["true", "yes", "ano"].includes(s)) return true;
  if (["false", "no", "nie"].includes(s)) return false;
  return false;
}
