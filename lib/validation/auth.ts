import { z } from "zod";
import { emailField } from "./common";

export const PASSWORD_MIN_LENGTH = 12;

export const signInSchema = z.object({
  email: emailField(),
  password: z.string().min(1, "Saisissez votre mot de passe."),
  suite: z.string().optional(),
});

export const mfaCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Le code comporte 6 chiffres, affichés dans votre application d’authentification."),
  factorId: z.string().optional(),
  suite: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: emailField(),
});

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Le mot de passe doit comporter au moins ${PASSWORD_MIN_LENGTH} caractères.`)
      .regex(/[a-z]/, "Ajoutez au moins une lettre minuscule.")
      .regex(/[A-Z]/, "Ajoutez au moins une lettre majuscule.")
      .regex(/\d/, "Ajoutez au moins un chiffre."),
    confirmation: z.string(),
  })
  .refine((v) => v.password === v.confirmation, {
    path: ["confirmation"],
    message: "Les deux mots de passe ne sont pas identiques.",
  });
