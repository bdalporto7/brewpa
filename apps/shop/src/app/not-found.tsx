import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-4xl font-extrabold tracking-tight">That page isn&apos;t here.</h1>
      <p className="mt-3 text-muted">
        The coffee may have sold out and come off the shelf, or the link is mistyped.
      </p>
      <Link href="/shop" className="mt-6 inline-block font-semibold underline underline-offset-4">
        See what&apos;s on the shelf
      </Link>
    </div>
  );
}
