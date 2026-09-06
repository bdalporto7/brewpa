import { requireUser } from "@/lib/admin";
import PairingConfirm from "@/components/PairingConfirm";

/**
 * Reached only two ways: a desktop install's "Sign in to sync" opening
 * this in the system browser (with real state/label params), or a person
 * typing/bookmarking the bare URL (no state — PairingConfirm just has
 * nothing to hand back to in that case, see its own guard). The proxy
 * gates this like any other page — an unauthenticated visit bounces to
 * /login and back (see that page's callbackUrl handling) — so by the time
 * this renders, requireUser() below is guaranteed to succeed.
 */
export default async function DesktopPairPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; label?: string }>;
}) {
  const { state, label } = await searchParams;
  const user = await requireUser();

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-6 pt-24 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- static local asset, next/image's optimizer fails to decode this specific file */}
      <img src="/cybar-stamp.png" alt="Cybar Coffee" className="w-40" />
      <PairingConfirm state={state} label={label} email={user.email} teamName={user.team.name} />
    </div>
  );
}
