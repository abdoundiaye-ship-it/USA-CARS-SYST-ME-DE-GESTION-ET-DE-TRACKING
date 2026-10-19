import { describe, expect, it } from "vitest";
import { carrierSchema, containerSchema, etaSchema, trackingEventSchema } from "./shipping";

const carrierId = "11111111-1111-4111-8111-111111111111";

describe("transporteur (P4, US-2.6)", () => {
  const base = {
    code: "Maersk",
    name: "Maersk",
    trackingUrl: "https://www.maersk.com/tracking/",
    linkType: "officiel",
  };

  it("normalise le code ; lien direct facultatif", () => {
    const parsed = carrierSchema.parse(base);
    expect(parsed.code).toBe("maersk");
    expect(parsed.urlTemplate).toBeNull();
    expect(parsed.active).toBe(false);
  });

  it("le lien direct doit contenir {container} ou {bl}", () => {
    expect(carrierSchema.safeParse({ ...base, urlTemplate: "https://www.maersk.com/tracking/" }).success).toBe(false);
    expect(
      carrierSchema.parse({ ...base, urlTemplate: "https://www.maersk.com/tracking/{container}" }).urlTemplate,
    ).toBe("https://www.maersk.com/tracking/{container}");
  });

  it("refuse une page de suivi non sécurisée", () => {
    expect(carrierSchema.safeParse({ ...base, trackingUrl: "http://exemple.test" }).success).toBe(false);
  });
});

describe("conteneur (US-2.6)", () => {
  it("normalise et contrôle le numéro ISO 6346 ; port d’arrivée Dakar par défaut", () => {
    const parsed = containerSchema.parse({ number: "csqu 305438 3", carrierId });
    expect(parsed.number).toBe("CSQU3054383");
    expect(parsed.portOfDischarge).toBe("Dakar");
    expect(parsed.eta).toBeNull();
  });

  it("refuse un chiffre de contrôle erroné avec un message explicite", () => {
    expect(containerSchema.safeParse({ number: "CSQU3054384", carrierId }).error?.issues[0]?.message).toMatch(
      /ISO 6346/,
    );
  });

  it("l’ETA ne précède pas le départ prévu", () => {
    expect(
      containerSchema.safeParse({ number: "CSQU3054383", carrierId, etd: "2026-11-10", eta: "2026-11-01" }).success,
    ).toBe(false);
  });
});

describe("ETA et événements (US-2.7)", () => {
  const containerId = carrierId;

  it("une nouvelle ETA exige sa source", () => {
    expect(etaSchema.safeParse({ containerId, eta: "2026-11-25" }).success).toBe(false);
    expect(etaSchema.parse({ containerId, eta: "2026-11-25", source: "carrier_site" }).note).toBeNull();
  });

  it("événement : départ et arrivée passent par leurs actions dédiées", () => {
    expect(
      trackingEventSchema.safeParse({ containerId, kind: "arrival", occurredOn: "2026-10-19", label: "Arrivée" })
        .success,
    ).toBe(false);
    expect(
      trackingEventSchema.parse({
        containerId,
        kind: "transshipment",
        occurredOn: "2026-10-19",
        label: "Transbordement à Algeciras",
        visibleClient: "on",
      }).visibleClient,
    ).toBe(true);
  });
});
