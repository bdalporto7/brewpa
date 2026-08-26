export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <div
        className="flex items-center justify-center rounded-full border-4 border-accent p-3 animate-spin"
        style={{ animationDuration: "1.4s" }}
      >
        <picture>
          <source srcSet="/cybar-mark-dark.png" media="(prefers-color-scheme: dark)" />
          <img src="/cybar-mark.png" alt="Loading" className="h-8 w-auto" />
        </picture>
      </div>
    </div>
  );
}
