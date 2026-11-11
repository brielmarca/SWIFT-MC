import "server-only";

export type EmailProvider = {
  sendVerificationEmail(params: {
    to: string;
    token: string;
    appUrl: string;
    existingAccount?: boolean;
  }): Promise<void>;
  sendPasswordResetEmail(params: {
    to: string;
    token: string;
    appUrl: string;
  }): Promise<void>;
  sendEmailChangeVerificationEmail(params: {
    to: string;
    token: string;
    appUrl: string;
  }): Promise<void>;
};

export type EmailServiceConfig = {
  provider: EmailProvider;
  appUrl: string;
  fromEmail: string;
};

export class EmailService {
  private readonly provider: EmailProvider;
  private readonly appUrl: string;
  private readonly fromEmail: string;

  constructor(config: EmailServiceConfig) {
    this.provider = config.provider;
    this.appUrl = config.appUrl;
    this.fromEmail = config.fromEmail;
  }

  async sendVerificationEmail(params: { to: string; token: string; existingAccount?: boolean }): Promise<void> {
    await this.provider.sendVerificationEmail({
      to: params.to,
      token: params.token,
      appUrl: this.appUrl,
      existingAccount: params.existingAccount,
    });
  }

  async sendPasswordResetEmail(params: { to: string; token: string }): Promise<void> {
    await this.provider.sendPasswordResetEmail({
      to: params.to,
      token: params.token,
      appUrl: this.appUrl,
    });
  }

  async sendEmailChangeVerificationEmail(params: { to: string; token: string }): Promise<void> {
    await this.provider.sendEmailChangeVerificationEmail({
      to: params.to,
      token: params.token,
      appUrl: this.appUrl,
    });
  }
}

const RESEND_API_URL = "https://api.resend.com/emails";

export class ResendEmailProvider implements EmailProvider {
  private readonly apiKey: string;
  private readonly fromEmail: string;

  constructor({ apiKey, fromEmail }: { apiKey: string; fromEmail: string }) {
    this.apiKey = apiKey;
    this.fromEmail = fromEmail;
  }

  private async request(params: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    const body = JSON.stringify({
      from: this.fromEmail,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    });

    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Resend API error: ${response.status} ${errorText}`);
    }
  }

  async sendVerificationEmail(params: {
    to: string;
    token: string;
    appUrl: string;
    existingAccount?: boolean;
  }): Promise<void> {
    const verifyUrl = new URL("/verify-email", params.appUrl);
    verifyUrl.searchParams.set("token", params.token);
    if (params.existingAccount) verifyUrl.searchParams.set("mode", "existing");

    await this.request({
      to: params.to,
      subject: "Verify your Swift MC account",
      html: `
        <h2>Verify your email address</h2>
        <p>Click the button below to verify your email and complete your Swift MC account registration.</p>
        <p><a href="${verifyUrl.toString()}">Verify email address</a></p>
        <p>This link expires in 10 minutes.</p>
        <p>If you did not sign up for Swift MC, you can safely ignore this email.</p>
      `,
    });
  }

  async sendPasswordResetEmail(params: {
    to: string;
    token: string;
    appUrl: string;
  }): Promise<void> {
    const resetUrl = new URL("/reset-password", params.appUrl);
    resetUrl.searchParams.set("token", params.token);

    await this.request({
      to: params.to,
      subject: "Reset your Swift MC password",
      html: `
        <h2>Reset your password</h2>
        <p>Click the button below to reset your Swift MC account password.</p>
        <p><a href="${resetUrl.toString()}">Reset password</a></p>
        <p>This link expires in 10 minutes.</p>
        <p>If you did not request a password reset, you can safely ignore this email.</p>
      `,
    });
  }

  async sendEmailChangeVerificationEmail(params: {
    to: string;
    token: string;
    appUrl: string;
  }): Promise<void> {
    const verifyUrl = new URL("/account/confirm-email", params.appUrl);
    verifyUrl.searchParams.set("token", params.token);

    await this.request({
      to: params.to,
      subject: "Confirm your new Swift MC email",
      html: `
        <h2>Confirm your new email address</h2>
        <p>Click the button below to confirm this email address for your Swift MC account.</p>
        <p><a href="${verifyUrl.toString()}">Confirm new email</a></p>
        <p>This link expires in 10 minutes.</p>
        <p>If you did not request this change, you can safely ignore this email.</p>
      `,
    });
  }
}

export function createEmailService(env: {
  RESEND_API_KEY?: string;
  APP_URL?: string;
  EMAIL_FROM?: string;
}): EmailService | null {
  const apiKey = env.RESEND_API_KEY;
  const appUrl = env.APP_URL;
  const fromEmail = env.EMAIL_FROM || "noreply@swiftmc.example";

  if (!apiKey || !appUrl) {
    return null;
  }

  try {
    new URL(appUrl);
  } catch {
    return null;
  }

  const provider = new ResendEmailProvider({ apiKey, fromEmail });
  return new EmailService({ provider, appUrl, fromEmail });
}
