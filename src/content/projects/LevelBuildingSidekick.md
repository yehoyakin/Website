---
title: "Level Building Sidekick"
theme: "lightblue"
description: "Procedural assistance for rapid level creation."
tag: "UNITY ENGINE - PLUGIN TOOL"
cardBackground: "images/projects/LevelBuildingSidekick/levelBuildingSidekickCover.webp"
background: "images/projects/LevelBuildingSidekick/levelBuildingSidekickCover.webp"
backgrounds:
  - image: "images/projects/LevelBuildingSidekick/levelBuildingSidekickCover.webp"

backgroundBlur: 0.33
backgroundOpacity: 0.9
backgroundParallax: 1

roles:
  - developer
  - systems
  - ui
  - tools

cards:
  - tag: ""
    title: "Unity Asset Store"
    description: ""
    actionText: "View on store"
    backgroundImage: ""
    links:
      - icon: "Handbag"
        href: "https://assetstore.unity.com/packages/tools/level-design/level-building-sidekick-308621"
        text: "Unity Asset Store"

scenes:
  - image: "images/projects/LevelBuildingSidekick/zoneEditor.webp"
    align: "center"
  - image: "images/projects/LevelBuildingSidekick/behaviorGraph.webp"
    align: "center"
  - image: "images/projects/LevelBuildingSidekick/wavePainter.webp"
    align: "center"
  - image: "images/projects/LevelBuildingSidekick/inspectorPanel.webp"
    align: "center"

order: 1

links:
  - text: "Unity Asset Store"
    href: "https://assetstore.unity.com/packages/tools/level-design/level-building-sidekick-308621"
---

A *Unity Editor plugin* designed to streamline the creation of top-down and strategy game levels.

It combines *procedural generation algorithms* with reusable templates, allowing designers for quick level generation.

The goal of the tool is to *reduce repetitive work while preserving designer control* over the final result.

[scene[0], "The Interior Zones, mostly used for dungeon levels."]
[scene[1], "The quest graphs is based on nodes, the nodes can hold information such as enemies to kill, keys or triggers."]
[scene[2], "The exterior layer uses a wave function collapse algorithm to recommend interesting areas."]
[scene[3], "The starting view of the Plugin window"]

##### Contribution

- Multiple optimization and system rewrites. Most important being 
layer generation from *700-1000ms* to *10-30ms*.
- Implemented a custom *grammar-based quest generation* system with scriptable objects and auto generated Visual Elements and Monobehaviours.
- *libraries and methods* for the rest of the development team to use.
- Standarized *magic numbers to defined constants*.
- **Mentored** two students's internships throughout development.
- Extensive use of Unity's **UI-Toolkit**
