const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export const MOD_KEY = isMac ? "⌘" : "Ctrl";

export const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: [MOD_KEY, "K"], label: "Command menu: search the web, jump anywhere" },
  { keys: ["/"], label: "Command menu" },
  { keys: ["J"], label: "Next post" },
  { keys: ["K"], label: "Previous post" },
  { keys: ["O"], label: "Open article" },
  { keys: ["B"], label: "Bookmark" },
  { keys: ["C"], label: "Load comments" },
  { keys: ["U"], label: "Show only unread posts" },
  { keys: ["-", "+"], label: "Smaller / larger text" },
  { keys: ["0"], label: "Reset text size" },
  { keys: ["R"], label: "Refresh feed" },
  { keys: ["?"], label: "Show all shortcuts" },
];
