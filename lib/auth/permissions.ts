import "server-only";

export const AUTH_ROLES = Object.freeze(["USER", "SUPPORT", "MODERATOR", "ADMIN", "OWNER"] as const);
export type AuthRole = typeof AUTH_ROLES[number];
export const AUTH_PERMISSIONS = Object.freeze([
  "account:manage-self", "support:read", "support:respond", "moderation:read", "moderation:act",
  "audit:read", "sessions:revoke-other", "roles:manage", "security:configure",
] as const);
export type AuthPermission = typeof AUTH_PERMISSIONS[number];

export const ROLE_PERMISSIONS: Readonly<Record<AuthRole, readonly AuthPermission[]>> = Object.freeze({
  USER: Object.freeze(["account:manage-self"] as const),
  SUPPORT: Object.freeze(["account:manage-self", "support:read", "support:respond"] as const),
  MODERATOR: Object.freeze(["account:manage-self", "moderation:read", "moderation:act"] as const),
  ADMIN: Object.freeze(["account:manage-self", "support:read", "support:respond", "moderation:read", "moderation:act", "audit:read", "sessions:revoke-other"] as const),
  OWNER: Object.freeze(["account:manage-self", "support:read", "support:respond", "moderation:read", "moderation:act", "audit:read", "sessions:revoke-other", "roles:manage", "security:configure"] as const),
});

/** Website roles only, assigned by trusted administration. Never derive from Minecraft ranks.
 * This checks a capability, not account status, session validity or resource ownership.
 */
export function hasPermission(role: string, permission: AuthPermission): boolean {
  return Object.hasOwn(ROLE_PERMISSIONS, role) && ROLE_PERMISSIONS[role as AuthRole].includes(permission);
}

export function isStaffRole(role: string): boolean {
  return role === "SUPPORT" || role === "MODERATOR" || role === "ADMIN" || role === "OWNER";
}
