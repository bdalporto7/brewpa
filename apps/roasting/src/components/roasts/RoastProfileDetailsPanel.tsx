"use client";

import { useState } from "react";
import { deleteRoastProfile } from "@/lib/profile-actions";
import DeleteButton from "@/components/DeleteButton";
import Button from "@/components/ui/Button";
import RoastProfileForm from "@/components/roasts/RoastProfileForm";
import RoastProfileFavoriteToggle from "@/components/roasts/RoastProfileFavoriteToggle";
import type { RoastProfile } from "@prisma/client";

export default function RoastProfileDetailsPanel({ profile }: { profile: RoastProfile }) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <div className="rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] p-4">
        <p className="mb-3 text-sm font-medium">Edit profile</p>
        <RoastProfileForm profile={profile} onSuccess={() => setIsEditing(false)} onCancel={() => setIsEditing(false)} />
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-2.5 text-4xl font-black tracking-tight">
          {profile.name}
          <RoastProfileFavoriteToggle profileId={profile.id} isFavorite={profile.isFavorite} className="h-7 w-7" />
        </h1>
        <p className="text-sm text-muted">
          {profile.process ?? "Any process"}
          {profile.brewTarget && ` · ${profile.brewTarget}`}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
          Edit
        </Button>
        <DeleteButton
          action={deleteRoastProfile.bind(null, profile.id)}
          confirmText="Delete this profile? Roasts already started from it keep their own settings, they just lose the link."
          label="Delete"
        />
      </div>
    </div>
  );
}
