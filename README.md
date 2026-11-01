# Website
Website to display my portfolio and blogs. You are welcome to fork it and add you own content!

A personal site for game-dev work: a small landing page, a project portfolio and
a blog. It is a static [Astro](https://astro.build) site styled with Tailwind
CSS, with all written content coming from Markdown files in `src/content/`.

## Getting started

```bash
npm install
npm run dev      # local dev server
npm run build    # static build into dist/
npm run preview  # preview the build
```

## Main pages

- **Home (`/`)** — a full-screen landing with the intro header and a split card
  that links to the Portfolio and the Blog. A floating contact panel sits in the
  top-right corner.
- **Portfolio (`/portfolio`)** — loads the projects collection and shows the
  projects in a swipeable thumbnail carousel (each thumbnail cycles through the
  project's images). Selecting one expands its full write-up and roles into a
  larger card; project links sit under the thumbnails.
- **Blog (`/blog`)** — loads the blog collection and lists the posts newest
  first as cards in a swipeable, one-card-at-a-time carousel.
- **Blog post (`/blog/<slug>`)** — one page per Markdown file in
  `src/content/blog/`. It renders the post header, the article body, a
  scroll-driven background, a floating cards sidebar and a small end-of-article
  message.
- **404** — a simple not-found page.

`MyLayout.astro` is shared by every page: it includes the global styles, the
pixel-style page transition between routes, and applies the page theme when one
is passed in.

## Blog

Posts live in `src/content/blog/*.md` and are validated by the `blog` schema in
`src/content.config.ts`. A post's frontmatter controls both its card on the
listing page and the article page:

```yaml
---
title: "My post"
theme: "yellow"          # any theme name, see Themes below
description: "Short summary shown on the card"
date: 08/21/2026
cardBackground: "images/blog/my-post/cover.webp"  # optional card image

# Article background layers (optional)
backgrounds:
  - image: "images/blog/my-post/bg1.webp"
backgroundBlur: 0.33
backgroundOpacity: 0.9
backgroundParallax: 1

# Inline media referenced by markers in the body (optional)
scenes:
  - image: "images/blog/my-post/scene1.webp"
    align: center
    size: "16:9"
    caption: "An optional caption"
videos:
  - src: "https://www.youtube.com/watch?v=..."   # or a local video file
    size: "16:9"
    caption: "An optional caption"

# Cards shown in the floating sidebar (optional)
cards:
  - title: "Related link"
    tag: ""
    description: ""
    actionText: "Open"
    links:
      - icon: "Handbag"
        href: "https://example.com"
        text: "Store"
---
```

Media is placed in the body with markers rather than raw HTML:

- `[background[0]]` — switches the article background to entry `0` at that
  point in the text.
- `[scene[0]]` — inserts scene image `0`. Several images can be grouped with
  `[scene[0,1]]`, and an optional caption/size can follow the marker, e.g.
  `[scene[0], "A caption"]`.
- `[video[0]]` — inserts video `0`. YouTube and Vimeo links are embedded; local
  paths and direct video files play in a native player.

The article page handles the background cross-fades, scene reveal animations
and sidebar behaviour in a script at the bottom of
`src/pages/blog/[slug].astro`.

## Portfolio

Projects live in `src/content/projects/*.md` and use the `projects` schema:

```yaml
---
title: "Project name"
tag: "UNITY ENGINE - TOOL"
shortDescription: "One-line summary."
roles: [developer, systems, ui, tools]
theme: purple
images:
  - "images/projects/project.webp"
order: 1
links:
  - text: "Store page"
    href: "https://example.com"
---
```

The rest of the file is the full project write-up, shown when the project is
expanded. Project cards use the first image in `images`, so put the main
thumbnail there.

The portfolio gallery reads the collection, shows each project as a thumbnail
and opens its Markdown body inside an expandable card. The body can use the same
Markdown and small HTML blocks as blog posts (for example a
`<div class="retro-contribution">` section).

## Themes and fonts

Themes are a single idea used everywhere: **one name controls both colour and
typography**. A theme name such as `terminal` maps to two CSS pieces:

- `--theme-yellow` in `src/styles/foundation/designTokens.css` — the theme's colour.
- `[data-theme="--theme-yellow"]` in `src/styles/foundation/fontFamilyTokens.css` — the
  theme's font set (`--font-title`, `--font-ui`, `--font-body`,
  `--font-terminal`).

When a page or component is given a theme, it carries the matching
`data-theme="--theme-{name}"` attribute, which selects that theme's font set,
and its accent colour points at the same theme's token through
`--project-tag-color`.

You can apply a theme in three places:

- A Markdown file, with `theme: "name"` — used by its blog post or project.
- A whole page, by passing `theme="name"` to `MyLayout` (the attribute lands on
  `<html>`).
- A single component, by passing `theme="name"` to `Title` or `Body`.

Names are normalised by `src/config/uiDictionary.ts` (`primary` is the
fallback), so a theme only needs a colour token to work — it will simply use
the default fonts until a font set is added for it.

### Adding or changing a theme

1. Add a colour token in `src/styles/foundation/designTokens.css`:
   `--theme-green: rgb(34, 197, 94);`
2. Optionally add a `[data-theme="--theme-green"]` block in
   `src/styles/foundation/fontFamilyTokens.css` to give it its own fonts.
3. Use `theme: "green"` in a Markdown file, or `theme="green"` in a
   component.

No TypeScript changes are needed.

### Fonts

Fonts are exposed as four tokens declared in `src/styles/foundation/fontFamilyTokens.css`:
`--font-title`, `--font-ui`, `--font-body` and `--font-terminal`.

- The default set lives on `:root`; each theme block overrides it.
- Google-hosted families are loaded once in `src/styles/site.css`. If you add
  a new family there, also point a theme token at it in `fonts.css`; unused
  families just add download weight.
- The pixel families ("Pixel Operator", "Pixel Operator Mono", "Pixeloid Sans",
  etc.) are local files in `src/fonts/`, declared with `@font-face` in
  `src/styles/foundation/fontFaces.css`. Reference them by family name in a theme
  block like any other font.

Because the fonts are keyed off the same `data-theme` attribute as the colours,
switching a theme changes the page's typeface and accent colour together.
