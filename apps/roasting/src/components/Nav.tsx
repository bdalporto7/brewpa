import { auth } from "@/auth";
import { getCurrentAllowedUser } from "@/lib/admin";
import NavClient from "@/components/NavClient";

export default async function Nav() {
  const session = await auth();
  if (!session?.user) return null;

  const currentUser = await getCurrentAllowedUser();

  return (
    <header className="bg-panel-bg" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <NavClient isAdmin={!!currentUser?.isAdmin} />
      {/* Torn-cardboard seam into the page below, instead of a straight
          border — same clip-path zigzag technique as DecoratedEmptyState's
          dashed border, just cut from the panel's own dark fill so the
          page's cream background shows through the notches. */}
      <div
        aria-hidden="true"
        className="h-2.5 bg-panel-bg sm:h-3"
        style={{
          clipPath:
            "polygon(0 0,100% 0,100% 45%,96% 100%,92% 42%,88% 100%,84% 42%,80% 100%,76% 42%,72% 100%,68% 42%,64% 100%,60% 42%,56% 100%,52% 42%,48% 100%,44% 42%,40% 100%,36% 42%,32% 100%,28% 42%,24% 100%,20% 42%,16% 100%,12% 42%,8% 100%,4% 42%,0 100%)",
        }}
      />
    </header>
  );
}
