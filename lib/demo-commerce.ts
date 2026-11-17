import "server-only";
import { purchasesEnabled } from "@/lib/purchase-gate";

// Legacy name kept for route compatibility. Purchases are blocked unless
// PURCHASES_ENABLED=true, which must only be set after staging validation.
export function demoCommerceBlocked(request?: Request) {
  void request;
  if (!purchasesEnabled()) {
    return Response.json(
      {
        error: "PURCHASES_DISABLED",
        message: "Compras indisponíveis até a validação final de pagamento e entrega em homologação.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { error: "PURCHASES_DISABLED", message: "Compras ainda não estão liberadas neste ambiente." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
