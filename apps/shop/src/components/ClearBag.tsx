"use client";

import { useEffect } from "react";
import { clearCart } from "@/lib/cart-store";

/** Empties the bag once an order exists, so going back doesn't re-offer it. */
export default function ClearBag() {
  useEffect(() => clearCart(), []);
  return null;
}
