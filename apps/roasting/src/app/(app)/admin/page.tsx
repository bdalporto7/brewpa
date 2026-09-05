import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAllowedUser } from "@/lib/admin";
import { addAllowedUser } from "@/lib/admin-actions";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import Card from "@/components/ui/Card";
import Checkbox from "@/components/ui/Checkbox";
import SectionHeading from "@/components/ui/SectionHeading";
import AllowedUserRow from "@/components/admin/AllowedUserRow";
import PageStamp from "@/components/ui/PageStamp";

export default async function AdminPage() {
  const currentUser = await getCurrentAllowedUser();
  if (!currentUser?.isAdmin) notFound();

  const users = await prisma.allowedUser.findMany({
    orderBy: [{ isAdmin: "desc" }, { email: "asc" }],
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="relative">
        <PageStamp />
        <h1 className="text-4xl font-black tracking-tight">Admin</h1>
        <p className="text-sm text-muted">Who&apos;s allowed to sign in, and who can manage this list.</p>
      </div>

      <Card interactive={false} className="p-4">
        <p className="mb-3 text-sm font-medium">Admit someone</p>
        <ActionForm action={addAllowedUser} className="flex flex-wrap items-end gap-3">
          <TextField label="Email" name="email" type="email" required placeholder="friend@example.com" />
          <Checkbox name="isAdmin" label="Make admin" className="pb-1.5" />
          <Button type="submit">Admit</Button>
        </ActionForm>
      </Card>

      <div>
        <div className="mb-3">
          <SectionHeading>Allowed to sign in</SectionHeading>
        </div>
        <Card interactive={false}>
          <ul className="flex flex-col divide-y divide-border px-4">
            {users.map((user) => (
              <AllowedUserRow key={user.id} user={user} isSelf={user.id === currentUser.id} />
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
