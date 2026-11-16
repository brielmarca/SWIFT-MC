"use client";

import { hasOptionalCookieConsent } from "@/components/privacy/cookie-preferences";

const GA4_ID_PATTERN = /^G-[A-Z0-9]{6,16}$/;
const GA4_ID = (process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID ?? "").trim();

export function analyticsConfigured(): boolean {
  return GA4_ID_PATTERN.test(GA4_ID);
}

type GtagFunction = (...args: unknown[]) => void;
type AnalyticsWindow = Window & {
  dataLayer?: unknown[][];
  gtag?: GtagFunction;
};

export function trackOptInEvent(name: string, params: Record<string, string | number | boolean> = {}): void {
  if (typeof window === "undefined" || !analyticsConfigured() || !hasOptionalCookieConsent("analytics")) return;
  if (!/^[a-z][a-z0-9_]{0,39}$/.test(name)) return;
  (window as AnalyticsWindow).gtag?.("event", name, params);
}

export function analyticsWindow(): AnalyticsWindow {
  return window as AnalyticsWindow;
}

export function ga4MeasurementId(): string {
  return analyticsConfigured() ? GA4_ID : "";
}
