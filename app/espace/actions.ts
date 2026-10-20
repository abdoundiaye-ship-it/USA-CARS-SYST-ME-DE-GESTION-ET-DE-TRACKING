"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getClientAccess } from "@/lib/auth/access";
import { failure, formObject, invalid, success, type FormState } from "@/lib/forms";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** R15 / US-4.2 / US-4.4 : décision du client dans le portail, sur la version affichée du document. */
const portalDecisionSchema = z
  .object({
    dossierId: z.uuid("Dossier inconnu."),
    subject: z.enum(["quote", "extra_cost"], "Document inconnu."),
    subjectId: z.uuid("Document inconnu."),
    sha256: z.string().regex(/^[0-9a-f]{64}$/, "Version du document inconnue."),
    decision: z.enum(["accepted", "refused"], "Indiquez votre décision."),
    insuranceChoice: z.enum(["accepted", "refused"]).optional(),
    consent: z.literal("on", "Cochez la case pour confirmer votre décision."),
  })
  .refine((v) => v.subject !== "quote" || v.decision !== "accepted" || v.insuranceChoice !== undefined, {
    path: ["insuranceChoice"],
    message: "Indiquez si vous souhaitez l’assurance transport (option C).",
  });

/** Identifiant de la session de connexion (preuve R15), lu dans le jeton d'accès. */
async function sessionId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString("utf8")) as {
      session_id?: string;
    };
    return payload.session_id ?? null;
  } catch {
    return null;
  }
}

/** Adresse IP du client (proxy Cloudflare, puis en-têtes standard). */
async function clientIp(): Promise<string | null> {
  const h = await headers();
  const raw = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip");
  const ip = raw?.trim() ?? "";
  return /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : null;
}

export async function decideInPortal(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await getClientAccess())) return failure("Votre session a expiré : reconnectez-vous.");
  const parsed = portalDecisionSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const session = await sessionId();
  if (!session) return failure("Votre session a expiré : reconnectez-vous.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("accept_in_portal", {
    p_subject: v.subject,
    p_subject_id: v.subjectId,
    p_decision: v.decision,
    p_document_sha256: v.sha256,
    p_session: session,
    p_ip: await clientIp(),
    p_insurance_choice: v.subject === "quote" && v.decision === "accepted" ? (v.insuranceChoice ?? null) : null,
  });
  if (error) {
    return failure(
      error.code === "22023" || error.code === "42501" ? error.message : "Votre décision n’a pas pu être enregistrée.",
    );
  }
  revalidatePath(`/espace/dossiers/${v.dossierId}` as Route);
  revalidatePath("/espace");
  return success(v.decision === "accepted" ? "Merci : votre accord est enregistré." : "Votre refus est enregistré.");
}
