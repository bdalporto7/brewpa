import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAllowedUser } from "@/lib/admin";
import { addAllowedUser } from "@/lib/admin-actions";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, SelectField } from "@/components/ui/Field";
import Card from "@/components/ui/Card";
import Checkbox from "@/components/ui/Checkbox";
import SectionHeading from "@/components/ui/SectionHeading";
import AllowedUserRow from "@/components/admin/AllowedUserRow";
import ProbeTokenSection from "@/components/admin/ProbeTokenSection";
import PageStamp from "@/components/ui/PageStamp";

export default async function AdminPage() {
  const currentUser = await getCurrentAllowedUser();
  if (!currentUser?.isAdmin) notFound();

  const [users, teams] = await Promise.all([
    prisma.allowedUser.findMany({
      orderBy: [{ isAdmin: "desc" }, { email: "asc" }],
      include: { team: true, syncTokens: { orderBy: { createdAt: "desc" } } },
    }),
    prisma.team.findMany({
      orderBy: { name: "asc" },
      include: { probeTokens: { orderBy: { createdAt: "desc" } } },
    }),
  ]);

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
          <SelectField label="Team" name="teamId" defaultValue={teams[0]?.id ?? "__new__"}>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
            <option value="__new__">+ New team</option>
          </SelectField>
          <TextField label="New team name" name="newTeamName" placeholder="Only used for + New team" />
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
              <AllowedUserRow key={user.id} user={user} teams={teams} isSelf={user.id === currentUser.id} />
            ))}
          </ul>
        </Card>
      </div>

      <div>
        <div className="mb-3">
          <SectionHeading>Probe tokens</SectionHeading>
        </div>
        <p className="mb-3 text-sm text-muted">
          Each team needs its own token for <code className="font-mono text-xs">scripts/probe_bridge.py</code> to log
          temperature readings against that team&apos;s roasts.
        </p>
        <Card interactive={false}>
          <ul className="flex flex-col divide-y divide-border px-4">
            {teams.map((team) => (
              <li key={team.id}>
                <ProbeTokenSection team={team} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
