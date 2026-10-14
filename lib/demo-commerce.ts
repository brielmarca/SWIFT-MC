import "server-only";

// Deliberately unconditional: credentials or environment flags cannot enable payments.
export function demoCommerceBlocked(request?: Request) {
  // Do not read the body, credentials, or database configuration.
  void request;
  return Response.json(
    { error: "DEMO_ONLY", message: "Pedidos e pagamentos reais estão desativados." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
