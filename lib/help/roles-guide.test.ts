import { describe, expect, it } from "vitest";
import { INTERNAL_ROLES, SCREEN_ROLES } from "@/lib/auth/roles";
import {
  GUIDE_ROLES,
  MODULES,
  PROFILES,
  RIGHTS,
  modulesForRole,
  rightCodes,
  rolesFor,
  VALIDATION_CIRCUITS,
  WORKFLOW,
  type ScreenKey,
} from "./roles-guide";

const moduleById = (id: string) => {
  const found = MODULES.find((m) => m.id === id);
  if (!found) throw new Error(`Module inconnu : ${id}`);
  return found;
};

describe("guide des rôles et droits (P6-5)", () => {
  it("documente chaque droit d'écran de l'application (aucun droit oublié)", () => {
    const documented = new Set<ScreenKey>();
    for (const mod of MODULES) {
      for (const right of RIGHTS) for (const source of mod.rights[right]?.sources ?? []) documented.add(source);
    }
    const missing = (Object.keys(SCREEN_ROLES) as ScreenKey[]).filter((key) => !documented.has(key));
    expect(missing).toEqual([]);
  });

  it("reprend exactement les rôles des droits d'écran", () => {
    for (const mod of MODULES) {
      for (const right of RIGHTS) {
        const grant = mod.rights[right];
        for (const source of grant?.sources ?? []) {
          for (const role of SCREEN_ROLES[source]) expect(grant!.roles).toContain(role);
        }
      }
    }
  });

  it("ne donne jamais au client accès aux coûts internes ni à l'administration", () => {
    for (const id of [
      "costs",
      "fx",
      "users",
      "audit",
      "settings",
      "carriers",
      "holidays",
      "erasures",
      "reports",
      "unclaimed",
    ]) {
      expect(rightCodes(moduleById(id), "client"), id).toBe("");
    }
    const accounts = moduleById("accounts");
    expect(rolesFor(accounts, "create")).not.toContain("client");
    expect(rolesFor(accounts, "validate")).not.toContain("client");
  });

  it("réserve les validations sensibles aux bons rôles", () => {
    expect(rolesFor(moduleById("refunds"), "validate")).toEqual(["admin"]);
    expect(rolesFor(moduleById("dossiers"), "validate")).toEqual(["admin"]);
    expect(rolesFor(moduleById("erasures"), "validate")).toEqual(["admin"]);
    expect(rolesFor(moduleById("accounts"), "validate")).toEqual(["admin", "management"]);
    expect(rolesFor(moduleById("settings"), "update")).toEqual(["admin"]);
    expect(rolesFor(moduleById("users"), "create")).toEqual(["admin"]);
  });

  it("présente un profil pour chaque rôle, avec des modules accessibles", () => {
    expect(PROFILES.map((p) => p.role).sort()).toEqual([...GUIDE_ROLES].sort());
    for (const role of GUIDE_ROLES) expect(modulesForRole(role).length, role).toBeGreaterThan(0);
    for (const role of INTERNAL_ROLES) expect(rightCodes(moduleById("dashboard"), role)).toBe("L");
  });

  it("explique les doubles validations et couvre chaque étape du dossier", () => {
    const names = VALIDATION_CIRCUITS.map((c) => c.name);
    expect(names).toContain("Comptes officiels de paiement");
    expect(names).toContain("Anonymisation d’un dossier");
    expect(WORKFLOW.map((w) => w.stage)).toEqual([
      "opening",
      "purchase",
      "us_transport",
      "container",
      "ocean",
      "dakar",
      "closing",
    ]);
  });

  it("code les droits dans l'ordre Consulter, Créer, Modifier, Valider, Supprimer", () => {
    expect(rightCodes(moduleById("costs"), "ops")).toBe("L C M S");
    expect(rightCodes(moduleById("accounts"), "management")).toBe("L V");
  });
});
