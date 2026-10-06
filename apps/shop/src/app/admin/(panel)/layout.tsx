import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { getAdminUser } from "@/lib/admin";

export const metadata: Metadata = { title: "Shop admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-border pb-4">
        <nav aria-label="Admin" className="flex items-center gap-1 text-sm font-semibold">
          <Link href="/admin/orders" className="rounded-md px-3 py-1.5 hover:bg-surface">Orders</Link>
          <Link href="/admin/settings" className="rounded-md px-3 py-1.5 hover:bg-surface">Site text</Link>
        </nav>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
          className="flex items-center gap-3 text-sm text-muted"
        >
          <span>{user.email}</span>
          <button type="submit" className="underline underline-offset-4 hover:text-foreground">Sign out</button>
        </form>
      </div>
      <div className="py-8">{children}</div>
    </div>
  );
}
