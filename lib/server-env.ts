import "server-only";

export function getDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;

  if (!value) {
    throw new Error("DATABASE_URL is required.");
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("DATABASE_URL must use the postgresql:// or postgres:// protocol.");
  }

  return value;
}

export type MercadoPagoConfig = {
  accessToken: string;
  appUrl: URL;
};

export type MercadoPagoWebhookConfig = {
  accessToken: string;
  webhookSecret: string;
};

export function getMercadoPagoConfig(): MercadoPagoConfig {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const appUrlValue = process.env.APP_URL;

  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN is required.");
  }

  if (!appUrlValue) {
    throw new Error("APP_URL is required.");
  }

  let appUrl: URL;

  try {
    appUrl = new URL(appUrlValue);
  } catch {
    throw new Error("APP_URL must be a valid absolute URL.");
  }

  if (appUrl.protocol !== "https:" || appUrl.username || appUrl.password) {
    throw new Error("APP_URL must be a credential-free HTTPS URL.");
  }

  appUrl.pathname = "/";
  appUrl.search = "";
  appUrl.hash = "";

  return { accessToken, appUrl };
}

export function getMercadoPagoWebhookConfig(): MercadoPagoWebhookConfig {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN is required.");
  }

  if (!webhookSecret) {
    throw new Error("MERCADOPAGO_WEBHOOK_SECRET is required.");
  }

  return { accessToken, webhookSecret };
}

export type StripeConfig = {
  secretKey: string;
};

export type StripeWebhookConfig = {
  secretKey: string;
  webhookSecret: string;
};

export function getStripeConfig(): StripeConfig {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is required.");
  }

  if (!/^(sk|rk)_live_/.test(secretKey) && !/^(sk|rk)_test_/.test(secretKey)) {
    throw new Error("STRIPE_SECRET_KEY must be a valid Stripe secret key (sk_* or rk_*).");
  }

  return { secretKey };
}

export function getStripeWebhookConfig(): StripeWebhookConfig {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is required.");
  }

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is required.");
  }

  return { secretKey, webhookSecret };
}

export type MinecraftBridgeConfig = { secret: string; serverId: string; allowedServerIds: Set<string> | null };

export function getMinecraftBridgeConfig(env: Record<string, string | undefined> = process.env): MinecraftBridgeConfig | null {
  const secret = env.MINECRAFT_BRIDGE_SECRET?.trim();
  const serverId = env.MINECRAFT_BRIDGE_SERVER_ID?.trim();
  if (!secret || secret.length < 32 || !serverId) return null;
  const rawAllowed = env.MINECRAFT_BRIDGE_ALLOWED_SERVER_IDS?.trim();
  const allowedServerIds = rawAllowed ? new Set(rawAllowed.split(",").map(s => s.trim()).filter(Boolean)) : null;
  return { secret, serverId, allowedServerIds: allowedServerIds?.size ? allowedServerIds : null };
}
