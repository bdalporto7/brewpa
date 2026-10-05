"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart-store";

export default function CartLink() {
  const count = useCart().reduce((n, l) => n + l.qty, 0);
  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `Bag, ${count} ${count === 1 ? "item" : "items"}` : "Bag, empty"}
      className="relative inline-flex rounded-md p-2 text-muted hover:text-foreground"
    >
      <ShoppingBag className="h-5 w-5" aria-hidden />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 min-w-[1.1rem] rounded-full bg-accent px-1 text-center font-mono text-[11px] font-bold leading-[1.1rem] text-accent-foreground">
          {count}
        </span>
      )}
    </Link>
  );
}
