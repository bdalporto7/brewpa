"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { saveCoffeePhoto } from "@/app/admin/actions";

const MAX_SIDE = 2000;

/** Shrinks a phone-sized photo to a web-sized JPEG before it leaves the browser. */
async function shrink(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("Couldn't read that photo.");
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

export default function PhotoUploader({ itemId, photoUrl, name }: { itemId: string; photoUrl: string | null; name: string }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-4">
      <div className="kraft relative h-20 w-20 shrink-0 overflow-hidden rounded-sm border-2 border-[var(--border-strong)]">
        {photoUrl ? <Image src={photoUrl} alt={`${name} photo`} fill sizes="80px" className="object-cover" /> : null}
      </div>
      <div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          id={`photo-${itemId}`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setMessage(null);
            start(async () => {
              try {
                const small = await shrink(file);
                const data = new FormData();
                data.set("photo", small);
                await saveCoffeePhoto(itemId, data);
                setMessage({ ok: true, text: "Photo saved to Square" });
              } catch (err) {
                setMessage({ ok: false, text: err instanceof Error ? err.message : "Something went wrong." });
              } finally {
                if (input.current) input.current.value = "";
              }
            });
          }}
        />
        <label
          htmlFor={`photo-${itemId}`}
          className={`inline-block cursor-pointer rounded-md border-2 border-[var(--border-strong)] bg-surface px-3 py-1.5 text-sm font-semibold ${pending ? "opacity-60" : ""}`}
        >
          {pending ? "Uploading…" : photoUrl ? "Change photo" : "Add a photo"}
        </label>
        <p className="mt-1 text-xs text-muted">Shown on the website and at the register. A square or 4:5 photo, bag in focus, works best.</p>
        {message && <p role={message.ok ? "status" : "alert"} className={`mt-1 text-sm font-semibold ${message.ok ? "" : "text-accent"}`}>{message.text}</p>}
      </div>
    </div>
  );
}
