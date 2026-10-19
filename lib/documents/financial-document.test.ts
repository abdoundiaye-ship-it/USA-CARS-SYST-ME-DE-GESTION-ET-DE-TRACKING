import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { COST_CATEGORY_LABELS } from "@/lib/finance/labels";
import { formatUsd } from "@/lib/format";
import { usdCentsToXof as appUsdCentsToXof } from "@/lib/money/fx";
import {
  buildFinancialDocumentData,
  formatRate,
  renderFinancialDocument,
  usdCentsToXof,
  type FinancialDocumentInput,
} from "@/supabase/functions/_shared/financial-document.ts";

const quote: FinancialDocumentInput = {
  docType: "quote",
  number: "DV-2026-0007",
  issuedAt: new Date("2026-10-19T10:00:00Z"),
  validUntil: new Date("2026-10-20T08:00:00Z"),
  payment1DueAt: new Date("2026-10-20T08:00:00Z"),
  legalValidated: false,
  contractReference: "UC-2026-0042",
  company: {
    legalForm: "SARL",
    rccm: "SN-DKR-DEMO",
    ninea: "DEMO-NINEA",
    officeAddress: "Dakar, adresse fictive",
    phone: "+221330000000",
    email: "contact@exemple.test",
    representativeName: "Gérant Démo",
    representativeTitle: "Gérant",
  },
  client: {
    kind: "person",
    name: "Mamadou Diallo (démo)",
    notify_phone: "+221770000001",
    notify_email: "client@exemple.test",
    id_document_type: "passport",
    id_document_number: "DEMO-PASS-1",
    ninea: null,
    rccm: null,
  },
  dossier: {
    reference: "UC-2026-0042",
    platform: "copart",
    lot_number: "DEMO-LOT-42",
    vin: "1DEMXXX0000000042",
    make: "Toyota",
    model: "RAV4",
    model_year: 2020,
    purchase_location: "Houston, TX",
    departure_port: null,
  },
  amounts: {
    forfaitACents: 1_150_000,
    forfaitBCents: 320_000,
    insurancePremiumCents: 25_000,
    insuranceChoice: "pending",
    vatRatePercent: "0.00",
    vatCents: 0,
    insuranceVatCents: 0,
    totalCents: 1_470_000,
    depositAppliedCents: 0,
    depositExcessCents: 0,
    amountDueCents: 1_470_000,
  },
  referenceRate: {
    rate: "587.1000",
    source: "XE.com — taux moyen du marché",
    capturedAt: new Date("2026-10-19T09:30:00Z"),
  },
  editionRate: { rate: "587.1000", capturedAt: new Date("2026-10-19T09:30:00Z") },
  payments: [
    {
      creditedAt: new Date("2026-10-15T12:00:00Z"),
      mode: "bank_transfer",
      reference: "VIR-DEMO-1",
      amountCents: 300_000,
      paidCurrency: "USD",
      amountXof: null,
      fxRate: "586.5200",
    },
  ],
  accounts: [
    {
      kind: "bank",
      holder_name: "USA CARS (démo)",
      bank_name: "Banque Démo",
      account_number: "DEMO-0000-0001",
      iban: "SN00 DEMO 0000 0000 0000 0001",
      phone: null,
    },
    {
      kind: "wave",
      holder_name: "USA CARS (démo)",
      bank_name: null,
      account_number: null,
      iban: null,
      phone: "+221770000900",
    },
  ],
  terms: {
    validityHours: 48,
    payment1DueHoursAfterWin: 24,
    balanceDueHoursBeforeEta: 48,
    balanceRecommendedDaysBeforeEta: 7,
    lateFeeCents: 10_000,
    lateFeePeriodDays: 14,
    releaseBusinessHours: 48,
  },
};

const invoice: FinancialDocumentInput = {
  ...quote,
  docType: "deposit_invoice",
  number: "FA-2026-0003",
  validUntil: null,
  amounts: {
    ...quote.amounts,
    forfaitBCents: null,
    insuranceChoice: "accepted",
    totalCents: 1_150_000,
    depositAppliedCents: 300_000,
    amountDueCents: 850_000,
  },
  editionRate: { rate: "590.2500", capturedAt: new Date("2026-10-20T07:00:00Z") },
};

