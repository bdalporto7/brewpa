import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAllowedUser } from "@/lib/admin";
import { addAllowedUser } from "@/lib/admin-actions";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import AllowedUserRow from "@/components/admin/AllowedUserRow";

export default async function AdminPage() {
  const currentUser = await getCurrentAllowedUser();
  if (!currentUser?.isAdmin) notFound();

  const users = await prisma.allowedUser.findMany({
    orderBy: [{ isAdmin: "desc" }, { email: "asc" }],
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="text-sm text-muted">Who&apos;s allowed to sign in, and who can manage this list.</p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-medium">Admit someone</p>
        <ActionForm action={addAllowedUser} className="flex flex-wrap items-end gap-3">
          <TextField label="Email" name="email" type="email" required placeholder="friend@example.com" />
          <label className="flex items-center gap-1.5 pb-1.5 text-xs text-muted">
            <input type="checkbox" name="isAdmin" className="accent-accent" />
            Make admin
          </label>
          <Button type="submit">Admit</Button>
        </ActionForm>
      </div>

      <div>
        <h2 className="mb-3 font-medium">Allowed to sign in</h2>
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface px-4">
          {users.map((user) => (
            <AllowedUserRow key={user.id} user={user} isSelf={user.id === currentUser.id} />
          ))}
        </ul>
      </div>
    </div>
  );
}
