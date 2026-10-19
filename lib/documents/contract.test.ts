import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { BLANK, buildContractData, platformBoxes, renderContract, sha256Hex, type ContractInput } from "./contract";

const input: ContractInput = {
  reference: "UC-2026-0042",
  date: new Date("2026-10-19T10:00:00Z"),
  legalValidated: false,
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
    address: "Dakar, adresse fictive",
    notify_phone: "+221770000001",
    notify_email: "client@exemple.test",
    id_document_type: "passport",
    id_document_number: "DEMO-PASS-1",
    ninea: null,
    rccm: null,
    representative_name: null,
    representative_title: null,
  },
  dossier: {
    reference: "UC-2026-0042",
    platform: "iaa",
    lot_number: "DEMO-LOT-42",
    vin: "1DEMXXX0000000042",
    make: "Toyota",
    model: "RAV4",
    model_year: 2020,
    mileage: 48000,
    title_status: null,
    purchase_location: "Houston, TX",
    departure_port: null,
  },
};

/** Texte brut du document Word généré (corps + en-tête). */
function textOf(bytes: Uint8Array): string {
  const zip = new PizZip(bytes);
  const xml = ["word/document.xml", "word/header1.xml"].map((f) => zip.file(f)!.asText()).join("");
  return (xml.match(/<w:t[^>]*>[^<]*<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join("");
}

describe("contrat de prestation (US-2.2, R14)", () => {
  it("coche la plateforme choisie", () => {
    expect(platformBoxes("iaa")).toBe("☐ COPART   ☒ IAA   ☐ Autre");
    expect(platformBoxes(null)).toBe("☐ COPART   ☐ IAA   ☐ Autre");
  });

  it("prépare les données : espace réservé pour l'inconnu, « Sans objet » pour un particulier", () => {
    const data = buildContractData(input);
    expect(data.date_contrat).toBe("19/10/2026");
    expect(data.client_piece).toBe("Passeport n° DEMO-PASS-1");
    expect(data.client_ninea_rccm).toBe("Sans objet");
    expect(data.statut_titre).toBe(BLANK);
    expect(data.kilometrage).toBe("48 000 miles");
    expect(data.prix_adjudication).toBe(BLANK);
  });

  it("société : NINEA, RCCM et représentant", () => {
    const data = buildContractData({
      ...input,
      client: {
        ...input.client,
        kind: "company",
        ninea: "N1",
        rccm: "R1",
        representative_name: "Fatou",
        representative_title: "Gérante",
      },
    });
    expect(data.client_ninea_rccm).toBe("NINEA N1 · RCCM R1");
    expect(data.client_signataire).toBe("Fatou");
  });

  it("génère un document rempli, sans balise restante, avec la mention PROJET (D1)", () => {
    const started = performance.now();
    const text = textOf(renderContract(input));
    const elapsed = performance.now() - started;
    expect(text).toContain("Référence contrat : UC-2026-0042");
    expect(text).toContain("Mamadou Diallo (démo)");
    expect(text).toContain("1DEMXXX0000000042");
    expect(text).toContain("☒ IAA");
    expect(text).toContain("PROJET : document non validé juridiquement");
    expect(text).not.toMatch(/[{}]/);
    expect(text).not.toContain("undefined");
    // Repère pour la limite de calcul de Cloudflare Workers (docs/18_deploiement_cloudflare.md).
    expect(elapsed).toBeLessThan(2000);
  });

  it("retire la mention PROJET une fois le modèle validé juridiquement", () => {
    expect(textOf(renderContract({ ...input, legalValidated: true }))).not.toContain("PROJET");
  });

  it("calcule l'empreinte SHA-256 (version figée, R15)", async () => {
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
