/** Display helpers for leads (server-safe, no imports needed client-side). */

export function followUpLabel(date: Date | null, now = new Date()): { text: string; overdue: boolean } | null {
  if (!date) return null;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - startOfToday) / 86400000);
  if (diffDays < 0) return { text: `${-diffDays}d overdue`, overdue: true };
  if (diffDays === 0) return { text: "Follow up today", overdue: false };
  if (diffDays === 1) return { text: "Follow up tomorrow", overdue: false };
  return {
    text: `Follow up ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    overdue: false,
  };
}

export function relativeDay(date: Date, now = new Date()): string {
  const days = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
