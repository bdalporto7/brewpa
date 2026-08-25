"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import StartDropForm from "@/components/friends/StartDropForm";
import type { Bean } from "@prisma/client";

export default function StartDropToggle({ beans, lockedBeanId }: { beans: Bean[]; lockedBeanId?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setIsOpen(true)}>
        + Start a drop
      </Button>
    );
  }

  return <StartDropForm beans={beans} lockedBeanId={lockedBeanId} onSuccess={() => setIsOpen(false)} />;
}
