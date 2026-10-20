import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RuntimeFeasibilityPage() {
  const requestHeaders = await headers();
  // Fixed dummy markers only, never a real identity or arbitrary reflected input.
  const marker = requestHeaders.get("x-probe-persona") === "second" ? "second" : "first";
  return <main><h1>Isolated Phase A probe</h1><p>Dummy persona: {marker}</p></main>;
}
