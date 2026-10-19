import { expect, test, type Page } from "@playwright/test";
import { databaseAvailable, expectNoHorizontalScroll, signIn } from "./helpers";

// Phase 2, lot 2b — US-2.3 (ordre d'achat), US-2.4 (enchère), US-2.5 (étapes) sur le dossier DEMO-2026-0001.
test.beforeEach(async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Parcours avec état partagé : exécutés une seule fois (desktop).");
  test.skip(!(await databaseAvailable(request)), "Supabase local non démarré.");
});

const PDF = {
  name: "signe.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"),
};

/** Section de la fiche dossier, repérée par son titre. */
const section = (page: Page, title: string) =>
  page.locator("section").filter({ has: page.getByRole("heading", { level: 2, name: title, exact: true }) });

test("agent : ordre d’achat signé, lot remporté, passage jusqu’au transport USA", async ({ page }) => {
  test.setTimeout(150_000);
  await signIn(page, "ops@exemple.test");
  await page.goto("/dossiers?q=DEMO-2026-0001");
  await page.getByRole("link", { name: "DEMO-2026-0001" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dossier DEMO-2026-0001");

  // Contrat généré puis signé (prérequis de l'étape Ouverture)
  const contract = section(page, "Contrat de prestation");
  await contract.getByRole("button", { name: "Générer le contrat" }).click();
  await expect(contract.getByText("En attente de signature")).toBeVisible({ timeout: 30_000 });
  await contract.getByLabel("Contrat signé scanné").setInputFiles(PDF);
  await contract.getByRole("button", { name: "Enregistrer la décision du client" }).click();
  await expect(contract.getByText("Accepté par le client")).toBeVisible();

  // US-2.3 — ordre d'achat : saisie, génération, signature avec les 4 confirmations
  const order = section(page, "Ordre d’achat (annexe B)");
  await expect(order.getByText(/Âge du véhicule conforme/)).toBeVisible();
  await order.getByLabel("Enchère maximale (USD)").fill("12 450");
  await order.getByLabel("Dépôt attendu (USD)").fill("3000");
  await order.getByRole("button", { name: "Enregistrer et générer l’ordre d’achat" }).click();
  await expect(order.getByText("Ordre d’achat généré.")).toBeVisible({ timeout: 30_000 });
  await expect(order.getByRole("link", { name: "Télécharger l’ordre d’achat (Word)" })).toBeVisible();

  await order.getByLabel("Ordre d’achat signé scanné").setInputFiles(PDF);
  await order.getByRole("checkbox", { name: /a pris connaissance/ }).check();
  await order.getByRole("checkbox", { name: /a vérifié que l’âge/ }).check();
  await order.getByRole("button", { name: "Enregistrer la décision sur l’ordre d’achat" }).click();
  await expect(order.getByText(/4 confirmations/)).toBeVisible(); // deux cases manquent
  // Après une erreur, React vide le formulaire (le fichier est à joindre de nouveau) : attendre ce vidage.
  await expect(order.getByLabel("Ordre d’achat signé scanné")).toHaveValue("");
  await order.getByLabel("Ordre d’achat signé scanné").setInputFiles(PDF);
  for (const name of [/a pris connaissance/, /a vérifié que l’âge/, /lot remporté l’engage/, /droits et taxes/]) {
    await order.getByRole("checkbox", { name }).check();
  }
  await order.getByRole("button", { name: "Enregistrer la décision sur l’ordre d’achat" }).click();
  await expect(order.getByText("Signé", { exact: true })).toBeVisible();

  // US-2.5 — Ouverture → Achat : toutes les conditions sont remplies
  const stage = section(page, "Passage à l’étape suivante");
  await expect(stage.getByText("✗")).toHaveCount(0);
  await stage.getByRole("button", { name: "Passer à l’étape Achat" }).click();
  await expect(page.getByText("Enchère en cours").first()).toBeVisible();

  // US-2.4 — prix au-dessus de l'enchère maximale : refusé à l'agent ; puis lot remporté
  const auction = section(page, "Enchère");
  await auction.getByLabel("Prix d’adjudication (USD)").fill("13 000");
  await auction.getByLabel("Notification du lot remporté (Dakar)").fill("2026-10-19T10:00");
  await auction.getByRole("button", { name: "Enregistrer le résultat de l’enchère" }).click();
  await expect(auction.getByText(/validation de l’administrateur obligatoire/)).toBeVisible();
  await auction.getByLabel("Prix d’adjudication (USD)").fill("12 000");
  await auction.getByLabel("Notification du lot remporté (Dakar)").fill("2026-10-19T10:00");
  await auction.getByRole("button", { name: "Enregistrer le résultat de l’enchère" }).click();
  await expect(auction.getByText("Échéance du paiement 1")).toBeVisible();
  await expect(auction.getByText("20/10/2026 10:00")).toBeVisible(); // notification + 24 h (R4)

  // P1 — confirmations manuelles, facture d'enchère, puis Achat → Transport USA
  await expect(stage.getByRole("button", { name: "Passer à l’étape Transport USA" })).toBeDisabled();
  const money = section(page, "Devis et paiement 1");
  await money.getByRole("button", { name: /devis accepté/ }).click();
  await expect(money.getByRole("button", { name: /devis accepté/ })).toHaveCount(0);
  await money.getByRole("button", { name: /paiement 1/ }).click();
  await expect(money.getByRole("button", { name: /paiement 1/ })).toHaveCount(0);

  const documents = section(page, "Documents");
  await documents.getByText("Ajouter un document…").click();
  await documents.getByLabel("Type de document").selectOption("auction_invoice");
  await documents.getByLabel("Fichier").setInputFiles({ ...PDF, name: "facture-copart.pdf" });
  await documents.getByRole("button", { name: "Ajouter le document" }).click();
  await expect(documents.getByRole("link", { name: "Facture d’enchère" })).toBeVisible();

  await expect(stage.getByText("✗")).toHaveCount(0);
  await stage.getByRole("button", { name: "Passer à l’étape Transport USA" }).click();
  await expect(page.getByText("Enlèvement à planifier").first()).toBeVisible();
  await expect(page.getByText("Lot remporté", { exact: true })).toBeVisible(); // chronologie

  await page.setViewportSize({ width: 400, height: 800 });
  await expectNoHorizontalScroll(page);
});
