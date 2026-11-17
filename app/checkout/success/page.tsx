import { redirect } from "next/navigation";

// Legacy demo success URL. Real payment status lives on the order page.
export default function LegacyCheckoutSuccessPage() {
  redirect("/account/orders");
}
