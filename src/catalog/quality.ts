import { toNumber, toProduct, type CatalogRow } from "./parseCatalog.js";
import type {
  CatalogIssue,
  CatalogIssueSeverity,
  CatalogQualityReport,
  CatalogRule,
  CatalogRuleKey,
  CatalogSnapshot,
} from "./types.js";

/**
 * Validation of the SFCC catalog export on its own, with no browser: contradictions between
 * columns of the same row (type × concentration, name × volume, prices) and content the PDP
 * shows that is missing or misspelled. The PDP only renders what the export sends, so these
 * problems show up on the page as they are here.
 */

export const CATALOG_RULES: CatalogRule[] = [
  {
    key: "typeConcentration",
    label: "Tipo × concentração",
    description:
      'O tipo do produto e a concentração da "gota olfativa" dizem coisas diferentes (ex.: eau de parfum com concentração deo parfum).',
  },
  {
    key: "nameType",
    label: "Nome × tipo",
    description: "O nome cita uma concentração diferente do tipo cadastrado (ex.: nome Deo Parfum, tipo eau de parfum).",
  },
  {
    key: "nameVolume",
    label: "Nome × volume",
    description: "O volume ou peso no nome não bate com a coluna Volume.",
  },
  {
    key: "priceDiscount",
    label: "Preço e desconto",
    description: 'O desconto não é "de" menos "por", o preço "por" é maior que o "de" ou a marcação de promoção não bate com os preços.',
  },
  {
    key: "missingPrice",
    label: "Sem preço",
    description: "Produto disponível sem preço de ou por.",
  },
  {
    key: "missingImage",
    label: "Sem imagem",
    description: "Produto disponível sem imagem principal.",
  },
  {
    key: "missingDescription",
    label: "Sem descrição",
    description: "Produto disponível sem descrição nem detalhes.",
  },
  {
    key: "noteTypo",
    label: "Nota com possível erro de digitação",
    description:
      'Nota olfativa rara que difere por uma letra de outra bem mais comum no catálogo (ex.: "licha" e "lichia"). Confira: pode ser outra nota de verdade.',
  },
  {
    key: "pdpLink",
    label: "Link da PDP",
    description: "O link do produto está vazio ou não termina no código do SKU.",
  },
];

const COL = {
  type: "Type of Product",
  concentration: "Concentration",
  name: "ProductName",
  volume: "Volume",
  regularPrice: "RegularPrice",
  salePrice: "SalePrice",
  discount: "Discount",
  onSale: "OnSale",
  image: "ImageLink",
  description: "Description",
  details: "Product Details",
  topNote: "Top Note",
  midNote: "Midle Note",
  baseNote: "Base Note",
  link: "ProductLink",
} as const;

const NOTE_COLUMNS = [COL.topNote, COL.midNote, COL.baseNote];

