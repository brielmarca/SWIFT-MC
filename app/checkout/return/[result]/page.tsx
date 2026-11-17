import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Footer } from "@/components/footer";
import { AuthHeader } from "@/components/auth-header";
import { CheckoutReturn } from "@/components/checkout-return";
import { requireAuthPage } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Status do pagamento | Swift MC", robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";

const ORDER_NUMBER_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export default async function CheckoutReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ result: string }>;
  searchParams: Promise<{ order?: string | string[] }>;
}) {
  const { result } = await params;
  if (result !== "success" && result !== "cancel") notFound();

  const cookieHeader = (await headers()).get("cookie");
  await requireAuthPage(cookieHeader, `/checkout/return/${result}`);

  const order = (await searchParams).order;
  const orderNumber = typeof order === "string" && ORDER_NUMBER_PATTERN.test(order) ? order : null;

  return (
    <>
      <AuthHeader />
      <main id="main-content" className="site-container min-h-[75vh] py-20">
        <CheckoutReturn result={result} orderNumber={orderNumber} />
      </main>
      <Footer />
    </>
  );
}
