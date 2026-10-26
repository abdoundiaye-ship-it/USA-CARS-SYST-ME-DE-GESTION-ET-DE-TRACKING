import { expect, test } from "@playwright/test";
import { databaseAvailable, expectNoHorizontalScroll, signIn } from "./helpers";

// Décision P6-4 : validation des paramètres « à confirmer » avant la mise en production, par l'administrateur
// (second compte de démonstration admin2@exemple.test, 2FA de démonstration), un paramètre à la fois, avec la
// traçabilité (administrateur, date et heure). « À compléter » n'est jamais confirmable.
test.beforeEach(async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Parcours exécuté une seule fois (desktop).");
  test.skip(!(await databaseAvailable(request)), "Supabase local non démarré.");
});

test.describe("administrateur", () => {
  test.describe.configure({ retries: 0 }); // la validation modifie la base : pas de nouvel essai sur un état déjà validé

  test("filtre les paramètres à confirmer et en valide un, avec traçabilité", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "admin2@exemple.test");
    await page.goto("/parametres?statut=a_confirmer");
    await expect(page.getByText(/paramètres? encore à confirmer/)).toBeVisible();
    const tabs = page.getByRole("navigation", { name: "Filtrer par statut" });
    await expect(tabs.getByRole("link", { name: /À confirmer/ })).toHaveAttribute("aria-current", "page");

    await page.getByRole("link", { name: "ETA modifiée signalée pendant (jours)" }).click();
    await expect(page.getByRole("heading", { name: "Valider la valeur actuelle" })).toBeVisible();
    await page.getByRole("button", { name: "Valider la valeur actuelle" }).click();
    await expect(page.getByText("Paramètre validé.", { exact: false })).toBeVisible();

    const latest = page.getByRole("row").filter({ hasText: "Validation" }).first();
    await expect(latest).toContainText("Babacar Admin (démo)");
    await expect(latest).toContainText("Confirmé");
    await expect(page.getByRole("heading", { name: "Valider la valeur actuelle" })).toHaveCount(0);

    // Le paramètre a quitté la liste « à confirmer ».
    await page.goto("/parametres?statut=a_confirmer");
    await expect(page.getByRole("link", { name: "ETA modifiée signalée pendant (jours)" })).toHaveCount(0);
  });

  test("ne peut pas valider une valeur « À compléter »", async ({ page }) => {
    await signIn(page, "admin2@exemple.test");
    await page.goto(`/parametres/${encodeURIComponent("company.email")}`);
    await expect(page.getByText(/Valeur provisoire « À compléter »/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Valider la valeur actuelle" })).toHaveCount(0);
  });
});

test("direction : avancement et historique en lecture seule", async ({ page }) => {
  await signIn(page, "direction@exemple.test");
  await page.goto("/parametres");
  await expect(page.getByRole("progressbar", { name: "Paramètres confirmés" })).toBeVisible();
  await page.getByRole("link", { name: "Validité du devis (heures)" }).click();
  await expect(page.getByRole("columnheader", { name: "Enregistrée le" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Valider la valeur actuelle" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Enregistrer la nouvelle version" })).toHaveCount(0);

  await page.goto("/parametres?statut=a_confirmer");
  await page.setViewportSize({ width: 400, height: 800 });
  await expectNoHorizontalScroll(page);
});
