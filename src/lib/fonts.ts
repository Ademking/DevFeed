import "@fontsource-variable/dm-sans";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource-variable/ibm-plex-sans";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/literata";
import "@fontsource-variable/manrope";
import "@fontsource-variable/newsreader";
import "@fontsource-variable/outfit";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/source-serif-4";
import "@fontsource-variable/space-grotesk";
import { writeStore } from "@/lib/storage";

const SANS = "ui-sans-serif, system-ui, sans-serif";
const SERIF = "Georgia, ui-serif, serif";
const MONO = "ui-monospace, monospace";
const INTER_FEATURES = '"cv02", "cv03", "cv04", "cv11"';

export interface FontPreset {
  value: string;
  label: string;
  description: string;
  heading: string;
  body: string;
  reading: string;
  features?: string;
}

const family = (name: string, fallback: string) => `"${name}", ${fallback}`;

export const FONT_PRESETS: FontPreset[] = [
  {
    value: "modern",
    label: "Modern",
    description: "Plus Jakarta Sans and Inter",
    heading: family("Plus Jakarta Sans Variable", SANS),
    body: family("Inter Variable", SANS),
    reading: family("Inter Variable", SANS),
    features: INTER_FEATURES,
  },
  {
    value: "inter",
    label: "Inter",
    description: "Inter everywhere",
    heading: family("Inter Variable", SANS),
    body: family("Inter Variable", SANS),
    reading: family("Inter Variable", SANS),
    features: INTER_FEATURES,
  },
  {
    value: "geist",
    label: "Geist",
    description: "Vercel's Geist",
    heading: family("Geist Variable", SANS),
    body: family("Geist Variable", SANS),
    reading: family("Geist Variable", SANS),
  },
  {
    value: "grotesk",
    label: "Grotesk",
    description: "Space Grotesk and Inter",
    heading: family("Space Grotesk Variable", SANS),
    body: family("Inter Variable", SANS),
    reading: family("Inter Variable", SANS),
    features: INTER_FEATURES,
  },
  {
    value: "plex",
    label: "IBM Plex",
    description: "IBM Plex Sans",
    heading: family("IBM Plex Sans Variable", SANS),
    body: family("IBM Plex Sans Variable", SANS),
    reading: family("IBM Plex Sans Variable", SANS),
  },
  {
    value: "manrope",
    label: "Manrope",
    description: "Manrope everywhere",
    heading: family("Manrope Variable", SANS),
    body: family("Manrope Variable", SANS),
    reading: family("Manrope Variable", SANS),
  },
  {
    value: "dm",
    label: "DM Sans",
    description: "DM Sans everywhere",
    heading: family("DM Sans Variable", SANS),
    body: family("DM Sans Variable", SANS),
    reading: family("DM Sans Variable", SANS),
  },
  {
    value: "outfit",
    label: "Outfit",
    description: "Outfit and Inter",
    heading: family("Outfit Variable", SANS),
    body: family("Inter Variable", SANS),
    reading: family("Inter Variable", SANS),
    features: INTER_FEATURES,
  },
  {
    value: "editorial",
    label: "Editorial",
    description: "Newsreader serif and Inter",
    heading: family("Newsreader Variable", SERIF),
    body: family("Inter Variable", SANS),
    reading: family("Newsreader Variable", SERIF),
    features: INTER_FEATURES,
  },
  {
    value: "literata",
    label: "Literata",
    description: "Literata serif and Inter",
    heading: family("Literata Variable", SERIF),
    body: family("Inter Variable", SANS),
    reading: family("Literata Variable", SERIF),
    features: INTER_FEATURES,
  },
  {
    value: "source-serif",
    label: "Source Serif",
    description: "Source Serif 4 and IBM Plex Sans",
    heading: family("Source Serif 4 Variable", SERIF),
    body: family("IBM Plex Sans Variable", SANS),
    reading: family("Source Serif 4 Variable", SERIF),
  },
  {
    value: "terminal",
    label: "Terminal",
    description: "JetBrains Mono everywhere",
    heading: family("JetBrains Mono Variable", MONO),
    body: family("JetBrains Mono Variable", MONO),
    reading: family("JetBrains Mono Variable", MONO),
  },
];

/** JetBrains Mono everywhere. index.css mirrors it so the first paint matches. */
export const DEFAULT_FONT = "terminal";

export const getFontPreset = (value: string) =>
  FONT_PRESETS.find((p) => p.value === value) ??
  FONT_PRESETS.find((p) => p.value === DEFAULT_FONT) ??
  FONT_PRESETS[0];

const toVars = (p: FontPreset): Record<string, string> => ({
  "--app-font-heading": p.heading,
  "--app-font-sans": p.body,
  "--app-font-reading": p.reading,
  "--app-font-features": p.features ?? "normal",
});

/** Applies a preset and saves its variables so theme.js can set them before first paint. */
export const applyFontPreset = (value: string) => {
  const vars = toVars(getFontPreset(value));
  for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
  writeStore("fontVars", vars);
};
