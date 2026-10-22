import "server-only";

export const PUBLIC_AUTH_ERRORS = Object.freeze({
  LOGIN_FAILED: Object.freeze({ code: "LOGIN_FAILED", message: "Email ou senha inválidos." }),
  REQUEST_FAILED: Object.freeze({ code: "REQUEST_FAILED", message: "Não foi possível concluir a solicitação." }),
  INVALID_CHALLENGE: Object.freeze({ code: "INVALID_CHALLENGE", message: "Link inválido ou expirado." }),
});

/** Deliberately takes no internal error/reason: account, provider and DB details cannot be reflected. */
export function publicLoginFailure() {
  return PUBLIC_AUTH_ERRORS.LOGIN_FAILED;
}

/** Same response whether the email exists, is suspended, or has no password identity. */
export const PUBLIC_EMAIL_CHALLENGE_ACK = "Se for possível, enviaremos as instruções para o email informado.";
