// Purpose: Config - src/config/icons.ts (Shared pixel icon registry + colours)
//
// The artwork is the ReffPixels "Pixelart Generic Icons" set, shipped once per
// colour in public/images/Icons/<Colour>/<Name>_<Colour>.webp (120x120 pixel
// art, lossless WebP — see scripts/optimize-icons.mjs).
//
// Content refers to an icon by name ("Handbag", "Calendar", ...) and a THEME
// picks the colour: a blog post or project with `theme: "green"` gets the
// Green icons everywhere on its page, so the artwork matches the accent colour
// that theme paints its text and borders. Nothing in content needs to know a
// colour exists.

import fs from "node:fs";
import path from "node:path";

const ICON_DIRECTORY = "images/Icons";

/** Every colour the icon set ships in — one sub-folder each. */
export const iconColors = [
  "Black",
  "Blue",
  "Gray",
  "Green",
  "Lightblue",
  "Lightgreen",
  "Orange",
  "Pink",
  "Purple",
  "Red",
  "White",
  "Yellow",
] as const;

export type IconColor = (typeof iconColors)[number];

/**
 * Theme name → icon colour.
 *
 * Each entry matches a `--theme-{name}` in tokens.css, whose value is sampled
 * from that same colour's icon folder — so a theme's accents and its icons are
 * the same colour. A name that is missing here simply falls back to
 * `defaultIconColor`.
 */
export const themeIconColors: Record<string, IconColor> = {
  orange: "Orange",
  purple: "Purple",
  yellow: "Yellow",
  green: "Green",
  pink: "Pink",
  blue: "Blue",
  lightgreen: "Lightgreen",
  red: "Red",
  gray: "Gray",
  lightblue: "Lightblue",
  white: "White",
  black: "Black",
};

/**
 * The MODE BASE COLOURS are assigned in styles/foundation/designTokens.css:
 *
 *   --theme-main-day:   var(--theme-lightblue);
 *   --theme-main-night: var(--theme-blue);
 *
 * Both must be one of the --theme-* colours. They are the site's day and
 * night main colours, and they drive the default (unthemed) icon colour for
 * each mode — so a single line there restyles every unthemed glyph, which is
 * what the day / night switch, the contact glyph and other chrome use.
 *
 * Read from the stylesheet at build time (this module only ever runs during
 * the build), so the tokens page stays the one place to change them.
 */
const TOKENS_FILE = path.join(process.cwd(), "src/styles/foundation/designTokens.css");

const tokensSource = (() => {
  try {
    return fs.readFileSync(TOKENS_FILE, "utf8");
  } catch {
    return "";
  }
})();

/** Reads `--{token}: var(--theme-{name})` and returns `name`. */
const mainThemeName = (token: string, fallback: string): string => {
  const match = tokensSource.match(
    new RegExp(`--${token}\\s*:\\s*var\\(\\s*--theme-([a-z0-9-]+)\\s*\\)`, "i"),
  );

  return (match?.[1] ?? fallback).toLowerCase();
};

/** Day base colour name, e.g. "lightblue". */
export const dayMainTheme = mainThemeName("theme-main-day", "lightblue");

/** Night base colour name, e.g. "blue". */
export const nightMainTheme = mainThemeName("theme-main-night", "blue");

/** Used for unthemed site chrome while the site is in DAY mode. */
export const defaultIconColor: IconColor =
  themeIconColors[dayMainTheme] ?? "Lightblue";

/** The same for NIGHT mode (see components/shared/Icon.astro). */
export const defaultIconColorNight: IconColor =
  themeIconColors[nightMainTheme] ?? "Blue";

/** Icon colour for a theme name ("forest" → Green). */
export function iconColorForTheme(theme?: string): IconColor {
  if (typeof theme !== "string" || !theme.trim()) return defaultIconColor;

  return themeIconColors[theme.trim().toLowerCase()] ?? defaultIconColor;
}

