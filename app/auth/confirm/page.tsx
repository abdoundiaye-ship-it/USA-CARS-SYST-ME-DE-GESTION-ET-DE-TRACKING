import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Alert } from "@/components/ui/feedback";
import { ConfirmLinkForm } from "./confirm-form";

export const metadata: Metadata = { title: "Accès à votre compte", robots: { index: false, follow: false } };

/**
 * Lien reçu par e-mail ou WhatsApp (invitation, lien d’accès, réinitialisation du mot de passe). L’ouverture de la
 * page ne valide rien : la session s’ouvre au clic sur le bouton, pour que l’aperçu automatique du lien par WhatsApp
 * ou par une messagerie ne consomme pas ce lien à usage unique. Le paramètre `next` éventuel est ignoré : la
 * destination (choix du mot de passe) est fixée par l’action serveur.
 */
export default async function ConfirmLinkPage({ searchParams }: PageProps<"/auth/confirm">) {
  const params = await searchParams;
  const value = (name: string) => (typeof params[name] === "string" ? params[name] : "");
  const fields = { token_hash: value("token_hash"), type: value("type"), code: value("code") };
  const usable = (fields.token_hash !== "" && fields.type !== "") || fields.code !== "";

  return (
    <AuthShell
      title="Accès à votre compte"
      description="Ce lien personnel ne fonctionne qu’une fois et expire rapidement."
    >
      <div className="flex flex-col gap-4">
        {usable ? (
          <ConfirmLinkForm fields={fields} label="Continuer et choisir mon mot de passe" />
        ) : (
          <Alert tone="danger">
            Ce lien est incomplet. Demandez un nouveau lien à l’administrateur, ou utilisez « Mot de passe oublié ».
          </Alert>
        )}
        <Link href="/connexion" className="text-primary text-sm underline underline-offset-2">
          Retour à la connexion
        </Link>
      </div>
    </AuthShell>
  );
}
