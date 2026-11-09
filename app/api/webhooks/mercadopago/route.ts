import { purchasesDisabledResponse, purchasesEnabled } from "@/lib/purchase-gate";

export async function POST(request: Request) {
  void request;
  if (!purchasesEnabled()) return purchasesDisabledResponse();
  return Response.json(
    { error: "WEBHOOK_UNAVAILABLE", message: "Integração de pagamento ainda não está liberada neste ambiente." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
