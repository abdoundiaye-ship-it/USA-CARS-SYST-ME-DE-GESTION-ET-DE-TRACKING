import { describe, expect, it } from "vitest";
import {
  confirmationProgress,
  isPlaceholderValue,
  isUndefinedValue,
  matchesStatusFilter,
  parseStatusFilter,
  settingActionKind,
} from "./confirmation";

describe("validation des paramètres (P6-4)", () => {
  it("reconnaît la valeur de remplissage « À compléter », quelle que soit la casse", () => {
    expect(isPlaceholderValue("À compléter")).toBe(true);
    expect(isPlaceholderValue(" à compléter ")).toBe(true);
    expect(isPlaceholderValue("Dakar, Plateau")).toBe(false);
    expect(isPlaceholderValue(48)).toBe(false);
    expect(isPlaceholderValue(null)).toBe(false);
  });

  it("signale une valeur non définie", () => {
    expect(isUndefinedValue(null)).toBe(true);
    expect(isUndefinedValue(0)).toBe(false);
    expect(isUndefinedValue("")).toBe(false);
  });

  it("qualifie chaque version de l'historique", () => {
    expect(settingActionKind({ value: 48, status: "a_confirmer" }, null)).toBe("initial");
    expect(settingActionKind({ value: 48, status: "confirme" }, { value: 48, status: "a_confirmer" })).toBe(
      "validation",
    );
    expect(settingActionKind({ value: 72, status: "confirme" }, { value: 48, status: "a_confirmer" })).toBe(
      "modification",
    );
    expect(settingActionKind({ value: [7, 3], status: "confirme" }, { value: [7, 3], status: "confirme" })).toBe(
      "new_version",
    );
    expect(settingActionKind({ value: 48, status: "a_confirmer" }, { value: 48, status: "confirme" })).toBe("status");
  });

  it("filtre la liste par statut (par défaut : tous)", () => {
    expect(parseStatusFilter("a_confirmer")).toBe("a_confirmer");
    expect(parseStatusFilter("confirme")).toBe("confirme");
    expect(parseStatusFilter("n'importe quoi")).toBe("tous");
    expect(parseStatusFilter(undefined)).toBe("tous");
    expect(matchesStatusFilter("a_confirmer", "confirme")).toBe(false);
    expect(matchesStatusFilter("a_confirmer", "tous")).toBe(true);
  });

  it("mesure l'avancement", () => {
    expect(confirmationProgress(["confirme", "a_confirmer", "confirme"])).toEqual({
      confirmed: 2,
      toConfirm: 1,
      total: 3,
    });
    expect(confirmationProgress([])).toEqual({ confirmed: 0, toConfirm: 0, total: 0 });
  });
});
