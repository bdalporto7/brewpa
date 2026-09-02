/** Same light/dark mascot-mark pair NavClient/AiSuggestionPanel use — dances
 * (mascot-dance, globals.css) while a suggestion is being generated. Shared
 * so every "this is Cybar's AI" moment (the suggestion panel, its feedback
 * card) uses the same mark instead of a generic icon. `alt` defaults to ""
 * (decorative) since most callers pair the mark with its own visible text
 * label right next to it — pass a real `alt` for a caller where the mark
 * is the only label (e.g. a loading spinner with no adjacent text). */
export default function CybarMark({
  dancing = false,
  className,
  alt = "",
}: {
  dancing?: boolean;
  className: string;
  alt?: string;
}) {
  return (
    <picture>
      <source srcSet="/cybar-mark-dark.png" media="(prefers-color-scheme: dark)" />
      <img src="/cybar-mark.png" alt={alt} className={`${className} ${dancing ? "mascot-dance" : ""}`} />
    </picture>
  );
}
