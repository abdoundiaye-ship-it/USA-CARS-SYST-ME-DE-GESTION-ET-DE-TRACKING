import { describe, expect, it } from "vitest";
import {
  acceptanceSchema,
  clientSchema,
  missingClientInformation,
  normalizePhone,
  proofFileError,
  vehicleSchema,
} from "./operations";

describe("téléphone de notification (US-2.1 : format international +221…)", () => {
  it.each([
    ["+221 77 123 45 67", "+221771234567"],
    ["00221 77-123-45-67", "+221771234567"],
    ["77 123 45 67", "+221771234567"],
    ["+33 6 12 34 56 78", "+33612345678"],
  ])("%s → %s", (input, expected) => expect(normalizePhone(input)).toBe(expected));

  it.each(["", "12345", "0771234567", "+0 77 123", "abc"])("refuse « %s »", (input) =>
    expect(normalizePhone(input)).toBeNull(),
  );
});

describe("fiche client", () => {
  const base = { kind: "person", name: "Awa Diop", notifyPhone: "77 123 45 67" };

  it("normalise et accepte une fiche minimale", () => {
    const parsed = clientSchema.parse({ ...base, notifyEmail: " Awa@Exemple.TEST " });
    expect(parsed.notifyPhone).toBe("+221771234567");
    expect(parsed.notifyEmail).toBe("awa@exemple.test");
    expect(parsed.address).toBeNull();
  });

  it("exige le type de pièce quand un numéro est saisi", () => {
    const result = clientSchema.safeParse({ ...base, idDocumentNumber: "123" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["idDocumentType"]);
  });

  it("refuse un téléphone inexploitable avec un message qui dit comment corriger", () => {
    const result = clientSchema.safeParse({ ...base, notifyPhone: "123" });
    expect(result.error?.issues[0]?.message).toMatch(/format international/);
  });

  it("liste les informations manquantes (client complet)", () => {
    const person = {
      kind: "person" as const,
      id_document_type: null,
      id_document_number: null,
      ninea: null,
      rccm: null,
      representative_name: null,
      address: null,
      notify_phone: "+221771234567",
    };
    expect(missingClientInformation(person)).toEqual(["adresse", "pièce d’identité"]);
    expect(
      missingClientInformation({
        ...person,
        kind: "company",
        address: "Dakar",
        ninea: "N1",
        representative_name: "Fatou",
      }),
    ).toEqual([]);
  });
});

describe("véhicule du dossier", () => {
  it("normalise le VIN (majuscules, sans espaces) et convertit année et miles", () => {
    const parsed = vehicleSchema.parse({ vin: "1dem xxx0000000001", modelYear: "2019", mileage: "48 000" });
    expect(parsed.vin).toBe("1DEMXXX0000000001");
    expect(parsed.modelYear).toBe(2019);
    expect(parsed.mileage).toBe(48000);
  });

  it.each(["1DEMXXX000000001", "1DEMIXX0000000001", "1DEMOXX0000000001"])("refuse le VIN « %s »", (vin) =>
    expect(vehicleSchema.safeParse({ vin }).success).toBe(false),
  );

  it("refuse une année improbable", () => {
    expect(vehicleSchema.safeParse({ modelYear: "1890" }).success).toBe(false);
  });
});

describe("acceptation du contrat (R15)", () => {
  const base = {
    dossierId: "11111111-1111-4111-8111-111111111111",
    contractId: "22222222-2222-4222-8222-222222222222",
    decision: "accepted",
    decidedOn: "2026-10-19",
  };

  it("WhatsApp : exige le numéro émetteur", () => {
    expect(acceptanceSchema.safeParse({ ...base, method: "whatsapp" }).success).toBe(false);
    expect(acceptanceSchema.parse({ ...base, method: "whatsapp", whatsappFrom: "77 123 45 67" }).whatsappFrom).toBe(
      "+221771234567",
    );
  });

  it("le portail n'est pas une méthode saisissable par un agent", () => {
    expect(acceptanceSchema.safeParse({ ...base, method: "portal" }).success).toBe(false);
  });

  it("contrôle le fichier de preuve", () => {
    expect(proofFileError(null)).toMatch(/Joignez/);
    expect(proofFileError(new File(["x"], "a.exe", { type: "application/x-msdownload" }))).toMatch(/Format/);
    expect(proofFileError(new File(["x"], "scan.pdf", { type: "application/pdf" }))).toBeNull();
  });
});
