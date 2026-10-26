import { expect, test } from "@playwright/test";
import { databaseAvailable, expectNoHorizontalScroll, signIn } from "./helpers";

// Phase 6, G2-c/G2-d — anonymisation des dossiers. DEMO-2026-0010 est terminé depuis 6 ans : durée « autres données »
// (5 ans) atteinte, il figure au rapport « Conservation des données » et est éligible à l'anonymisation.
// La section de la fiche est réservée à l'administrateur ; son parcours (demande, double validation, exécution) est
// vérifié en base par supabase/tests/database/022_anonymisation.test.sql (le secret TOTP de l'administrateur n'est
// connu que du parcours d'enrôlement de socle.spec.ts).
test.beforeEach(async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Parcours exécuté une seule fois (desktop).");
  test.skip(!(await databaseAvailable(request)), "Supabase local non démarré.");
});

test("direction : dossier éligible au rapport, sans accès à l’anonymisation", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, "direction@exemple.test");
  await page.goto("/rapports?rapport=retention");
  await expect(page.getByText(/depuis la fiche du dossier/)).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: "DEMO-2026-0010" });
  await expect(row).toContainText("Hors pièces comptables");

  await row.getByRole("link", { name: "DEMO-2026-0010" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Dossier DEMO-2026-0010" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Anonymisation des données" })).toHaveCount(0);
});

test("opérations : pas de section d’anonymisation sur un dossier éligible", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, "ops@exemple.test");
  await page.goto("/dossiers?q=DEMO-2026-0010");
  await page
    .getByRole("link", { name: /DEMO-2026-0010/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Dossier DEMO-2026-0010" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Anonymisation des données" })).toHaveCount(0);

  await page.setViewportSize({ width: 400, height: 800 });
  await expectNoHorizontalScroll(page);
});
