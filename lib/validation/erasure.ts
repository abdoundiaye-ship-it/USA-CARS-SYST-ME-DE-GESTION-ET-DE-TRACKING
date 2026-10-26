import { z } from "zod";

/** Validation des formulaires d'anonymisation des dossiers (G2-c/G2-d, contrat art. 33). */

export const requestErasureSchema = z.object({
  dossierId: z.uuid("Dossier inconnu."),
  reason: z
    .string()
    .trim()
    .min(3, "Indiquez le motif de l’anonymisation (au moins 3 caractères).")
    .max(1000, "1000 caractères au maximum."),
});

export const erasureIdSchema = z.object({ erasureId: z.uuid("Demande inconnue.") });

export const cancelErasureSchema = z.object({
  erasureId: z.uuid("Demande inconnue."),
  reason: z
    .string()
    .trim()
    .min(3, "Indiquez le motif de l’annulation (au moins 3 caractères).")
    .max(1000, "1000 caractères au maximum."),
});
