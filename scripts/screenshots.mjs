// Captures the README screenshots from the running dev server (npm run dev).
//
//   CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe" npm run screenshots
//
// Uses sample posts from made-up sources, so no real account or token is needed.
// Chrome runs headless with a temporary profile; your own profile is untouched.

import { mkdir } from "node:fs/promises";
import puppeteer from "puppeteer-core";

const BASE = process.env.DEV_URL ?? "http://localhost:5173/";
const OUT = new URL("../docs/screenshots/", import.meta.url);
const CHROME =
  process.env.CHROME_PATH ??
  {
    win32: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    linux: "/usr/bin/google-chrome",
  }[process.platform];

const SIZE = { width: 1440, height: 900 };

// Pin the clock to a friendly morning time so the welcome screen reads well.
const FAKE_NOW = "2026-10-12T09:41:00";

const SOURCES = ["Acme Engineering", "Rustacean Notes", "Web Platform Weekly", "Infra Diaries", "Pixel & Type", "The Query Planner"];

const POSTS = [
  ["Shipping a zero-downtime Postgres 19 upgrade across 400 databases", "How we planned replica promotion, rehearsed rollbacks and kept p99 latency flat while upgrading every cluster in one week.", ["postgres", "devops"], 9],
  ["Container queries finally made our design system responsive per component", "We replaced 40 breakpoint overrides with container queries and cut CSS by a third. Here is the migration checklist.", ["css", "frontend"], 6],
  ["What async Rust taught us about cancellation", "Dropping a future is a cancellation point. A tour of the bugs that caused, and the patterns that fixed them.", ["rust"], 12],
  ["The hidden cost of a 2 MB JavaScript bundle on mid-range phones", "We measured parse and compile time on five Android devices. The results changed how we budget every route.", ["performance", "javascript"], 7],
  ["Designing an API that survives its first rewrite", "Versioning, pagination and error shapes that held up after we replaced the whole backend underneath them.", ["api", "architecture"], 8],
  ["A practical guide to WebGPU compute shaders", "From a first dispatch to a 30x faster image filter, with the pitfalls we hit along the way.", ["webgpu", "graphics"], 11],
  ["SQLite in production: a year of lessons", "Write-ahead logging, backups with Litestream and the two queries that needed rethinking.", ["sqlite", "database"], 5],
  ["TypeScript 6: what changed for our monorepo", "Project references, the end of baseUrl and the three compiler flags we turned on afterwards.", ["typescript"], 6],
  ["Observability without the bill: tracing on a budget", "Sampling strategies that kept the useful traces and dropped 90% of the cost.", ["observability"], 9],
  ["Building a keyboard-first UI people actually use", "Shortcuts, focus rings and command menus: what we learned from watching 30 users.", ["ux", "accessibility"], 4],
];

const seed = (fakeNow) => {
  const now = new Date(fakeNow).getTime();
  const posts = POSTS.map(([title, summary, tags, readTime], i) => ({
    id: `demo-${i}`,
    title,
    url: `https://example.com/posts/${i}`,
    image: `https://picsum.photos/seed/devfeed${i + 3}/1200/600`,
    summary,
    type: "article",
    publishedAt: new Date(now - (i * 47 + 12) * 60_000).toISOString(),
    createdAt: new Date(now).toISOString(),
    commentsPermalink: "https://example.com/discussion",
    source: { id: `src-${i % SOURCES.length}`, name: SOURCES[i % SOURCES.length], handle: "", image: null },
    tags,
    readTime,
    numUpvotes: [184, 96, 312, 58, 141, 77, 203, 64, 39, 121][i],
    numComments: [32, 14, 57, 9, 21, 11, 40, 6, 5, 18][i],
    author: null,
  }));
  return {
    "bdd:settings": {
      token: "demo-token",
      layout: "reader",
      weatherPlace: { name: "Lisbon", detail: "Portugal", latitude: 38.72, longitude: -9.14 },
    },
    "bdd:feed": "foryou",
    'bdd:feed:{"kind":"foryou"}': { posts, cursor: null, hasNext: false, fetchedAt: now },
    "bdd:read": ["demo-3", "demo-6"],
    "bdd:profile": {
      token: "mo-token",
      at: now,
      profile: { id: "u", name: "Alex Rivera", username: "alex", image: null, permalink: "#", reputation: 1, isPlus: false, streak: null },
    },
    "bdd:favorites": [
      { id: "1", url: "https://github.com/", title: "GitHub" },
      { id: "2", url: "https://developer.mozilla.org/", title: "MDN" },
      { id: "3", url: "https://stackoverflow.com/", title: "" },
      { id: "4", url: "https://news.ycombinator.com/", title: "" },
    ],
  };
};

const fakeClock = (iso) => {
  const fixed = new Date(iso).getTime();
  const start = Date.now();
  const Real = Date;
  class FakeDate extends Real {
    constructor(...args) {
      if (args.length === 0) super(fixed + (Real.now() - start));
      else super(...args);
    }
    static now() {
      return fixed + (Real.now() - start);
    }
  }
  globalThis.Date = FakeDate;
};

const settle = async (page, ms = 1500) => {
  await page.evaluate(() => document.fonts.ready);
  // Wait for images in view to finish loading.
  await page.evaluate(() =>
    Promise.all(
      [...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; }))
    )
  );
  await new Promise((r) => setTimeout(r, ms));
};

const open = async (browser, extra = {}) => {
  const page = await browser.newPage();
  await page.setViewport(SIZE);
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en" });
  await page.evaluateOnNewDocument(fakeClock, FAKE_NOW);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  const data = { ...seed(FAKE_NOW), ...extra };
  await page.evaluate((entries) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, JSON.stringify(v));
  }, data);
  await page.reload({ waitUntil: "networkidle0" });
  await settle(page);
  return page;
};

const shot = async (page, name) => {
  await page.screenshot({ path: new URL(`${name}.png`, OUT), type: "png" });
  console.log(`saved docs/screenshots/${name}.png`);
};

const main = async () => {
  await mkdir(OUT, { recursive: true });
  // English UI regardless of the system language, so dates read "Monday, October 12".
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    // Grayscale text smoothing: sub-pixel smoothing adds colour fringes to grey text in PNGs.
    args: ["--lang=en-US", "--disable-lcd-text", "--font-render-hinting=none"],
    env: { ...process.env, LANG: "en_US.UTF-8", LANGUAGE: "en_US" },
  });
  try {
    // 1. Welcome screen: clock, weather, shortcuts.
    let page = await open(browser);
    await shot(page, "welcome");

    // 2. Reader with a post open.
    await page.keyboard.press("j");
    await settle(page);
    await shot(page, "reader");

    // 3. Command menu.
    await page.keyboard.down("Control");
    await page.keyboard.press("k");
    await page.keyboard.up("Control");
    await page.keyboard.type("rust", { delay: 40 });
    await settle(page, 600);
    await shot(page, "command-menu");
    await page.close();

    // 4. Card view.
    page = await open(browser, {
      "bdd:settings": { ...seed(FAKE_NOW)["bdd:settings"], layout: "cards" },
    });
    await shot(page, "cards");
    await page.close();

    // 5. Light mode, reader with a post open.
    page = await open(browser, { "bdd:theme": "light" });
    await page.keyboard.press("j");
    await page.keyboard.press("j");
    await settle(page);
    await shot(page, "light");

    // 6. Settings.
    await page.evaluate(() =>
      [...document.querySelectorAll("aside button")].find((b) => b.textContent?.includes("Settings"))?.click()
    );
    await settle(page, 800);
    await shot(page, "settings");
    await page.close();
  } finally {
    await browser.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
