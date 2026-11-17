import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

const AUTH_PAGES = ["/login", "/register", "/forgot-password", "/reset-password"];

test("preview hosts are noindex even with production canonical defaults", () => {
  for (const host of ["staging.swiftmc.com.br", "preview.workers.dev", "localhost"]) {
    for (const path of ["/", "/store", "/login", "/robots.txt"]) {
      assert.equal(middleware(new NextRequest(`https://${host}${path}`)).headers.get("x-robots-tag"), "noindex, nofollow");
    }
  }
  for (const host of ["swiftmc.com.br", "www.swiftmc.com.br"]) {
    assert.equal(middleware(new NextRequest(`https://${host}/`)).headers.get("x-robots-tag"), null);
  }
});

for (const page of AUTH_PAGES) {
  test(`middleware sets Cache-Control: private, no-store on GET ${page}`, () => {
    const request = new NextRequest(`https://swiftmc.example${page}`, {
      method: "GET",
      headers: { cookie: "" },
    });
    const response = middleware(request);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  });
}

test("middleware sets Cache-Control on auth page response even when CSRF cookie is already set", () => {
  const request = new NextRequest("https://swiftmc.example/login", {
    method: "GET",
    headers: { cookie: "__Host-swiftmc_csrf=existing-token" },
  });
  const response = middleware(request);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("middleware does not set Cache-Control on non-auth routes", () => {
  const request = new NextRequest("https://swiftmc.example/", {
    method: "GET",
    headers: { cookie: "" },
  });
  const response = middleware(request);
  assert.equal(response.headers.get("cache-control"), null);
});
