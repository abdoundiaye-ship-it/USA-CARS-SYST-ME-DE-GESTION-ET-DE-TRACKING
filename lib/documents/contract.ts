import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { formatDate, formatInteger } from "@/lib/format";
import { ID_DOCUMENT_LABELS } from "@/lib/dossiers/labels";
import type { AuctionPlatform, ClientRow, DossierRow } from "@/lib/supabase/database.types";
import { CONTRACT_TEMPLATE_BASE64, CONTRACT_TEMPLATE_VERSION } from "./contract-template.generated";

/** Contrat de prestation d'un dossier (US-2.2, règle R14) : modèle templates/contrat_prestation.docx. */

export { CONTRACT_TEMPLATE_VERSION };

/** Espace réservé imprimé à la place d'une information encore inconnue (à compléter à la main). */
export const BLANK = "____________";

/** Identité légale de USA CARS : paramètres company.* (valeur « À compléter » tant qu'ils ne sont pas saisis). */
export interface CompanyIdentity {
  legalForm: string;
  rccm: string;
  ninea: string;
  officeAddress: string;
  phone: string;
  email: string;
  representativeName: string;
  representativeTitle: string;
}

export const COMPANY_SETTING_KEYS: Record<keyof CompanyIdentity, string> = {
  legalForm: "company.legal_form",
  rccm: "company.rccm",
  ninea: "company.ninea",
  officeAddress: "company.office_address",
  phone: "company.phone",
  email: "company.email",
  representativeName: "company.representative_name",
  representativeTitle: "company.representative_title",
};

export interface ContractInput {
  reference: string;
  date: Date;
  /** Paramètre templates.legal_validated : tant qu'il est faux, le document porte la mention « PROJET » (D1). */
  legalValidated: boolean;
  company: CompanyIdentity;
  client: Pick<
    ClientRow,
    | "kind"
    | "name"
    | "address"
    | "notify_phone"
    | "notify_email"
    | "id_document_type"
    | "id_document_number"
    | "ninea"
    | "rccm"
    | "representative_name"
    | "representative_title"
  >;
  dossier: Pick<
    DossierRow,
    | "reference"
    | "platform"
    | "lot_number"
    | "vin"
    | "make"
    | "model"
    | "model_year"
    | "mileage"
    | "title_status"
    | "purchase_location"
    | "departure_port"
  >;
}

const text = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return BLANK;
  const trimmed = String(value).trim();
  return trimmed === "" ? BLANK : trimmed;
};

/** Cases de l'article 3 : « ☒ COPART   ☐ IAA   ☐ Autre ». */
export function platformBoxes(platform: AuctionPlatform | null): string {
  const box = (value: AuctionPlatform) => (platform === value ? "☒" : "☐");
  return `${box("copart")} COPART   ${box("iaa")} IAA   ${box("other")} Autre`;
}

/** Données du modèle (balises `{…}` de templates/contrat_prestation.docx). */
export function buildContractData(input: ContractInput): Record<string, string | boolean> {
  const { client, dossier, company } = input;
  const isCompany = client.kind === "company";
  const piece =
    client.id_document_type && client.id_document_number
      ? `${ID_DOCUMENT_LABELS[client.id_document_type]} n° ${client.id_document_number}`
      : null;
  const nineaRccm = [client.ninea && `NINEA ${client.ninea}`, client.rccm && `RCCM ${client.rccm}`]
    .filter(Boolean)
    .join(" · ");
  const makeModel = [dossier.make, dossier.model].filter((v) => v && v.trim()).join(" ");

  return {
    projet: !input.legalValidated,
    contrat_reference: input.reference,
    dossier_reference: dossier.reference,
    date_contrat: formatDate(input.date),
    usa_forme_juridique: text(company.legalForm),
    usa_rccm: text(company.rccm),
    usa_ninea: text(company.ninea),
    usa_bureau: text(company.officeAddress),
    usa_telephone: text(company.phone),
    usa_email: text(company.email),
    usa_representant: text(company.representativeName),
    usa_representant_fonction: text(company.representativeTitle),
    client_nom: text(client.name),
    client_adresse: text(client.address),
    client_telephone: text(client.notify_phone),
    client_email: text(client.notify_email),
    client_piece: text(piece),
    client_ninea_rccm: isCompany ? text(nineaRccm) : "Sans objet",
    client_representant: isCompany ? text(client.representative_name) : "Sans objet",
    client_representant_fonction: isCompany ? text(client.representative_title) : "Sans objet",
    client_signataire: text(isCompany ? client.representative_name : client.name),
    client_signataire_fonction: isCompany ? text(client.representative_title ?? client.name) : "Client",
    plateforme_cases: platformBoxes(dossier.platform),
    lot: text(dossier.lot_number),
    vin: text(dossier.vin),
    prix_adjudication: BLANK, // connu après l'enchère (lot 2b)
    marque_modele: text(makeModel),
    annee: text(dossier.model_year),
    kilometrage: dossier.mileage === null ? BLANK : `${formatInteger(dossier.mileage)} miles`,
    statut_titre: text(dossier.title_status),
    lieu_achat: text(dossier.purchase_location),
    port_prevu: text(dossier.departure_port),
  };
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Remplit le modèle ; une balise sans valeur fait échouer la génération (jamais de « undefined » imprimé). */
export function renderContract(input: ContractInput): Uint8Array {
  const zip = new PizZip(base64ToBytes(CONTRACT_TEMPLATE_BASE64));
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: (part) => {
      throw new Error(`Balise sans valeur dans le modèle du contrat : ${part.value}`);
    },
  });
  doc.render(buildContractData(input));
  return doc.getZip().generate({ type: "uint8array", compression: "DEFLATE" });
}

/** Empreinte SHA-256 (hexadécimal) d'un fichier — version figée d'un document accepté (R15). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
