import { expect, test, type Locator, type Page } from "@playwright/test";
import { databaseAvailable, expectNoHorizontalScroll, signIn } from "./helpers";

// Phase 2 — un dossier fictif traité de l'ouverture à l'arrivée à Dakar (objectif de validation de la phase 2) :
// US-2.2 à US-2.7 sur le dossier DEMO-2026-0001.
test.beforeEach(async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Parcours avec état partagé : exécutés une seule fois (desktop).");
  test.skip(!(await databaseAvailable(request)), "Supabase local non démarré.");
});

const PDF = {
  name: "signe.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"),
};

/** Ouvre un panneau repliable (<details>) quel que soit son état précédent. */
const openPanel = (scope: Locator) =>
  scope
    .locator("details")
    .first()
    .evaluate((details) => ((details as HTMLDetailsElement).open = true));

/** Section de la fiche dossier, repérée par son titre. */
const section = (page: Page, title: string) =>
  page.locator("section").filter({ has: page.getByRole("heading", { level: 2, name: title, exact: true }) });

test("agent : de l’ouverture à l’arrivée à Dakar (contrat, ordre d’achat, enchère, conteneur, ATA)", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await signIn(page, "ops@exemple.test");
  await page.goto("/dossiers?q=DEMO-2026-0001");
  await page.getByRole("link", { name: "DEMO-2026-0001" }).click();
  await page.waitForURL(/\/dossiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
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
  await expect(order.getByText(/Le client doit avoir coché les 4 confirmations/)).toBeVisible(); // deux cases manquent
  // Après une erreur, la saisie reste en place, fichier joint compris : il suffit de cocher les cases manquantes.
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
  const money = section(page, "Devis, factures et paiements");
  await money.getByRole("button", { name: /devis accepté/ }).click();
  await expect(money.getByRole("button", { name: /devis accepté/ })).toHaveCount(0);
  await money.getByRole("button", { name: /paiement 1/ }).click();
  await expect(money.getByRole("button", { name: /paiement 1/ })).toHaveCount(0);

  const documents = section(page, "Documents");
  await openPanel(documents);
  await documents.getByLabel("Type de document").selectOption("auction_invoice");
  await documents.getByLabel("Fichier").setInputFiles({ ...PDF, name: "facture-copart.pdf" });
  await documents.getByRole("button", { name: "Ajouter le document" }).click();
  await expect(documents.getByRole("link", { name: "Facture d’enchère" })).toBeVisible();

  await expect(stage.getByText("✗")).toHaveCount(0);
  await stage.getByRole("button", { name: "Passer à l’étape Transport USA" }).click();
  await expect(page.getByText("Enlèvement à planifier").first()).toBeVisible();
  await expect(page.getByText("Lot remporté", { exact: true })).toBeVisible(); // chronologie
  const dossierUrl = page.url();

  // Transport USA → Conteneur : reçu au port et preuve de prise en charge
  await stage.getByLabel("Statut dans l’étape").selectOption("received_at_port");
  await stage.getByRole("button", { name: "Enregistrer le statut" }).click();
  await expect(stage.getByLabel("Statut dans l’étape")).toHaveValue("received_at_port");
  await openPanel(documents);
  await documents.getByLabel("Type de document").selectOption("pickup_proof");
  await documents.getByLabel("Fichier").setInputFiles({ ...PDF, name: "prise-en-charge.pdf" });
  await documents.getByRole("button", { name: "Ajouter le document" }).click();
  await expect(documents.getByRole("link", { name: "Preuve de prise en charge" })).toBeVisible();
  await stage.getByRole("button", { name: "Passer à l’étape Conteneur" }).click();
  await expect(page.getByText("Chargement planifié").first()).toBeVisible();

  // US-2.6 — création d'un conteneur (numéro ISO 6346 contrôlé)
  await page
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("link", { name: "Conteneurs" })
    .click();
  await page.getByRole("link", { name: "Nouveau conteneur" }).click();
  await page.getByLabel("Numéro du conteneur").fill("MSKU9070324");
  await page.getByLabel("Transporteur").selectOption({ label: "Transporteur Démo (fictif)" });
  await page.getByLabel("N° de B/L").fill("DEMO-BL-0099");
  await page.getByLabel("Navire").fill("Navire Démo");
  await page.getByLabel("Voyage").fill("DEMO-099");
  await page.getByLabel("ETA indicative").fill("2026-11-20");
  await page.getByRole("button", { name: "Créer le conteneur" }).click();
  await expect(page.getByText(/ISO 6346/).first()).toBeVisible();
  await expect(page.getByLabel("Numéro du conteneur")).toHaveValue("MSKU9070324"); // saisie conservée
  await page.getByLabel("Numéro du conteneur").fill("msku 907032-3");
  await page.getByRole("button", { name: "Créer le conteneur" }).click();
  await page.waitForURL(/\/conteneurs\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Conteneur MSKU9070323");
  await expect(page.getByText("ETA indicative : 20/11/2026")).toBeVisible();
  const containerUrl = page.url();

  // B4 — le véhicule est associé au conteneur depuis son dossier
  await page.goto(dossierUrl);
  const box = section(page, "Conteneur");
  await box.getByLabel("Conteneur", { exact: true }).selectOption({ label: "MSKU9070323" });
  await box.getByRole("button", { name: "Associer au conteneur" }).click();
  await expect(box.getByRole("link", { name: "MSKU9070323" })).toBeVisible();
  await expect(box.getByText("ETA indicative : 20/11/2026")).toBeVisible();

  // P1 — facture de solde émise, puis Conteneur → Maritime
  await money.getByRole("button", { name: /facture de solde/ }).click();
  await expect(money.getByRole("button", { name: /facture de solde/ })).toHaveCount(0);
  await expect(stage.getByText("✗")).toHaveCount(0);
  await stage.getByRole("button", { name: "Passer à l’étape Maritime" }).click();
  await expect(page.getByText("Réservation confirmée").first()).toBeVisible();

  // US-2.7 — départ, ETA modifiée avec sa source, transbordement, vérification, ATA
  await page.goto(containerUrl);
  await page.getByLabel("Date de départ du navire").fill("2026-10-10");
  await page.getByRole("button", { name: "Enregistrer le départ" }).click();
  await expect(page.getByText("En transit").first()).toBeVisible();
  await page.getByLabel("Nouvelle ETA indicative").fill("2026-11-25");
  await page.getByLabel("Source").selectOption("carrier_site");
  await page.getByRole("button", { name: "Enregistrer l’ETA indicative" }).click();
  await expect(page.getByText("ETA indicative : 25/11/2026")).toBeVisible();
  await expect(page.getByText("ETA indicative modifiée : 20/11/2026 → 25/11/2026")).toBeVisible();
  await page.getByText("Ajouter un événement…").click();
  await page.getByLabel("Type").selectOption("transshipment");
  await page.getByLabel("Description").fill("Transbordement à Algeciras (démo)");
  await page.getByRole("button", { name: "Ajouter l’événement" }).click();
  await expect(page.getByText("Transbordement à Algeciras (démo)").first()).toBeVisible();
  await page.getByRole("button", { name: "Vérifié aujourd’hui" }).click();
  await expect(page.getByText(/Dernière vérification : \d{2}\/\d{2}\/\d{4}/)).toBeVisible();
  await page.getByLabel("Date d’arrivée réelle (ATA)").fill("2026-10-18");
  await page.getByRole("button", { name: "Enregistrer l’arrivée (ATA)" }).click();
  await expect(page.getByText("Arrivé le 18/10/2026 (ATA)")).toBeVisible();
  await expect(page.getByText(/ETA indicative :/)).toHaveCount(0); // l'ETA n'est plus affichée après l'ATA

  // Le statut « Arrivé » s'est propagé au dossier ; Maritime → Dakar
  await page.goto(dossierUrl);
  await expect(stage.getByLabel("Statut dans l’étape")).toHaveValue("arrived");
  await expect(
    page.getByText("ETA indicative modifiée : 20/11/2026 → 25/11/2026 (conteneur MSKU9070323)"),
  ).toBeVisible();
  await stage.getByRole("button", { name: "Passer à l’étape Dakar" }).click();
  await expect(page.getByText("Documents à finaliser").first()).toBeVisible();

  await page.setViewportSize({ width: 400, height: 800 });
  await expectNoHorizontalScroll(page);
  await page.goto(containerUrl);
  await expectNoHorizontalScroll(page);
});
