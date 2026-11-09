// Registration and resend rotate the same challenge through the same guarded,
// transactional handler and rate-limit bucket (switching endpoints cannot bypass it).
export { POST } from "../../register/route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