/** Texte brut du document Word généré (corps + en-tête). */
function textOf(bytes: Uint8Array): string {
  const zip = new PizZip(bytes);
  const xml = ["word/document.xml", "word/header1.xml"].map((f) => zip.file(f)!.asText()).join("");
  return (xml.match(/<w:t[^>]*>[^<]*<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join("\n");
}

describe("devis et facture d'acompte — fonction generate-document (US-3.3, US-3.4)", () => {
  it("conversion FCFA identique à lib/money/fx (R1)", () => {
    for (const [cents, rate] of [
      [1_470_000, "587.1000"],
      [1, "586.5200"],
      [12_345_67, "600.0001"],
      [850_000, "590.2500"],
    ] as const) {
      expect(usdCentsToXof(cents, rate)).toBe(appUsdCentsToXof(cents, rate));
    }
    expect(formatRate("587.1000")).toBe("587,10");
    expect(formatRate("600.0125")).toBe("600,0125");
  });

  it("devis : lignes A, B, option C, total hors et avec assurance, validité alignée sur le paiement 1 (X2)", () => {
    const data = buildFinancialDocumentData(quote);
    expect(data.titre_document).toBe("DEVIS N° DV-2026-0007");
    expect(data.case_devis).toBe("☒");
    expect(data.case_fa).toBe("☐");
    expect(data.montant_a).toBe(formatUsd(1_150_000));
    expect(data.montant_b).toBe(formatUsd(320_000));
    expect(data.montant_c).toBe(`${formatUsd(25_000)} (option)`);
    expect(data.total_general).toBe(`${formatUsd(1_470_000)} hors option C\n${formatUsd(1_495_000)} avec l’assurance`);
    expect(data.total_paye).toBe(formatUsd(300_000));
    // 14 700 − 3 000 = 11 700 $US × 587,10 = 6 869 070 FCFA
    expect(String(data.solde_fcfa).replace(/\s/g, " ")).toBe(
      "6 869 070 FCFA au taux du 19/10/2026 (indicatif, réactualisé au paiement)",
    );
    expect(data.conditions_validite).toContain("Devis valable 48 heures au plus, soit jusqu’au 20/10/2026 à 08h00");
    expect(data.frais_retard).toBe(formatUsd(10_000));
    expect(data.client_piece).toBe("Passeport n° DEMO-PASS-1");
  });

  it("facture d'acompte : totalité du forfait A, dépôt déduit, taux de référence du devis, FCFA au taux du jour", () => {
    const data = buildFinancialDocumentData(invoice);
    expect(data.titre_document).toBe("FACTURE D’ACOMPTE N° FA-2026-0003");
    expect(data.case_fa).toBe("☒");
    expect(data.montant_b).toBe("Facturé au solde");
    expect(data.case_c_acceptee).toBe("☒");
    expect(data.solde_usd).toBe(formatUsd(850_000));
    expect(data.p1_montant).toBe(formatUsd(850_000));
    expect(data.taux).toBe("587,10");
    // 8 500 $US × 590,25 = 5 017 125 FCFA
    expect(String(data.solde_fcfa).replace(/\s/g, " ")).toBe(
      "5 017 125 FCFA au taux du 20/10/2026 (indicatif, réactualisé au paiement)",
    );
  });

  it("excédent de dépôt signalé (à restituer, R6)", () => {
    const data = buildFinancialDocumentData({
      ...invoice,
      amounts: { ...invoice.amounts, depositAppliedCents: 1_150_000, depositExcessCents: 50_000, amountDueCents: 0 },
    });
    expect(data.solde_usd).toBe(`${formatUsd(0)}\nExcédent de dépôt à restituer : ${formatUsd(50_000)}`);
    expect(data.p1_statut).toBe("☒ Payé");
  });

  it("fichier généré : logo en en-tête, mention PROJET, aucune balise restante", () => {
    const bytes = renderFinancialDocument(quote);
    const zip = new PizZip(bytes);
    expect(zip.file("word/media/logo-usa-cars.png")).not.toBeNull();
    expect(zip.file("word/_rels/header1.xml.rels")!.asText()).toContain("media/logo-usa-cars.png");
    const text = textOf(bytes);
    expect(text).toContain("DV-2026-0007");
    expect(text).toContain("PROJET");
    expect(text).toContain("SN00 DEMO 0000 0000 0000 0001");
    expect(text).not.toMatch(/[{}]|undefined|null|NaN/);
  });

  it("CLAUDE.md règle 2 : aucun libellé ni montant de coût interne dans le fichier généré", () => {
    // Coûts internes du dossier (montants choisis distincts de tout montant visible) : ils ne doivent jamais apparaître.
    const internalCosts = [
      { category: "hammer_price", amount_cents: 943_700 },
      { category: "auction_fees", amount_cents: 87_300 },
      { category: "ocean_freight", amount_cents: 178_100 },
    ] as const;
    for (const document of [quote, invoice]) {
      const text = textOf(renderFinancialDocument(document));
      for (const cost of internalCosts) {
        expect(text).not.toContain(COST_CATEGORY_LABELS[cost.category]);
        expect(text).not.toContain(formatUsd(cost.amount_cents));
      }
      expect(text.toLowerCase()).not.toMatch(/marge|coût interne|cout interne/);
    }
  });
});
