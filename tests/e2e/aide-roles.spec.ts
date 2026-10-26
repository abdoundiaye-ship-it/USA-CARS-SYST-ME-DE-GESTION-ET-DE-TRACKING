import { expect, test } from "@playwright/test";
import { databaseAvailable, expectNoHorizontalScroll, signIn } from "./helpers";

// Décision P6-5 : guide « Rôles et droits d'accès » pour l'administrateur et la direction (profils, matrice des droits,
// validations croisées, processus métier), imprimable. Refusé aux autres rôles.
test.beforeEach(async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Parcours exécuté une seule fois (desktop).");
  test.skip(!(await databaseAvailable(request)), "Supabase local non démarré.");
});

test("administrateur : ouvre le guide depuis l’Aide et consulte profils, matrice et validations", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, "admin2@exemple.test");
  await page.goto("/aide");
  await page.getByRole("link", { name: "Rôles et droits d’accès" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Rôles et droits d’accès" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Imprimer" })).toBeVisible();

  for (const section of ["Les profils", "Matrice des droits", "Validations croisées et séparation des tâches"]) {
    await expect(page.getByRole("heading", { level: 2, name: section })).toBeVisible();
  }
  for (const profile of ["Administrateur", "Direction", "Comptabilité", "Agent opérations", "Client"]) {
    await expect(page.getByRole("heading", { level: 3, name: profile, exact: true })).toBeVisible();
  }
  const matrix = page.getByRole("table", { name: "Matrice des droits par module et par profil" });
  await expect(matrix.getByRole("row").filter({ hasText: "Anonymisation des dossiers" })).toContainText("L C V");
  await expect(matrix.getByRole("row").filter({ hasText: "Forfaits et coûts internes" })).toContainText("—");

  await page.setViewportSize({ width: 400, height: 800 });
  await expectNoHorizontalScroll(page);
});

test("direction : accède au guide depuis l’écran Utilisateurs", async ({ page }) => {
  await signIn(page, "direction@exemple.test");
  await page.goto("/utilisateurs");
  await page.getByRole("link", { name: /Rôles et droits d’accès/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Rôles et droits d’accès" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Rapports par rôle" })).toBeVisible();
});

test("agent opérations : accès refusé au guide", async ({ page }) => {
  await signIn(page, "ops@exemple.test");
  await page.goto("/aide");
  await expect(page.getByRole("link", { name: "Rôles et droits d’accès" })).toHaveCount(0);
  await page.goto("/aide/roles");
  await expect(page).toHaveURL(/\/acces-refuse/);
});
