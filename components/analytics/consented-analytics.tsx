"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { hasOptionalCookieConsent } from "@/components/privacy/cookie-preferences";
import { analyticsConfigured, analyticsWindow, ga4MeasurementId, isPublicAnalyticsPath, trackOptInEvent } from "@/lib/analytics/consent";

const CONSENT_CHANGE_EVENT = "swiftmc-cookie-preferences-changed";

function removeAnalyticsCookies() {
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim();
    if (!name || !/^_ga(?:_|$)/.test(name)) continue;
    for (const domain of ["", "; Domain=swiftmc.com.br"]) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax; Secure${domain}`;
    }
  }
}

/**
 * GA4 is disabled without NEXT_PUBLIC_GA4_MEASUREMENT_ID.
 * When configured it loads strictly AFTER an explicit analytics opt-in.
 * Revoking consent shuts it down via a reload and cleans accessible GA cookies.
 */
export function ConsentedAnalytics() {
  const pathname = usePathname();
  const loaded = useRef(false);
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!analyticsConfigured()) return;

    function reconcile() {
      if (hasOptionalCookieConsent("analytics") && isPublicAnalyticsPath(window.location.pathname)) {
        if (loaded.current) return;
        loaded.current = true;
        lastPath.current = window.location.pathname;
        const measurementId = ga4MeasurementId();
        const win = analyticsWindow();
        win.dataLayer ??= [];
        win.gtag = (...args: unknown[]) => { win.dataLayer?.push(args); };
        // Ad-related storage stays denied even for analytics opt-in.
        win.gtag("consent", "default", {
          analytics_storage: "granted",
          ad_storage: "denied",
          ad_user_data: "denied",
          ad_personalization: "denied",
        });
        win.gtag("js", new Date());
        win.gtag("config", measurementId, {
          send_page_view: true,
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
        });
        const script = document.createElement("script");
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
        script.dataset.swiftmcConsent = "analytics";
        document.head.appendChild(script);
      } else if (loaded.current) {
        analyticsWindow().gtag?.("consent", "update", {
          analytics_storage: "denied",
          ad_storage: "denied",
          ad_user_data: "denied",
          ad_personalization: "denied",
        });
        removeAnalyticsCookies();
        document.querySelectorAll('script[data-swiftmc-consent="analytics"]').forEach((script) => script.remove());
        // An already executed third-party SDK cannot safely be unloaded.
        // Reloading resets its in-memory state after consent is revoked.
        window.location.reload();
      }
    }

    reconcile();
    const onStorage = (event: StorageEvent) => {
      if (event.key === "swiftmc-cookie-preferences-v1" || event.key === null) reconcile();
    };
    window.addEventListener(CONSENT_CHANGE_EVENT, reconcile);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CONSENT_CHANGE_EVENT, reconcile);
      window.removeEventListener("storage", onStorage);
    };
  }, [pathname]);

  useEffect(() => {
    if (!pathname) return;
    if (lastPath.current === null) { lastPath.current = pathname; return; }
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      trackOptInEvent("page_view", { page_path: pathname });
    }
  }, [pathname]);

  return null;
}
