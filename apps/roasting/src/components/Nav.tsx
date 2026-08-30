import { auth } from "@/auth";
import { getCurrentAllowedUser } from "@/lib/admin";
import NavClient from "@/components/NavClient";

export default async function Nav() {
  const session = await auth();
  if (!session?.user) return null;

  const currentUser = await getCurrentAllowedUser();

  return (
    <header className="border-b border-border" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <NavClient isAdmin={!!currentUser?.isAdmin} />
    </header>
  );
}
