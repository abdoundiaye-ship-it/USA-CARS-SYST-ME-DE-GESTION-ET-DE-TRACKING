import "server-only";

/**
 * Envoi des messages au client (R16, US-4.5). Lot 4a : point d'entrée unique pour le lien de connexion ;
 * le lot 4b y branche les adaptateurs réels (e-mail Brevo, WhatsApp Twilio) et le journal des notifications.
 * Sans fournisseur configuré, l'envoi est **simulé** (CLAUDE.md règle 10) : rien ne part, et le lien n'est
 * jamais écrit dans les journaux (il donne accès à l'espace du client).
 */
export async function deliverClientLoginLink(clientId: string, url: string): Promise<{ simulated: boolean }> {
  void url;
  console.info(`notifications: lien de connexion pour le client ${clientId} (envoi simulé, lot 4b)`);
  return { simulated: true };
}
