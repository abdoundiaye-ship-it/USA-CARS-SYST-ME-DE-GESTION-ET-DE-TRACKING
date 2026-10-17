import { expect, test } from "@playwright/test";

test("la page d’accueil s’affiche en français, sans défilement horizontal", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/USA CARS/);
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Système de gestion et de suivi des dossiers");
  await expect(page.getByRole("status")).toContainText("Connexion à la base de données");

  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalScroll).toBe(false);
});

test("la base de données locale répond (CI)", async ({ page }) => {
  test.skip(!process.env.CI, "Vérifié en CI, où Supabase local est démarré.");
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Connexion à la base de données : opérationnelle");
});
