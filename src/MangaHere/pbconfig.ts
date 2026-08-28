import { ContentRating, SourceIntents } from "@paperback/types";

export const MangaHereConfig = {
  version: "1.0.0-alpha.5",
  name: "MangaHere",
  icon: "icon.png",
  description: "MangaHere source for Paperback 0.9 with legacy 0.8 library ID compatibility.",
  contentRating: ContentRating.MATURE,
  developers: [{ name: "indigoxred", github: "https://github.com/indigoxred" }],
  language: "en",
  badges: [{ label: "English", textColor: "#FFFFFF", backgroundColor: "#2563EB" }],
  capabilities: [
    SourceIntents.SEARCH_RESULT_PROVIDING,
    SourceIntents.CHAPTER_PROVIDING,
    SourceIntents.DISCOVER_SECTION_PROVIDING,
    SourceIntents.CLOUDFLARE_BYPASS_PROVIDING,
  ],
} as const;

export default MangaHereConfig;
