// Purpose: Config - src/config/icons.ts (Shared pixel icon registry + colours)
//
// The artwork is the ReffPixels "Pixelart Generic Icons" set, shipped once per
// colour in public/images/Icons/<Colour>/<Name>_<Colour>.png (120x120 PNGs).
//
// Content refers to an icon by name ("Handbag", "Calendar", ...) and a THEME
// picks the colour: a blog post or project with `theme: "green"` gets the
// Green icons everywhere on its page, so the artwork matches the accent colour
// that theme paints its text and borders. Nothing in content needs to know a
// colour exists.

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

/** Used for the site chrome (anywhere no theme applies). */
export const defaultIconColor: IconColor = "Blue";

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

/** Icon colour for a theme name ("forest" → Green). */
export function iconColorForTheme(theme?: string): IconColor {
  if (typeof theme !== "string" || !theme.trim()) return defaultIconColor;

  return themeIconColors[theme.trim().toLowerCase()] ?? defaultIconColor;
}

/**
 * Canonical file name for every icon, WITHOUT its colour suffix: "Calendar"
 * resolves to public/images/Icons/Green/Calendar_Green.png for the Green
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
  radio: "Radio",

  // Site chrome — the day / night switch, social links and carousel arrows,
  // so components ask for these by meaning instead of by artwork file.
  sun: "Circle",
  moon: "Circle Half",
  contacts: "Contacts",
  email: "Email",
  internet: "Internet",
  "arrow-left": "Arrow Left",
  "arrow-right": "Arrow Right",
  "arrow-up": "Arrow Up",
  "arrow-down": "Arrow Down",
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

  return `${ICON_DIRECTORY}/${folder}/${file}_${folder}.png`;
};