/**
 * Canonical file name for every icon, WITHOUT its colour suffix: "Calendar"
 * resolves to public/images/Icons/Green/Calendar_Green.webp for the Green
 * colour.
 */
export const iconRegistry = {
  // Content icons (referenced from .md frontmatter).
  calendar: "Calendar",
  clock: "Clock",
  cloud: "Cloud",
  coffee: "Coffee",
  controller: "Controller",
  "controller-retro": "Controller Retro",
  document: "Document",
  handbag: "Handbag",
  laptop: "Laptop",
  phone: "Phone",
  radio: "Radio",

  // Site chrome — the day / night switch, social links and carousel arrows,
  // so components ask for these by meaning instead of by artwork file.
  //
  // The switch borrows the set's two SKY icons: the artwork has no sun or moon,
  // and the generated one-off glyphs that used to fill that gap were deleted.
  // `weather` is the brighter of the two, so it marks day; `cloud` marks night.
  weather: "Weather",
  cloud: "Cloud",
  contacts: "Contacts",
  email: "Email",
  internet: "Internet",
  // Directional glyphs. The names stay "arrow-*" because that is what the
  // components ask for; the artwork is the set's framed Triangle, the original
  // arrows. The generated `Arrow *` files were deleted.
  "arrow-left": "Triangle Left",
  "arrow-right": "Triangle Right",
  "arrow-up": "Triangle Up",
  "arrow-down": "Triangle Down",
} as const;

export type IconName = keyof typeof iconRegistry;

/** All valid icon names, for schema validation and error messages. */
export const iconNames = Object.keys(iconRegistry) as IconName[];

/**
 * Normalizes "Controller Retro", "controller retro" and "controller_retro"
 * to the same registry key: "controller-retro".
 */
export const normalizeIconName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");

/** True when `value` is one of the icon colour folder names. */
export const isIconColor = (value?: string): value is IconColor =>
  !!value && (iconColors as readonly string[]).includes(value);

/* Folder listings, read once per build. The artwork is saved with mixed
   capitalisation (a colour suffix is sometimes lowercase, and some names carry
   a space), so names are matched case-insensitively instead of being
   concatenated blindly: a mismatched capital used to resolve on Windows and
   404 on any case-sensitive host, which is why some icons "disappeared" only
   after deploying. */
const listingCache = new Map<string, string[]>();

const matchFile = (dir: string, wanted: string): string => {
  let entries = listingCache.get(dir);

  if (!entries) {
    try {
      entries = fs.readdirSync(path.join(process.cwd(), "public", dir));
    } catch {
      entries = [];
    }

    listingCache.set(dir, entries);
  }

  const hit = entries.find(
    (entry) => entry.toLowerCase() === wanted.toLowerCase(),
  );

  return hit ?? wanted;
};

/**
 * Resolves an icon name to a path inside public/, in the given colour.
 *
 * Returns undefined when the name is not in the registry. Inputs that already
 * look like a path or file name are passed through, so one-off artwork can
 * still be referenced directly.
 */
export const iconPath = (
  name?: string,
  color: IconColor = defaultIconColor,
): string | undefined => {
  if (!name?.trim()) return undefined;

  const trimmed = name.trim();

  if (
    trimmed.includes("/") ||
    /\.(png|jpe?g|webp|gif|svg)$/i.test(trimmed)
  ) {
    return trimmed.replace(/^\/+/, "");
  }

  const file = iconRegistry[normalizeIconName(trimmed) as IconName];

  if (!file) return undefined;

  const folder = isIconColor(color) ? color : defaultIconColor;
  const dir = `${ICON_DIRECTORY}/${folder}`;

  return `${dir}/${matchFile(dir, `${file}_${folder}.webp`)}`;
};

