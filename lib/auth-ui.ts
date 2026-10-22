// UI availability only. No environment flag can enable authentication here.
export const authAvailability = Object.freeze({
  state: "unavailable",
  message: "Autenticação ainda não disponível.",
} as const);

export const authRoutes = ["/login", "/register", "/forgot-password", "/reset-password"] as const;

export function isAuthRoute(pathname: string) {
  return authRoutes.some((route) => route === pathname.replace(/\/$/, ""));
}
