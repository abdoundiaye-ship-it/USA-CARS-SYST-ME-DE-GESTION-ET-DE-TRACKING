import { expect, test } from "@playwright/test";
import { databaseAvailable, expectNoHorizontalScroll, signIn } from "./helpers";

// Décision du 12/11/2026 : l'administrateur réinitialise le mot de passe d'un utilisateur interne actif. L'ancien
// mot de passe est bloqué, les sessions ouvertes sont fermées, et la personne choisit le nouveau depuis un lien.
// Compte créé par le test (les comptes du seed servent aux autres parcours et gardent leur mot de passe).
test.beforeEach(async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Parcours exécuté une seule fois (desktop).");
  test.skip(!(await databaseAvailable(request)), "Supabase local non démarré.");
});

test.describe("administrateur", () => {
  test.describe.configure({ retries: 0 }); // le parcours modifie des comptes : pas de nouvel essai sur un état modifié

  test("réinitialise le mot de passe : ancien bloqué, session fermée, nouveau choisi par lien", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    await signIn(page, "admin2@exemple.test");
    await page.goto("/utilisateurs");

    // Compte de test : créé puis activé par son lien (mot de passe choisi par la personne).
    const email = `reinit.${Date.now()}@exemple.test`;
    const name = `Agent Réinitialisation ${Date.now()} (démo)`;
    await page.getByLabel("Nom complet").fill(name);
    await page.getByLabel("Adresse e-mail").fill(email);
    await page.getByLabel("Rôle", { exact: true }).selectOption("ops");
    await page.getByRole("button", { name: "Créer le compte", exact: true }).click();
    await expect(page.getByText(`Compte créé pour ${email}.`)).toBeVisible();
    const inviteLink = await page.getByLabel("Lien d’accès").inputValue();

    const agent = await browser.newContext();
    const agentPage = await agent.newPage();
    await agentPage.goto(inviteLink);
    await agentPage.getByRole("button", { name: "Continuer et choisir mon mot de passe" }).click();
    await agentPage.getByLabel("Nouveau mot de passe").fill("AncienMotDePasse2026");
    await agentPage.getByLabel("Confirmez le mot de passe").fill("AncienMotDePasse2026");
    await agentPage.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
    await expect(agentPage).toHaveURL(/\/tableau-de-bord/);

    // Réinitialisation : la case de confirmation est obligatoire.
    await page.reload();
    const row = page.getByRole("row").filter({ hasText: email });
    await expect(row.getByRole("button", { name: "Réinitialiser la double authentification" })).toHaveCount(0);
    await row.getByRole("button", { name: "Réinitialiser le mot de passe" }).click();
    await row.getByRole("button", { name: "Confirmer la réinitialisation" }).click();
    await expect(row.getByText("Cochez la case pour confirmer la réinitialisation.")).toBeVisible();
    await row.getByLabel(/Je confirme : l’ancien mot de passe cessera immédiatement de fonctionner/).check();
    await row.getByRole("button", { name: "Confirmer la réinitialisation" }).click();
    await expect(row.getByText(/Mot de passe réinitialisé : l’ancien ne fonctionne plus\./)).toBeVisible();
    const resetLink = await row.getByLabel("Lien d’accès").inputValue();
    expect(resetLink).toContain("/auth/confirm?token_hash=");
    await expectNoHorizontalScroll(page);

    // La session déjà ouverte par l'agent est fermée.
    await agentPage.goto("/tableau-de-bord");
    await expect(agentPage).toHaveURL(/\/connexion/);
    await agent.close();

    // L'ancien mot de passe ne fonctionne plus.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await signIn(otherPage, email, "AncienMotDePasse2026", { expectRedirect: false });
    await expect(otherPage.getByText("E-mail ou mot de passe incorrect.")).toBeVisible();

    // Le lien, transmis par WhatsApp, a déjà été ouvert par l'aperçu automatique : il reste utilisable.
    expect((await other.request.get(resetLink)).ok()).toBe(true);
    // Il permet de choisir le nouveau mot de passe, qui fonctionne ensuite. Un paramètre `next` erroné (modèle
    // d'e-mail du tableau de bord Supabase, ex. « /compte » → 404 constaté en production) est ignoré.
    await otherPage.goto(resetLink.replace(/next=[^&]*/, "next=%2Fcompte"));
    await otherPage.getByRole("button", { name: "Continuer et choisir mon mot de passe" }).click();
    await expect(otherPage).toHaveURL(/\/compte\/mot-de-passe/);
    await otherPage.getByLabel("Nouveau mot de passe").fill("NouveauMotDePasse2026");
    await otherPage.getByLabel("Confirmez le mot de passe").fill("NouveauMotDePasse2026");
    await otherPage.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
    await expect(otherPage).toHaveURL(/\/tableau-de-bord/);
    await other.close();

    const fresh = await browser.newContext();
    const freshPage = await fresh.newPage();
    await signIn(freshPage, email, "NouveauMotDePasse2026");
    await expect(freshPage).toHaveURL(/\/tableau-de-bord/);
    await fresh.close();

    // Audit : action, compte visé et administrateur auteur.
    await page.goto("/audit?objet=profiles&action=password_reset");
    const entry = page.getByRole("row").filter({ hasText: "Mot de passe réinitialisé par l’administrateur" }).first();
    await expect(entry).toContainText("Babacar Admin (démo)");
  });
});

test("accès refusé : la direction consulte les utilisateurs sans pouvoir réinitialiser", async ({ page }) => {
  await signIn(page, "direction@exemple.test");
  await page.goto("/utilisateurs");
  await expect(page.getByRole("heading", { level: 1, name: "Utilisateurs" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Réinitialiser le mot de passe" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Réinitialiser la double authentification" })).toHaveCount(0);
});
