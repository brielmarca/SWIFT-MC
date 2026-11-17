import { demoCommerceBlocked } from "@/lib/demo-commerce";
import { requireSession } from "@/lib/auth/middleware";

export const POST = async (request: Request = new Request("https://example.com")) => {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;
  return demoCommerceBlocked(request);
};