// ── Link icons (PixelNetIcons) ────────────────────────────────────────────
// A second artwork set: brand glyphs for links that leave the site, in
// public/images/PixelNetIcons. Of the frame styles that set is drawn in, the
// shipped folder is "round square", so the glyph carries its own framed tile
// exactly where the context calls for it: outbound brand links such as itch.io,
// YouTube or Steam read as one of the pixel buttons rather than a bare glyph.
//
// Content keeps asking for a link the usual way: a URL is enough. The brand
// is detected from the host, so `href: "https://github.com/..."` picks up the
// GitHub glyph without any frontmatter change.

export const NET_ICON_DIRECTORY = "images/PixelNetIcons/round square";

/** Brand key → file name (without .png) inside NET_ICON_DIRECTORY. */
export const netIconRegistry: Record<string, string> = {
  artstation: "artstation112",
  aseprite: "aseprite-112",
  behance: "behance112",
  bilibili: "bilibili112",
  bluesky: "bluesky112",
  deviantart: "deviantart112",
  discord: "discord112",
  facebook: "facebook112a",
  gamemaker: "GameMaker112",
  github: "github112",
  godot: "godot112",
  instagram: "instagram112",
  itch: "itch112",
  kick: "kick112",
  kofi: "kofi112",
  patreon: "patreon112",
  pinterest: "pinterest112",
  pixiv: "pixiv112",
  reddit: "reddit112a",
  steam: "steam112",
  tiktok: "tiktok112",
  twitch: "twitch-112",
  twitter: "twitter112",
  unity: "unity112",
  unreal: "Unreal112",
  vgen: "vgen112",
  vk: "vk112",
  youtube: "youtube112",
};

export type NetIconBrand = keyof typeof netIconRegistry;

/** Path inside public/ for a brand glyph, e.g. "github" → …/github112.webp. */
export const netIconPath = (brand?: string): string | undefined => {
  if (!brand?.trim()) return undefined;

  const file = netIconRegistry[brand.trim().toLowerCase()];

  if (!file) return undefined;

  return `${NET_ICON_DIRECTORY}/${matchFile(NET_ICON_DIRECTORY, `${file}.webp`)}`;
};

/** Host fragments → brand key, longest-first so sub-domains still match. */
const netDomains: [string, string][] = [
  ["steamcommunity.com", "steam"],
  ["store.steampowered.com", "steam"],
  ["unrealengine.com", "unreal"],
  ["godotengine.org", "godot"],
  ["deviantart.com", "deviantart"],
  ["artstation.com", "artstation"],
  ["behance.net", "behance"],
  ["dribbble.com", "dribbble"],
  ["instagram.com", "instagram"],
  ["pinterest.com", "pinterest"],
  ["youtube.com", "youtube"],
  ["youtu.be", "youtube"],
  ["twitch.tv", "twitch"],
  ["discord.gg", "discord"],
  ["discord.com", "discord"],
  ["github.com", "github"],
  ["gitlab.com", ""],
  ["linkedin.com", ""],
  ["pixiv.net", "pixiv"],
  ["bilibili.com", "bilibili"],
  ["patreon.com", "patreon"],
  ["ko-fi.com", "kofi"],
  ["tiktok.com", "tiktok"],
  ["twitter.com", "twitter"],
  ["bsky.app", "bluesky"],
  ["x.com", "twitter"],
  ["vk.com", "vk"],
  ["kick.com", "kick"],
  ["vgen.co", "vgen"],
  ["itch.io", "itch"],
  ["facebook.com", "facebook"],
  ["reddit.com", "reddit"],
  ["unity.com", "unity"],
  ["aseprite.org", "aseprite"],
  ["gamemaker.io", "gamemaker"],
  ["yoyogames.com", "gamemaker"],
];

/**
 * Brand glyph for an outbound URL, or undefined when the host has no glyph in
 * the set (in-site links, mailto, unknown hosts).
 */
export function netIconForUrl(url?: string): string | undefined {
  if (!url) return undefined;

  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }

  const hit = netDomains.find(
    ([domain]) => host === domain || host.endsWith(`.${domain}`),
  );

  return hit?.[1] ? netIconPath(hit[1]) : undefined;
}
