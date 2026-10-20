import { expect, test } from "@playwright/test";

test("normal builds do not expose Phase A probe routes", async ({ request }) => {
  test.skip(process.env.AUTH_RUNTIME_PROBE === "1", "Intentionally testing an isolated fixture build");
  for (const path of ["/runtime-feasibility", "/runtime-feasibility/probe?mode=crypto", "/runtime-feasibility/bindings"]) {
    expect((await request.get(path)).status()).toBe(404);
  }
});

test.describe("isolated Phase A runtime fixture", () => {
  test.skip(process.env.AUTH_RUNTIME_PROBE !== "1", "Requires generated local-only fixture build");
  test("Workers exposes non-string bindings through cloudflare:workers", async ({ request }) => {
    test.skip(process.env.TEST_RUNTIME !== "vinext", "Workers-specific binding mechanism");
    const response = await request.get("/runtime-feasibility/bindings");
    expect(response.status()).toBe(200);
    expect((await response.json()).runtimeBindingAccess).toBe(true);
    expect(await response.text()).not.toMatch(/AUTH_RATE_LIMIT_KEY|AUTH_ENCRYPTION_KEY|DISCORD_CLIENT_SECRET|connectionString/);
  });
  test("bounded crypto benchmark and primitives", async ({ request }, info) => {
    test.skip(info.project.name !== "desktop", "One bounded benchmark per runtime");
    const response = await request.get("/runtime-feasibility/probe?mode=crypto");
    expect(response.status()).toBe(200);
    const result = await response.json();
    console.log(`PHASE_A_CRYPTO ${process.env.TEST_RUNTIME ?? "next"} ${JSON.stringify(result)}`);
    expect(Object.values(result.primitives).every(Boolean)).toBe(true);
    // Unsupported baseline is evidence, not permission to reduce its cost.
    if (result.scrypt.accepted) expect(result.scrypt.verification).toBe(true);
  });

  test("cookie attributes, deletion, distinct headers and redirect", async ({ request, context }) => {
    for (const mode of ["set", "redirect", "delete"]) {
      const response = await request.get(`/runtime-feasibility/probe?mode=${mode}`, { maxRedirects: 0 });
      expect(response.headers()["cache-control"]).toBe("private, no-store");
      expect(response.status()).toBe(mode === "redirect" ? 303 : 200);
      const cookies = response.headersArray().filter((header) => header.name.toLowerCase() === "set-cookie");
      expect(cookies).toHaveLength(2);
      for (const { value } of cookies) {
        expect(value).toMatch(/; HttpOnly/i);
        expect(value).toMatch(/; Secure/i);
        expect(value).toMatch(/; SameSite=Lax/i);
        expect(value).toMatch(/; Path=\/(?:;|$)/i);
        expect(value).not.toMatch(/; Domain=/i);
      }
      const session = cookies.find(({ value }) => value.startsWith("__Host-swiftmc_session="))!.value;
      if (mode === "delete") {
        expect(session).toMatch(/Max-Age=0/i);
        expect(session).toMatch(/Expires=Thu, 01 Jan 1970/i);
      }
    }
    // Chromium treats loopback as trustworthy; inspect actual browser cookie acceptance/removal.
    await context.request.get("/runtime-feasibility/probe");
    expect((await context.cookies()).find((cookie) => cookie.name === "__Host-swiftmc_session")?.httpOnly).toBe(true);
    await context.request.get("/runtime-feasibility/probe?mode=delete");
    expect((await context.cookies()).some((cookie) => cookie.name === "__Host-swiftmc_session")).toBe(false);
  });

  test("SSR responses isolate dummy personas and disable shared caching", async ({ request }) => {
    for (const persona of ["first", "second", "first"]) {
      const response = await request.get("/runtime-feasibility", { headers: { "x-probe-persona": persona } });
      expect(response.status()).toBe(200);
      expect(response.headers()["cache-control"]).toContain("private");
      expect(response.headers()["cache-control"]).toContain("no-store");
      const body = await response.text();
      expect(body).toContain(`Dummy persona: <!-- -->${persona}`);
      expect(body).not.toContain(`Dummy persona: <!-- -->${persona === "first" ? "second" : "first"}`);
      expect(body).not.toMatch(/AUTH_RATE_LIMIT_KEY|AUTH_ENCRYPTION_KEY|DISCORD_CLIENT_SECRET/);
    }
  });

  test("Origin, Fetch Metadata and redirect prototype run in the request runtime", async ({ request }) => {
    for (const origin of [undefined, "null", "invalid", "http://swiftmc.example:8443", "https://evil.example:8443", "https://swiftmc.example", "https://swiftmc.example:8443"]) {
      const response = await request.post("/runtime-feasibility/probe?return=%2F%252fevil.example", { headers: { ...(origin ? { Origin: origin } : {}), "Sec-Fetch-Site": "same-origin" } });
      expect(await response.json()).toEqual({ exactOrigin: origin === "https://swiftmc.example:8443", fetchSite: "same-origin", returnPath: null });
    }
  });
});
