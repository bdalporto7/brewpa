export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <picture>
        <source srcSet="/cybar-mark-dark.png" media="(prefers-color-scheme: dark)" />
        <img
          src="/cybar-mark.png"
          alt="Loading"
          className="h-10 w-auto animate-spin"
          style={{ animationDuration: "1.4s" }}
        />
      </picture>
    </div>
  );
}
