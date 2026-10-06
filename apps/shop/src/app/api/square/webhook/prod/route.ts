/**
 * The production webhook address (/api/square/webhook/prod). Same handler as the
 * sandbox one; the signature check uses whichever path was called, so each Square
 * subscription verifies against its own URL.
 */
export { POST } from "../route";
export const dynamic = "force-dynamic";
