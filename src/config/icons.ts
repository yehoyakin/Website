// Purpose: Config - src/config/icons.ts (Shared pixel icon registry)
//
// Icons live in public/images/genIcons as 120x120 pixel-art PNGs. Content
// refers to them by name ("Handbag", "Calendar", ...) instead of a file path,
// so artwork can be renamed or replaced without touching every post.

const ICON_DIRECTORY = "images/genIcons";

/** Canonical file name for every icon inside public/images/genIcons. */
export const iconRegistry = {
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

/**
 * Resolves an icon name to a path inside public/.
 *
 * Returns undefined when the name is not in the registry. Inputs that already
 * look like a path or file name are passed through, so one-off artwork can
 * still be referenced directly.
 */
export const iconPath = (name?: string): string | undefined => {
  if (!name?.trim()) return undefined;

  const trimmed = name.trim();

  if (trimmed.includes("/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(trimmed)) {
    return trimmed.replace(/^\/+/, "");
  }

  const file = iconRegistry[normalizeIconName(trimmed) as IconName];

  return file ? `${ICON_DIRECTORY}/${file}.png` : undefined;
};
