import { describe, expect, it } from "vitest";
import { resetMfaSchema, resetPasswordSchema } from "./users";

const userId = "d0000000-0000-4000-8000-000000000002";

describe("réinitialisation du mot de passe par l’administrateur (décision du 12/11/2026)", () => {
  it("accepte le lien à copier ou l’e-mail, avec la case de confirmation cochée", () => {
    expect(resetPasswordSchema.parse({ userId, delivery: "lien", confirmation: "on" })).toEqual({
      userId,
      delivery: "lien",
      confirmation: "on",
    });
    expect(resetPasswordSchema.safeParse({ userId, delivery: "email", confirmation: "on" }).success).toBe(true);
  });

  it("refuse sans la case de confirmation", () => {
    const result = resetPasswordSchema.safeParse({ userId, delivery: "lien" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ["confirmation"],
      message: "Cochez la case pour confirmer la réinitialisation.",
    });
  });

  it("refuse un mode d’envoi inconnu ou un utilisateur invalide", () => {
    expect(resetPasswordSchema.safeParse({ userId, delivery: "sms", confirmation: "on" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ userId: "abc", delivery: "lien", confirmation: "on" }).success).toBe(false);
  });
});

describe("réinitialisation de la double authentification", () => {
  it("exige la case de confirmation", () => {
    expect(resetMfaSchema.safeParse({ userId, confirmation: "on" }).success).toBe(true);
    expect(resetMfaSchema.safeParse({ userId }).error?.issues[0]?.path).toEqual(["confirmation"]);
  });
});
