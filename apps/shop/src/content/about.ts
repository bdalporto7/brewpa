/**
 * Fallback About copy, used until the team writes their own in the admin's
 * Site text page (About fields). Only things the founders told us themselves.
 */
export const ABOUT_FALLBACK = {
  intro: "Cybar is two high school friends who got way too into coffee.",
  blocks: [
    { kind: "heading" as const, text: "How it started" },
    {
      kind: "paragraph" as const,
      text: "We're Brandon and Karan. It began simply: trying new cafes around the city and chasing new flavors. Then it got out of hand. We fell for processing methods and varietals, started recognizing roasters by taste, and coffee went from part of the morning routine to the whole personality.",
    },
    {
      kind: "paragraph" as const,
      text: "Soon we were nerding out on brewing at home and hosting friends for a \"Coffee Omakase,\" where we pour what we're excited about and see what people think. Eventually we decided to share our passion with the world. That's Cybar.",
    },
    { kind: "heading" as const, text: "Why we roast" },
    {
      kind: "paragraph" as const,
      text: "We'd had so much great coffee from roasters around the world that the next question was obvious: could we make some? It turns out you learn very quickly how much you don't know. We write down every roast (we're nerds about it), and we're still learning. We don't plan to stop.",
    },
    { kind: "heading" as const, text: "Where to find us" },
    {
      kind: "paragraph" as const,
      text: "We do pop-ups around the Bay Area. Follow us on Instagram to see where we'll be next.",
    },
  ],
};
