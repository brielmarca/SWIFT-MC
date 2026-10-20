import { NextResponse } from "next/server";
import { cryptoProbe } from "@/lib/auth-feasibility/crypto";
import { hasExactOrigin, internalReturnPath } from "@/lib/auth-feasibility/security";

export const dynamic = "force-dynamic";
const attributes = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };
const trustedOrigin = "https://swiftmc.example:8443"; // Isolated server fixture configuration.

export async function POST(request: Request) {
  return Response.json({ exactOrigin: hasExactOrigin(request.headers, trustedOrigin), fetchSite: request.headers.get("sec-fetch-site"), returnPath: internalReturnPath(new URL(request.url).searchParams.get("return") ?? "/account") }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");
  if (mode === "crypto") return Response.json(await cryptoProbe(), { headers: { "Cache-Control": "private, no-store" } });
  const response = mode === "redirect" ? NextResponse.redirect(new URL("/runtime-feasibility", url), 303) : NextResponse.json({ dummy: true });
  response.headers.set("Cache-Control", "private, no-store");
  response.cookies.set("__Host-swiftmc_session", mode === "delete" ? "" : "phase-a-dummy", {
    ...attributes, ...(mode === "delete" ? { maxAge: 0, expires: new Date(0) } : {}),
  });
  response.cookies.set("__Host-swiftmc_probe", "dummy-secondary", attributes);
  return response;
}
