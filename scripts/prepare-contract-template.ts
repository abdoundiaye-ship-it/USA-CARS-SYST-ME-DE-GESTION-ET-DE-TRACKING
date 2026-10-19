/**
 * Prépare le modèle balisé du contrat (pnpm templates:contract) — docs/16_documents_generes.md.
 *
 * Source : reference/templates/USA_CARS_Contrat_Prestation_Services_Senegal_-_Revise.docx (jamais modifié).
 * Sorties : templates/contrat_prestation.docx (copie balisée, syntaxe docxtemplater `{champ}`) et
 *           supabase/functions/_shared/contract-template.generated.ts (même fichier en base64, embarqué dans la
 *           fonction Supabase generate-contract, sans accès au disque).
 *
 * Seuls l'en-tête, les blocs « USA CARS » et « LE CLIENT », l'identification du véhicule (article 3) et les
 * signatures sont balisés. Les valeurs contractuelles surlignées restent celles du modèle jusqu'à la
 * validation juridique (décision D1) ; la mention « PROJET » est ajoutée dans l'en-tête de page.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import PizZip from "pizzip";

const SOURCE = "reference/templates/USA_CARS_Contrat_Prestation_Services_Senegal_-_Revise.docx";
const OUTPUT_DOCX = "templates/contrat_prestation.docx";
const OUTPUT_MODULE = "supabase/functions/_shared/contract-template.generated.ts";

/** Remplace le texte d'un élément <w:t> (texte exact) ; `occurrence` : 1 = première, 2 = deuxième… */
function replaceText(xml: string, from: string, to: string, occurrence = 1): string {
  const needle = `>${from}</w:t>`;
  let index = -1;
  for (let i = 0; i < occurrence; i++) {
    index = xml.indexOf(needle, index + 1);
    if (index < 0) throw new Error(`Texte introuvable dans le modèle (occurrence ${occurrence}) : « ${from} »`);
  }
  return `${xml.slice(0, index)}>${to}</w:t>${xml.slice(index + needle.length)}`;
}

/** Article 3 : insère une balise dans la cellule vide qui suit le libellé (première occurrence = article 3). */
function fillValueCell(xml: string, label: string, tag: string): string {
  const labelIndex = xml.indexOf(`>${label}</w:t>`);
  if (labelIndex < 0) throw new Error(`Libellé introuvable dans le modèle : « ${label} »`);
  const cellStart = xml.indexOf("<w:tc>", labelIndex);
  const emptyParagraphEnd = xml.indexOf("</w:pPr></w:p>", cellStart);
  const cellEnd = xml.indexOf("</w:tc>", cellStart);
  if (cellStart < 0 || emptyParagraphEnd < 0 || emptyParagraphEnd > cellEnd) {
    throw new Error(`Cellule de valeur vide introuvable après « ${label} »`);
  }
  const insertAt = emptyParagraphEnd + "</w:pPr>".length;
  const run = `<w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">{${tag}}</w:t></w:r>`;
  return `${xml.slice(0, insertAt)}${run}${xml.slice(insertAt)}`;
}

