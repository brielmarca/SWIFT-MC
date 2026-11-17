import { SiteHeader } from "@/components/site-header";

// Copied into app/ only by the isolated browser-test runner, then removed.
export default async function HeaderFixture({ searchParams }: {
  searchParams: Promise<{ guest?: string }>;
}) {
  const { guest } = await searchParams;
  return <SiteHeader authUser={guest ? undefined : {
    id: "header-test-user", displayName: "Header Player", emailNormalized: "header@example.test", role: "USER",
  }} />;
}
