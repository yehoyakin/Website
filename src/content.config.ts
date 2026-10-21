import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

import { iconPath, iconRegistry } from "./config/icons";

const blog = defineCollection({
  loader: glob({
    pattern: "**/*.{md,mdx}",
    base: "./src/content/blog",
  }),

  schema: z.object({
    title: z.string(),
    theme: z.string(),
    description: z.string(),
    date: z.coerce.date(), // IMPORTANT FIX
    cardBackground: z.string().optional(),

    background: z.string().optional(),

    backgroundBlur: z.number().optional().default(0),
    backgroundOpacity: z.number().optional().default(1),
    backgroundParallax: z.number().optional().default(0.2),

    scenes: z
      .array(
        z.object({
          image: z.string(),
          align: z.enum(["left", "right", "center"]).optional(),
          size: z.enum(["auto", "16:9", "4:3"]).optional(),
          caption: z.string().optional(),
        }),
      )
      .optional(),

    // Placement comes from [video[x]] markers inside the body.
    // `src` accepts a YouTube/Vimeo link, a direct video file URL, or a
    // path inside public/ (same asset() handling as scenes).
    videos: z
      .array(
        z.object({
          src: z.string(),
          poster: z.string().optional(),
          align: z.enum(["left", "right", "center"]).optional(),
          size: z.enum(["auto", "16:9", "4:3", "9:16"]).optional(),
          caption: z.string().optional(),
          title: z.string().optional(),
          type: z.enum(["auto", "file", "embed"]).optional(),
        }),
      )
      .optional(),

    // Placement comes from [background[x]] markers inside the body.
    backgrounds: z
      .array(
        z.object({
          image: z.string(),
        }),
      )
      .optional(),
    cards: z
      .array(
        z
          .object({
            href: z.string().optional(),
            tag: z.string(),
            title: z.string(),
            description: z.string(),
            actionText: z.string(),
            theme: z.string().optional(),
            backgroundImage: z.string().optional(),
            links: z
              .array(
                z.object({
                  href: z.string(),
                  text: z.string().optional(),
                  // Icon name from public/images/genIcons, e.g. "Handbag".
                  icon: z
                    .string()
                    .optional()
                    .refine(
                      (value) => value === undefined || !!iconPath(value),
                      {
                        message: `must be one of: ${Object.values(iconRegistry).join(", ")}`,
                      },
                    ),
                }),
              )
              .optional(),
          })
          .refine(
            (item) =>
              !!item.href ||
              (Array.isArray(item.links) && item.links.length > 0),
            {
              message:
                "card must have either `href` or non-empty `links` array",
            },
          ),
      )
      .optional(),
  }),
});

const projects = defineCollection({
  loader: glob({
    pattern: "**/*.{md,mdx}",
    base: "./src/content/projects",
  }),

  schema: z.object({
    title: z.string(),
    tag: z.string(),

    shortDescription: z.string(),

    roles: z.array(
      z.enum([
        "lead_programmer",
        "ui",
        "game_design",
        "art",
        "audio",
        "tech_art",
        "systems",
        "tools",
        "developer",
      ]),
    ),

    theme: z.string().default("primary"),

    images: z.array(z.string()).min(1),

    order: z.number(),

    links: z.array(
      z.object({
        text: z.string(),
        href: z.string(),
      }),
    ),
  }),
});

export const collections = {
  projects,
  blog,
};
