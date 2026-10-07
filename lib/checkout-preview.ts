import { z } from "zod";
import { isJavaUsername } from "./minecraft-profile";

export function validateCheckoutPreview(username: string, email: string) {
  return {
    username: isJavaUsername(username) ? "" : "Use de 3 a 16 caracteres: letras, números ou sublinhado (_).",
    email: email.length <= 254 && z.email().safeParse(email.trim()).success ? "" : "Informe um e-mail válido.",
  };
}
