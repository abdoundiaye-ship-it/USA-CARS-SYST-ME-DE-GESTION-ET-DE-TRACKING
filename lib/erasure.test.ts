import { describe, expect, it } from "vitest";
import {
  ERASURE_SCOPE_KEPT,
  ERASURE_SCOPE_LABELS,
  ERASURE_STATUS_LABELS,
  erasureStatusTone,
  isErasableScope,
} from "@/lib/erasure";

describe("anonymisation des dossiers (G2-c/G2-d)", () => {
  it("libelle chaque statut et chaque portée", () => {
    expect(ERASURE_STATUS_LABELS.pending_approval).toContain("approbation");
    expect(ERASURE_STATUS_LABELS.executed).toContain("effectuée");
    expect(ERASURE_SCOPE_LABELS.other_data).toContain("Identité");
    expect(ERASURE_SCOPE_LABELS.all).toContain("comptables");
    expect(ERASURE_SCOPE_KEPT.other_data).toContain("10 ans");
  });

  it("donne une teinte à chaque statut", () => {
    expect(erasureStatusTone("pending_approval")).toBe("warning");
    expect(erasureStatusTone("approved")).toBe("info");
    expect(erasureStatusTone("executed")).toBe("success");
    expect(erasureStatusTone("cancelled")).toBe("neutral");
  });

  it("ne retient comme effaçables que les portées connues", () => {
    expect(isErasableScope("other_data")).toBe(true);
    expect(isErasableScope("all")).toBe(true);
    expect(isErasableScope("accounting")).toBe(false);
    expect(isErasableScope(null)).toBe(false);
  });
});