function normalize(text: string | undefined): string {
  return (text ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// --- Concentration ----------------------------------------------------------------------

/**
 * Perfume concentrations as they appear in the type, concentration and name. "colônia" alone
 * is ambiguous (deo colônia or água de colônia), so it matches both. Generic values ("perfume",
 * "presente", "kits e combos") match nothing and are not compared.
 */
const CONCENTRATIONS: { pattern: RegExp; classes: string[] }[] = [
  { pattern: /\b(deo parfum|deo perfume|desodorante perfume)\b/, classes: ["deo parfum"] },
  { pattern: /\beau de parfum\b/, classes: ["eau de parfum"] },
  { pattern: /\beau de toilette\b/, classes: ["eau de toilette"] },
  { pattern: /\b(deo colonia|desodorante colonia)\b/, classes: ["deo colonia"] },
  { pattern: /\b(agua de colonia|eau de cologne)\b/, classes: ["agua de colonia"] },
  { pattern: /\bbody splash\b/, classes: ["body splash"] },
];

/** Every concentration the text mentions (a name can say "Body Splash Desodorante Colônia"). */
function concentrationsIn(text: string | undefined): Set<string> {
  const value = normalize(text);
  const found = new Set<string>();
  for (const { pattern, classes } of CONCENTRATIONS) {
    if (pattern.test(value)) {
      classes.forEach((c) => found.add(c));
    }
  }
  if (found.size === 0 && /^colonia$/.test(value)) {
    ["deo colonia", "agua de colonia"].forEach((c) => found.add(c));
  }
  return found;
}

function overlaps(a: Set<string>, b: Set<string>): boolean {
  return [...a].some((value) => b.has(value));
}

function isKit(row: CatalogRow): boolean {
  return row.IsBundle === "true" || /^(kit|presente)\b/.test(normalize(row[COL.name]));
}

// --- Volume -----------------------------------------------------------------------------

interface Quantity {
  amount: number;
  /** ml or g, after converting l and kg. */
  unit: "ml" | "g";
  text: string;
}

function quantityIn(text: string | undefined): Quantity | null {
  const matches = [...normalize(text).matchAll(/(\d+(?:[.,]\d+)?)\s?(ml|l|g|kg)\b/g)];
  const last = matches.at(-1);
  if (!last) {
    return null;
  }
  const amount = Number(last[1].replace(",", "."));
  const unit = last[2];
  return {
    amount: unit === "l" || unit === "kg" ? amount * 1000 : amount,
    unit: unit === "ml" || unit === "l" ? "ml" : "g",
    text: last[0],
  };
}

// --- Notes ------------------------------------------------------------------------------

const INVISIBLE = String.fromCharCode(0x200b, 0x2800, 0x00a0);
const NOTE_FORMATTING = new RegExp(`[${INVISIBLE}*.()]+`, "g");

/**
 * Notes of a row. Punctuation, invisible characters (zero-width and braille blanks show up in
 * the feed) and hyphens are formatting, not typos, so the comparison key drops them.
 */
function notesOf(row: CatalogRow): { raw: string; key: string }[] {
  return NOTE_COLUMNS.flatMap((column) => (row[column] ?? "").split(/[,;]/))
    .map((raw) => raw.replace(NOTE_FORMATTING, " ").trim())
    .filter(Boolean)
    .map((raw) => ({ raw, key: normalize(raw.replace(/-/g, " ")) }));
}

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[b.length];
}

/** A note is suspect when it is rare and one letter away from a note many times more common. */
const TYPO_MAX_COUNT = 3;
const TYPO_MIN_RATIO = 2;
const TYPO_MIN_COMMON = 5;
const TYPO_MIN_LENGTH = 5;

/** Rare note → the common note it probably meant to be. */
function findNoteTypos(rows: CatalogRow[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const { key } of notesOf(row)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const common = [...counts].filter(([, n]) => n >= TYPO_MIN_COMMON);
  const typos = new Map<string, string>();
  for (const [note, n] of counts) {
    if (n > TYPO_MAX_COUNT || note.length < TYPO_MIN_LENGTH) {
      continue;
    }
    const match = common.find(
      ([other, m]) => other !== note && m >= n * TYPO_MIN_RATIO && levenshtein(note, other) === 1,
    );
    if (match) {
      typos.set(note, match[0]);
    }
  }
  return typos;
}

// --- Rules ------------------------------------------------------------------------------

type Finding = { rule: CatalogRuleKey; severity: CatalogIssueSeverity; fields: string[]; message: string };

function money(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function checkRow(row: CatalogRow, noteTypos: Map<string, string>): Finding[] {
  const findings: Finding[] = [];
  const available = row.OnlineAvailability === "true";
  const sku = row.SkuID;
  const type = row[COL.type];
  const concentration = row[COL.concentration];
  const typeClasses = concentrationsIn(type);

  const concentrationClasses = concentrationsIn(concentration);
  if (typeClasses.size > 0 && concentrationClasses.size > 0 && !overlaps(typeClasses, concentrationClasses)) {
    findings.push({
      rule: "typeConcentration",
      severity: "error",
      fields: [COL.type, COL.concentration],
      message: `Tipo "${type}", mas a concentração é "${concentration}".`,
    });
  }

  if (!isKit(row)) {
    const nameClasses = concentrationsIn(row[COL.name]);
    if (nameClasses.size > 0 && typeClasses.size > 0 && !overlaps(nameClasses, typeClasses)) {
      findings.push({
        rule: "nameType",
        severity: "error",
        fields: [COL.name, COL.type],
        message: `O nome diz ${[...nameClasses].join(" / ")}, mas o tipo é "${type}".`,
      });
    }

    const inName = quantityIn(row[COL.name]);
    const volume = quantityIn(row[COL.volume]);
    if (inName && volume) {
      if (inName.unit !== volume.unit) {
        findings.push({
          rule: "nameVolume",
          severity: "warning",
          fields: [COL.name, COL.volume],
          message: `O nome diz ${inName.text} e a coluna Volume diz ${row[COL.volume]} (unidades diferentes).`,
        });
      } else if (inName.amount !== volume.amount) {
        findings.push({
          rule: "nameVolume",
          severity: "error",
          fields: [COL.name, COL.volume],
          message: `O nome diz ${inName.text}, mas a coluna Volume diz ${row[COL.volume]}.`,
        });
      }
    }
  }

  const regular = toNumber(row[COL.regularPrice]);
  const sale = toNumber(row[COL.salePrice]);
  const discount = toNumber(row[COL.discount]);
  if (regular !== null && sale !== null) {
    const priceProblems: string[] = [];
    if (sale > regular) {
      priceProblems.push(`preço "por" (${money(sale)}) maior que o "de" (${money(regular)})`);
    }
    if (discount !== null && Math.abs(regular - sale - discount) > 0.01) {
      priceProblems.push(`desconto ${money(discount)}, mas ${money(regular)} − ${money(sale)} = ${money(regular - sale)}`);
    }
    if (row[COL.onSale] === "true" && sale >= regular) {
      priceProblems.push("marcado em promoção sem preço menor");
    }
    if (row[COL.onSale] === "false" && sale < regular) {
      priceProblems.push("preço menor sem estar marcado em promoção");
    }
    if (priceProblems.length > 0) {
      const message = priceProblems.join("; ");
      findings.push({
        rule: "priceDiscount",
        severity: "error",
        fields: [COL.regularPrice, COL.salePrice, COL.discount, COL.onSale],
        message: message.charAt(0).toUpperCase() + message.slice(1) + ".",
      });
    }
  }

  if (available && (!regular || !sale)) {
    findings.push({
      rule: "missingPrice",
      severity: "error",
      fields: [COL.regularPrice, COL.salePrice],
      message: `Disponível sem preço (de: ${row[COL.regularPrice] || "vazio"}, por: ${row[COL.salePrice] || "vazio"}).`,
    });
  }

  if (available && !row[COL.image]) {
    findings.push({ rule: "missingImage", severity: "error", fields: [COL.image], message: "Disponível sem imagem." });
  }

  if (available && !row[COL.description] && !row[COL.details]) {
    findings.push({
      rule: "missingDescription",
      severity: "warning",
      fields: [COL.description, COL.details],
      message: "Disponível sem descrição nem detalhes.",
    });
  }

  const typos = notesOf(row).filter(({ key }) => noteTypos.has(key));
  if (typos.length > 0) {
    findings.push({
      rule: "noteTypo",
      severity: "warning",
      fields: NOTE_COLUMNS.filter((column) => typos.some(({ raw }) => (row[column] ?? "").includes(raw))),
      message: typos.map(({ raw, key }) => `"${raw}" (seria "${noteTypos.get(key)}"?)`).join(", "),
    });
  }

  const link = row[COL.link];
  if (!link || !link.replace(/\/$/, "").endsWith(`/${sku}`)) {
    findings.push({
      rule: "pdpLink",
      severity: "error",
      fields: [COL.link],
      message: link ? `O link não termina em ${sku}: ${link}` : "Sem link da PDP.",
    });
  }

  return findings;
}

const SEVERITY_ORDER: Record<CatalogIssueSeverity, number> = { error: 0, warning: 1 };

/** Runs every rule over the export rows (one per PDP, see `parseCatalogRows`). */
export function checkCatalogQuality(
  rows: CatalogRow[],
  meta: Pick<CatalogSnapshot, "operation" | "fetchedAt" | "source">,
): CatalogQualityReport {
  const noteTypos = findNoteTypos(rows);
  const ruleOrder = new Map(CATALOG_RULES.map((rule, i) => [rule.key, i]));
  const issues: CatalogIssue[] = rows
    .flatMap((row) => {
      const { sku, name, url, available } = toProduct(row);
      return checkRow(row, noteTypos).map((finding) => ({ sku, name, url, available, ...finding }));
    })
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        ruleOrder.get(a.rule)! - ruleOrder.get(b.rule)! ||
        a.sku.localeCompare(b.sku),
    );
  return { ...meta, checked: rows.length, rules: CATALOG_RULES, issues };
}
