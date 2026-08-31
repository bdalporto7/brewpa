/** Same light/dark mascot-mark pair NavClient/AiSuggestionPanel use — dances
 * (mascot-dance, globals.css) while a suggestion is being generated. Shared
 * so every "this is Cybar's AI" moment (the suggestion panel, its feedback
 * card) uses the same mark instead of a generic icon. */
export default function CybarMark({ dancing = false, className }: { dancing?: boolean; className: string }) {
  return (
    <picture>
      <source srcSet="/cybar-mark-dark.png" media="(prefers-color-scheme: dark)" />
      <img src="/cybar-mark.png" alt="" className={`${className} ${dancing ? "mascot-dance" : ""}`} />
    </picture>
  );
}
