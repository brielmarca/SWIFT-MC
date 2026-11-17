import { z } from "zod";
export const PRIVACY_REQUEST_KINDS = ["ACCESS", "CORRECTION", "DELETION", "PORTABILITY", "CONSENT", "OTHER"] as const;
export type PrivacyRequestKind = typeof PRIVACY_REQUEST_KINDS[number];
export const privacyRequestInputSchema = z.object({
  kind: z.enum(PRIVACY_REQUEST_KINDS),
  details: z.string().trim().min(1).max(800).optional(),
}).strict();
export const PRIVACY_REQUEST_LABELS: Record<PrivacyRequestKind, string> = {
  ACCESS: "Acesso aos meus dados", CORRECTION: "Correção de dados", DELETION: "Exclusão de dados",
  PORTABILITY: "Portabilidade (quando aplicável)", CONSENT: "Revogação de consentimento", OTHER: "Outra solicitação de privacidade",
};
