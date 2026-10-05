"use client";

import { useSyncExternalStore } from "react";

/** The bag lives in this browser only (localStorage); prices are always re-read from the server. */
export interface CartLine {
  variantId: string;
  qty: number;
}

const KEY = "cybar-bag";
const MAX_QTY = 10;
const EMPTY: CartLine[] = [];
const listeners = new Set<() => void>();
let cache: CartLine[] | null = null;

function read(): CartLine[] {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(raw)
      ? raw.filter((l) => typeof l?.variantId === "string" && Number.isInteger(l?.qty) && l.qty > 0)
      : [];
  } catch {
    cache = [];
  }
  return cache as CartLine[];
}

function write(lines: CartLine[]) {
  cache = lines;
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* private mode: the bag still works for this page view */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCart(): CartLine[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function addToCart(variantId: string, qty = 1) {
  const lines = read();
  const existing = lines.find((l) => l.variantId === variantId);
  write(
    existing
      ? lines.map((l) => (l.variantId === variantId ? { ...l, qty: Math.min(MAX_QTY, l.qty + qty) } : l))
      : [...lines, { variantId, qty: Math.min(MAX_QTY, qty) }]
  );
}

export function setQty(variantId: string, qty: number) {
  write(
    qty <= 0
      ? read().filter((l) => l.variantId !== variantId)
      : read().map((l) => (l.variantId === variantId ? { ...l, qty: Math.min(MAX_QTY, qty) } : l))
  );
}

export function clearCart() {
  write([]);
}
