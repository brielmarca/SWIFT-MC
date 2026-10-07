export type MinecraftProfile = { username: string; uuid: string; avatarUrl: string };
export type ProfileResult =
  | { status: "found"; profile: MinecraftProfile }
  | { status: "invalid" | "not_found" | "unavailable" };

export function isJavaUsername(value: string): boolean {
  return value.length >= 3 && value.length <= 16 && !/[^a-zA-Z0-9_]/.test(value);
}

export function isMinecraftUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value) && value.length === 36;
}