function tagDocument(xml: string): string {
  let out = xml;
  out = replaceText(
    out,
    "Référence contrat : ____________________    Référence dossier : ____________________    Date : ____ / ____ / ______",
    "Référence contrat : {contrat_reference}    Référence dossier : {dossier_reference}    Date : {date_contrat}",
  );
  // Bloc USA CARS (paramètres company.*)
  out = replaceText(out, "Forme juridique : __________________", "Forme juridique : {usa_forme_juridique}");
  out = replaceText(out, "RCCM : ____________  NINEA : ____________", "RCCM : {usa_rccm}  NINEA : {usa_ninea}");
  out = replaceText(out, "Bureau au Sénégal : __________________", "Bureau au Sénégal : {usa_bureau}");
  out = replaceText(out, "Téléphone officiel : _________________", "Téléphone officiel : {usa_telephone}");
  out = replaceText(out, "E-mail officiel : _____________________", "E-mail officiel : {usa_email}");
  out = replaceText(out, "Représentée par : ____________________", "Représentée par : {usa_representant}");
  out = replaceText(out, "Fonction : _________________________", "Fonction : {usa_representant_fonction}", 1);
  // Bloc LE CLIENT
  out = replaceText(out, "Nom / Société : ______________________", "Nom / Société : {client_nom}");
  out = replaceText(out, "Adresse : ____________________________", "Adresse : {client_adresse}");
  out = replaceText(
    out,
    "Téléphone / WhatsApp de notification : ______________",
    "Téléphone / WhatsApp de notification : {client_telephone}",
  );
  out = replaceText(out, "E-mail : _____________________________", "E-mail : {client_email}");
  out = replaceText(
    out,
    "Pièce d’identité (type et n°) : ______________",
    "Pièce d’identité (type et n°) : {client_piece}",
  );
  out = replaceText(out, "NINEA / RCCM (si société) : ____________", "NINEA / RCCM (si société) : {client_ninea_rccm}");
  out = replaceText(
    out,
    "Représenté par (si société) : _____________",
    "Représenté par (si société) : {client_representant}",
  );
  // Après le remplacement de la première occurrence, celle du client devient la première restante.
  out = replaceText(out, "Fonction : _________________________", "Fonction : {client_representant_fonction}", 1);
  // Article 3 — identification du véhicule
  out = replaceText(out, "☐ COPART   ☐ IAA   ☐ Autre", "{plateforme_cases}", 1);
  for (const [label, tag] of [
    ["N° de lot", "lot"],
    ["VIN / Châssis", "vin"],
    ["Prix d’adjudication (USD)", "prix_adjudication"],
    ["Marque / Modèle", "marque_modele"],
    ["Année", "annee"],
    ["Kilométrage", "kilometrage"],
    ["Statut du titre", "statut_titre"],
    ["Lieu d’achat", "lieu_achat"],
    ["Port prévu", "port_prevu"],
  ] as const) {
    out = fillValueCell(out, label, tag);
  }
  // Signatures
  out = replaceText(out, "Nom : ______________________________", "Nom : {usa_representant}", 1);
  out = replaceText(out, "Nom : ______________________________", "Nom : {client_signataire}", 1);
  out = replaceText(out, "Fonction / Société : _________________", "Fonction / Société : {client_signataire_fonction}");
  return out;
}

/** En-tête de page : mention « PROJET » tant que le paramètre templates.legal_validated est faux (D1). */
function tagHeader(xml: string): string {
  const end = xml.lastIndexOf("</w:p>");
  if (end < 0) throw new Error("En-tête de page sans paragraphe.");
  const run =
    '<w:r><w:rPr><w:b/><w:color w:val="C00000"/><w:sz w:val="18"/></w:rPr>' +
    '<w:t xml:space="preserve">{#projet}   —   PROJET : document non validé juridiquement{/projet}</w:t></w:r>';
  return `${xml.slice(0, end)}${run}${xml.slice(end)}`;
}

const zip = new PizZip(readFileSync(resolve(SOURCE)));
const documentXml = tagDocument(zip.file("word/document.xml")!.asText());
const headerXml = tagHeader(zip.file("word/header1.xml")!.asText());
zip.file("word/document.xml", documentXml);
zip.file("word/header1.xml", headerXml);
const output = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });

for (const path of [OUTPUT_DOCX, OUTPUT_MODULE]) mkdirSync(dirname(resolve(path)), { recursive: true });
writeFileSync(resolve(OUTPUT_DOCX), output);

// Version calculée sur le contenu balisé (le zip contient des horodatages) : stable d'une exécution à l'autre.
const version = `contrat-revise-${createHash("sha256").update(documentXml).update(headerXml).digest("hex").slice(0, 12)}`;
writeFileSync(
  resolve(OUTPUT_MODULE),
  [
    "// GÉNÉRÉ par `pnpm templates:contract` (scripts/prepare-contract-template.ts) : ne pas modifier à la main.",
    "// Modèle balisé du contrat de prestation, en base64 (embarqué : pas de système de fichiers sur Cloudflare).",
    `export const CONTRACT_TEMPLATE_VERSION = "${version}";`,
    `export const CONTRACT_TEMPLATE_BASE64 =\n  "${output.toString("base64")}";`,
    "",
  ].join("\n"),
  "utf8",
);
console.log(`✅ ${OUTPUT_DOCX} (${output.length} octets), version ${version}`);
