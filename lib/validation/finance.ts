import { z } from "zod";
import { parseUsdToCents } from "@/lib/money/cents";
import { parseRate } from "@/lib/money/fx";
import { normalizePhone } from "./operations";

/** Validation des formulaires du lot 3a : taux, forfaits, coûts internes, comptes officiels. */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères au maximum.`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .prefault("");

/** Montant en dollars → centimes ; vide accepté si `optional`. */
const usd = (message: string, { optional = false, allowZero = false } = {}) =>
  z
    .string()
    .prefault("")
    .transform((value, ctx) => {
      if (value.trim() === "") {
        if (optional) return null;
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      const cents = parseUsdToCents(value);
      if (cents === null || cents < 0 || (!allowZero && cents === 0)) {
        ctx.addIssue({ code: "custom", message: "Montant invalide : chiffres en dollars, ex. 11500 ou 11500,50." });
        return z.NEVER;
      }
      return cents;
    });

/** US-3.5 : taux FCFA pour 1 USD (4 décimales), date-heure du relevé (Dakar = UTC), source. */
export const fxRateSchema = z.object({
  rate: z.string().transform((value, ctx) => {
    try {
      parseRate(value);
      return value.trim().replace(",", ".");
    } catch {
      ctx.addIssue({ code: "custom", message: "Taux invalide : FCFA pour 1 USD, 4 décimales au plus (ex. 587,1050)." });
      return z.NEVER;
    }
  }),
  capturedAt: z.string().transform((value, ctx) => {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
      ctx.addIssue({ code: "custom", message: "Saisissez la date et l’heure du relevé." });
      return z.NEVER;
    }
    return new Date(`${value}:00Z`).toISOString();
  }),
  source: z.string().trim().min(2, "Indiquez la source du taux.").max(120, "120 caractères au maximum."),
});

/** US-3.2 : forfaits A et B, prime d'assurance C (facultative). */
export const forfaitsSchema = z.object({
  dossierId: z.uuid("Dossier inconnu."),
  forfaitA: usd("Saisissez le forfait A.", { optional: true }),
  forfaitB: usd("Saisissez le forfait B.", { optional: true }),
  insurance: usd("Saisissez la prime d’assurance.", { optional: true, allowZero: true }),
});

const SECTIONS = ["A", "B"] as const;
const CATEGORIES = [
  "hammer_price",
  "auction_fees",
  "us_taxes",
  "acquisition_other",
  "inland_transport",
  "loading",
  "ocean_freight",
  "port_fees",
  "documentation",
  "logistics_other",
] as const;

/** US-3.1 : poste de coût interne. */
export const internalCostSchema = z.object({
  dossierId: z.uuid("Dossier inconnu."),
  costId: z.uuid().optional(),
  category: z.enum(CATEGORIES, "Choisissez le poste."),
  label: optionalText(120),
  amount: usd("Saisissez le montant.", { allowZero: true }).pipe(z.number()), // obligatoire : jamais nul
  status: z.enum(["estimated", "final"], "Indiquez si le montant est estimé ou définitif."),
});

/** Section déduite du poste (la base contrôle aussi la cohérence). */
export function sectionOf(category: (typeof CATEGORIES)[number]): (typeof SECTIONS)[number] {
  return ["hammer_price", "auction_fees", "us_taxes", "acquisition_other"].includes(category) ? "A" : "B";
}

/** US-3.10 : compte officiel (création ou remplacement d'un compte actif). */
export const officialAccountSchema = z
  .object({
    kind: z.enum(["bank", "wave", "orange_money", "cash_office"], "Choisissez le type de compte."),
    label: z.string().trim().min(2, "Saisissez un libellé.").max(80, "80 caractères au maximum."),
    holderName: z.string().trim().min(2, "Saisissez le titulaire.").max(120, "120 caractères au maximum."),
    bankName: optionalText(80),
    accountNumber: optionalText(60),
    iban: optionalText(60),
    swift: optionalText(20),
    phone: z.string().prefault(""),
    instructions: optionalText(500),
    replacesId: z
      .string()
      .prefault("")
      .transform((v) => (v === "" ? null : v))
      .pipe(z.uuid().nullable()),
  })
  .transform((value, ctx) => {
    let phone: string | null = null;
    if (value.kind === "wave" || value.kind === "orange_money") {
      phone = normalizePhone(value.phone);
      if (!phone) {
        ctx.addIssue({ code: "custom", path: ["phone"], message: "Numéro du compte au format international (+221…)." });
        return z.NEVER;
      }
    }
    if (value.kind === "bank" && (!value.bankName || (!value.accountNumber && !value.iban))) {
      ctx.addIssue({
        code: "custom",
        path: ["bankName"],
        message: "Compte bancaire : banque et numéro de compte ou IBAN obligatoires.",
      });
      return z.NEVER;
    }
    return { ...value, phone };
  });

export const accountIdSchema = z.object({ accountId: z.uuid("Compte inconnu.") });

export const deactivateAccountSchema = z.object({
  accountId: z.uuid("Compte inconnu."),
  reason: z.string().trim().min(5, "Indiquez le motif (5 caractères au moins).").max(300),
});
