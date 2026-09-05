"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import CreateDropForm from "@/components/drops/CreateDropForm";
import type { Bean } from "@prisma/client";

export default function CreateDropToggle({ beans }: { beans: Bean[] }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setIsOpen(true)}>
        + Open a drop
      </Button>
    );
  }

  return <CreateDropForm beans={beans} />;
}
