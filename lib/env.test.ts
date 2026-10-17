import { describe, expect, it } from "vitest";
import { assertNotProductionOutsideProd, PRODUCTION_PROJECT_REF } from "./env";

describe("garde-fou production (CLAUDE.md §2)", () => {
  const prodUrl = `https://${PRODUCTION_PROJECT_REF}.supabase.co`;

  it("refuse l’URL de production hors environnement production", () => {
    expect(() => assertNotProductionOutsideProd(prodUrl, "local")).toThrow(/production/);
    expect(() => assertNotProductionOutsideProd(prodUrl, undefined)).toThrow(/production/);
  });

  it("accepte l’URL de production en production et l’URL locale partout", () => {
    expect(() => assertNotProductionOutsideProd(prodUrl, "production")).not.toThrow();
    expect(() => assertNotProductionOutsideProd("http://127.0.0.1:54321", "local")).not.toThrow();
  });
});
