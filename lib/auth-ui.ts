// UI availability. Authentication is backed by real API routes when the
// AUTH_HYPERDRIVE binding is configured on the Worker.
export const authAvailability = Object.freeze({
  state: "available",
  message: "",
} as const);

export const authRoutes = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"] as const;

export function isAuthRoute(pathname: string) {
  return authRoutes.some((route) => route === pathname.replace(/\/$/, ""));
}
