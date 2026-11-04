/* REAL-BROWSER PROOF that the screen-wide grade paints ONLY the plate
   borders and the plate patterns — never the back link, the text, or the
   pictures. Spawns a VISIBLE Edge window (its command line carries a
   "vischeck" user-data-dir tag so stray windows can be found and killed),
   drives it over CDP on port 9225, and measures actual pixels: the same
   border segment is sampled at two screen heights (the fixed-attachment
   ramp must light it at the top and darken it at the bottom, identically
   on the way back up), while strips of text, media, and the back link must
   read byte-identical across the same travel. */
import { writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { decode } from "../.freebuff/png.cjs";

const PORT = 9225;
const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

/* one fresh profile per run, so a leftover window from a previous run can
   never grab the debug port (the tag is also how stray windows are found) */
const profileDir = `${process.env.TEMP}\\vischeck-${PORT}-${Date.now()}`;

const browser = spawn(EDGE_PATH, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profileDir}`,
  "--window-size=1280,800",
  "--no-first-run",
  "--no-default-browser-check",
  "about:blank",
], { stdio: "ignore" });
browser.unref?.();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- CDP plumbing ---- */
let ws;
{
  /* wait for the freshly spawned browser to publish its debug targets */
  let targets = [];
  for (let i = 0; i < 90 && !targets.length; i++) {
    await sleep(250);
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      targets = await res.json();
    } catch {}
    targets = (targets || []).filter((t) => t.type === "page");
  }
  if (!targets.length) throw new Error(`Edge never published a page target on port ${PORT}`);

  ws = new WebSocket(targets[0].webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error("CDP websocket failed"));
  });
}

let msgId = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  const waiter = pending.get(msg.id);
  if (waiter) {
    pending.delete(msg.id);
    msg.error ? waiter.reject(new Error(msg.error.message)) : waiter.resolve(msg);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

await send("Page.enable");
await send("Runtime.enable");

/* evaluate a page expression and return its value (or its resolved promise
   value when the expression is an async IIFE) */
const evaluate = async (expression, awaitPromise = false) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise });
  if (r.result?.exceptionDetails) {
    throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
  }
  return r.result?.result?.value;
};

/* ---- page helpers ---- */
const loadPage = async (url) => {
  await send("Page.navigate", { url });
  for (let i = 0; i < 80; i++) {
    const state = await evaluate(`document.readyState`).catch(() => "");
    if (state === "complete") break;
    await sleep(250);
  }
  await sleep(900); /* first paint, module scripts, reveal observers */
};

/* the page's own toggle writes the mode to <html data-mode> AND to the
   "time-mode" storage key; set both so no page script can flip it back */
const setMode = async (mode) => {
  await evaluate(`(() => {
    document.documentElement.dataset.mode = ${JSON.stringify(mode)};
    try { localStorage.setItem("time-mode", ${JSON.stringify(mode)}); } catch {}
    return 'ok';
  })()`, true);
  await sleep(350);
};

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/* ---- the two pages under proof ---- */
const PAGES = [
  {
    name: "blog-slug",
    url: "http://localhost:4321/Website/blog/eastwardmybeloved/",
    surface: "#blog-content",
    masthead: ".blog-masthead",
    textSel: "#blog-content p",
    mediaSel: "#blog-content img.thumb-carousel-img, #blog-content video",
  },
  {
    name: "portfolio-slug",
    url: "http://localhost:4321/Website/portfolio/thesisproject/",
    surface: ".project-page-content-panel",
    masthead: ".project-page-masthead",
    textSel: "#blog-content p",
    mediaSel: ".project-page-gallery-column img, .project-page-gallery-column video",
  },
];

const scrollTopTo = async (selector, targetY) => {
  for (let i = 0; i < 30; i++) {
    const top1 = await evaluate(
      `document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().top`
    );
    if (Math.abs(top1 - targetY) <= 1.5) return top1;
    await evaluate(
      `window.scrollTo({ top: Math.max(0, window.scrollY + document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().top - ${targetY}), behavior: 'instant' })`
    );
    await sleep(150);
    const top2 = await evaluate(
      `document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().top`
    );
    if (Math.abs(top2 - targetY) <= 1.5) return top2;
  }
  throw new Error(`scroll did not settle (target ${targetY})`);
};

const rectOf = (selector) =>
  evaluate(
    `(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height }; })()`
  );

/* ---- pixel strips ----
   Each strip is cut from ONE fresh full-viewport capture, in SCREEN
   coordinates. The clipped captureScreenshot path can return stale frames
   here (a scrolled-into-view lazy image kept serving its undecoded black
   box), and every sample sits inside the viewport by construction, so the
   full frame is always the freshest source. */
const viewportShot = async () => {
  const r = await send("Page.captureScreenshot", { format: "png" });
  if (!r.result || !r.result.data) throw new Error(`capture failed: ${JSON.stringify(r).slice(0, 300)}`);
  const file = `${process.env.TEMP}\\verify-grade-viewport.png`;
  writeFileSync(file, Buffer.from(r.result.data, "base64"));
  const img = decode(file); // { w, h, px }
  img.dpr = img.w / (await evaluate(`window.innerWidth`)); // device-pixel scale
  return img;
};
/* cut a screen-coordinate region out of a decoded viewport capture */
const region = (full, sx, sy, w, h) => {
  const x0 = Math.round(sx * full.dpr), y0 = Math.round(sy * full.dpr);
  const wd = Math.round(w * full.dpr), hd = Math.round(h * full.dpr);
  if (x0 < 0 || y0 < 0 || x0 + wd > full.w || y0 + hd > full.h) {
    throw new Error(`region ${wd}x${hd} at (${x0},${y0}) falls outside the ${full.w}x${full.h} capture`);
  }
  const px = new Uint8Array(wd * hd * 4);
  for (let y = 0; y < hd; y++) {
    for (let x = 0; x < wd; x++) {
      const i = ((y0 + y) * full.w + (x0 + x)) * 4;
      const o = (y * wd + x) * 4;
      px[o] = full.px[i]; px[o + 1] = full.px[i + 1]; px[o + 2] = full.px[i + 2]; px[o + 3] = 255;
    }
  }
  return { w: wd, h: hd, px, dpr: full.dpr };
};
const strip = async (sx, sy, w, h) => region(await viewportShot(), sx, sy, w, h);
const parseRgb = (css) => {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(css);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};
/** closest-to-accent pixel inside the x band that contains the border line
 *  (band given in CSS px, converted with the strip's dpr), plus the closest
 *  outside the band as a reference for the visibility judgement */
const borderPixels = (img, accent, bandCssX) => {
  const x0 = Math.max(0, Math.round(bandCssX - 2) * img.dpr);
  const x1 = Math.min(img.w - 1, Math.round(bandCssX + 2) * img.dpr);
  let best = null, bestD = Infinity;
  let ref = null, refD = Infinity;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const i = y * img.w + x;
      const r = img.px[i * 4], g = img.px[i * 4 + 1], b = img.px[i * 4 + 2];
      const d = (r - accent[0]) ** 2 + (g - accent[1]) ** 2 + (b - accent[2]) ** 2;
      if (x >= x0 && x <= x1) {
        if (d < bestD) { bestD = d; best = i; }
      } else if (d < refD) {
        refD = d; ref = i;
      }
    }
  }
  const mk = (idx, d) =>
    idx === null ? null : {
      rgb: [img.px[idx * 4], img.px[idx * 4 + 1], img.px[idx * 4 + 2]],
      lum: lum(img.px[idx * 4], img.px[idx * 4 + 1], img.px[idx * 4 + 2]),
      dist: Math.round(Math.sqrt(d)),
    };
  return { border: mk(best, bestD), ref: mk(ref, refD) };
};
/** the border line counts as visible when the band's closest pixel is close
 *  enough to the accent (a clean 1-device-px border is pure accent) or is
 *  clearly more accent-like than anything else in the strip */
const borderVisible = (px) =>
  px.border && px.border.dist <= 60 && (px.border.dist <= 15 || (px.ref && px.border.dist < Math.max(px.ref.dist, 1) * 0.6));
const medianLum = (img) => {
  const lums = [];
  for (let i = 0; i < img.w * img.h; i++) lums.push(lum(img.px[i * 4], img.px[i * 4 + 1], img.px[i * 4 + 2]));
  lums.sort((a, b) => a - b);
  return lums[Math.floor(lums.length / 2)];
};
/** brightest pixel (the ink on these dark plates is white) */
const maxPx = (img) => {
  let best = null, bestL = -1;
  for (let i = 0; i < img.w * img.h; i++) {
    const l = lum(img.px[i * 4], img.px[i * 4 + 1], img.px[i * 4 + 2]);
    if (l > bestL) { bestL = l; best = [img.px[i * 4], img.px[i * 4 + 1], img.px[i * 4 + 2]]; }
  }
  return { rgb: best, lum: bestL };
};
const rgbDist = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));

console.log(`### screen grade :: borders + patterns only — REAL window pixel check`);
let allPass = true;

for (const page of PAGES) {
  for (const mode of ["day", "night"]) {
    try {
      await loadPage(page.url);
      await setMode(mode);
      console.log(`\n>> checking [${page.name}] in ${mode} mode (viewport ${await evaluate(`window.innerWidth`)}x${await evaluate(`window.innerHeight`)})…`);

      const ih = await evaluate(`window.innerHeight`);
      /* the blog slug keeps laying out for seconds after load (pixel fonts,
         the key art, the reveal observers) — read the surface's resting top
         only once it stops moving, or every later scroll chases a shifting
         target (a target one pixel above the natural spot turns unreachable
         mid-drift and the run crashes) */
      await evaluate(`window.scrollTo(0, 0)`);
      let naturalTop = await evaluate(
        `document.querySelector(${JSON.stringify(page.surface)}).getBoundingClientRect().top`
      );
      for (let i = 0; i < 20; i++) {
        await sleep(300);
        const top = await evaluate(
          `document.querySelector(${JSON.stringify(page.surface)}).getBoundingClientRect().top`
        );
        if (Math.abs(top - naturalTop) < 0.5) break;
        naturalTop = top;
      }
      const scrollH = await evaluate(`document.scrollingElement.scrollHeight`);
      const minTop = naturalTop - (scrollH - ih) + 2; // lowest reachable surface top
      const factsTarget = Math.min(Math.max(Math.round(ih * 0.06), minTop), naturalTop - 1);
      await scrollTopTo(page.surface, factsTarget);

      /* computed facts */
      const facts = await evaluate(`(() => {
        const surface = document.querySelector(${JSON.stringify(page.surface)});
        const s = getComputedStyle(surface);
        const wrap = surface.parentElement;
        const wBefore = wrap ? getComputedStyle(wrap, '::before') : null;
        const masthead = document.querySelector(${JSON.stringify(page.masthead)});
        const mWrap = masthead ? masthead.parentElement : null;
        const back = document.querySelector('.back-link');
        const b = back ? getComputedStyle(back) : null;
        const root = getComputedStyle(document.documentElement);
        const pageRamp = root.getPropertyValue('--page-lighting').trim();
        const backTop = back ? (() => {
          const r = back.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { inside: back.contains(hit), hit: (hit?.className?.toString?.() || hit?.tagName || '?').slice(0, 40) };
        })() : null;
        return {
          overlayCount: document.querySelectorAll('.page-lighting').length,
          surfaceBgImage: s.backgroundImage.slice(0, 60),
          surfaceAttachment: s.backgroundAttachment,
          wrapperIsRing: wrap?.classList.contains('screen-grade-ring') ?? false,
          wrapperHairline: wrap?.classList.contains('screen-grade-ring--hairline') ?? false,
          ringMask: (wBefore?.maskImage ?? 'none').slice(0, 60),
          ringAttachment: wBefore?.backgroundAttachment,
          ringPointerEvents: wBefore?.pointerEvents,
          mastheadWrap: mWrap?.classList.contains('screen-grade-ring') ?? false,
          backPosition: b?.position ?? 'missing',
          backBg: b?.backgroundImage.slice(0, 90) ?? 'missing',
          backBgIsPageRamp: b ? b.backgroundImage === pageRamp : null,
          backTop,
          bodyBg: getComputedStyle(document.body).backgroundImage,
          mainBg: getComputedStyle(document.querySelector('main')).backgroundImage,
        };
      })()`);

      const flat =
        facts.overlayCount === 0 &&
        facts.surfaceBgImage.includes("gradient") &&
        facts.surfaceAttachment === "fixed" &&
        facts.wrapperIsRing && facts.wrapperHairline &&
        facts.ringMask.includes("linear-gradient") &&
        facts.ringAttachment === "fixed" &&
        facts.ringPointerEvents === "none" &&
        facts.mastheadWrap &&
        facts.backPosition === "fixed" &&
        facts.backBgIsPageRamp === false &&
        facts.backTop?.inside === true &&
        facts.bodyBg === "none" &&
        facts.mainBg === "none";

      /* pick a segment where the left border line is actually visible */
      const rect = await rectOf(page.surface);
      const clipBorder = Math.max(0, Math.round(rect.left) - 20);
      const borderBandX = rect.left - clipBorder; // border line x inside the strip (CSS px)
      const clipBg = Math.round(rect.left) + 40;
      const yA0 = Math.round(ih * 0.10);  // ideal screen y for the "top" sample
      const yB0 = Math.round(ih * 0.88);  // ideal screen y for the "bottom" sample
      const accent = parseRgb(await evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(page.surface)})).borderTopColor`));

      let chosen = null, chosenTopA = 0, chosenTopB = 0;
      for (const off of [10, 24, 60, 142, 248, 355, 461, 567, 674]) {
        const topA = yA0 - off, topB = yB0 - off;
        if (topA < minTop || topB > naturalTop - 1) continue;
        await scrollTopTo(page.surface, topA);
        const r = await rectOf(page.surface);
        const y = Math.round(r.top + off); // screen coords: r.top is viewport-relative
        const px = borderPixels(await strip(clipBorder, y - 2, 56, 4), accent, borderBandX);
        if (borderVisible(px)) {
          chosen = off; chosenTopA = topA; chosenTopB = topB;
          break;
        }
      }
      /* short surface: the ideal top/bottom window is unreachable — use the
         two extreme reachable positions instead (the grade still flips with
         the screen because the ramp is pinned to the viewport) */
      if (chosen === null) {
        for (const off of [10, 24]) {
          const topA = minTop, topB = naturalTop - 1;
          if (topB + off > ih - 4) continue;
          await scrollTopTo(page.surface, topA);
          const r = await rectOf(page.surface);
          const y = Math.round(r.top + off); // screen coords
          const px = borderPixels(await strip(clipBorder, y - 2, 56, 4), accent, borderBandX);
          if (borderVisible(px)) {
            chosen = off; chosenTopA = topA; chosenTopB = topB;
            break;
          }
        }
      }
      if (chosen === null) throw new Error("no segment with a visible border line found");

      /* screen positions shared by the text / media / back-link identity checks */
      const yTop = Math.round(ih * 0.15), yBot = Math.round(ih * 0.85);

      /* ---- text strip: the longest paragraph, at a row that holds glyphs ---- */
      const para = await evaluate(`(() => {
        const ps = Array.from(document.querySelectorAll(${JSON.stringify(page.textSel)}))
          .filter((p) => (p.textContent || '').trim().length > 60);
        if (!ps.length) return null;
        const best = ps.sort((a, b) => (b.textContent || '').length - (a.textContent || '').length)[0];
        best.dataset.gradeText = '1';
        const r = best.getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height };
      })()`);
      /* bring the paragraph's first rows into view before scanning for ink */
      let paraRect = para;
      if (para) {
        await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(page.textSel)} + '[data-grade-text]');
          const r = el.getBoundingClientRect();
          window.scrollTo({ top: Math.max(0, window.scrollY + r.top - window.innerHeight * 0.2), behavior: 'instant' });
          return el.getBoundingClientRect().top; })()`);
        await sleep(250);
        /* the rect above was read at the old scroll position — re-read it */
        paraRect = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(page.textSel)} + '[data-grade-text]');
          const r = el.getBoundingClientRect();
          return { left: r.left, top: r.top, width: r.width, height: r.height }; })()`);
      }
      let textRow = null;
      if (paraRect) {
        /* one capture, many rows: the whole scan reads the same viewport */
        const paraFull = await viewportShot();
        /* rows must also fit inside the viewport at the low sample position
           (strip y = yBot + dy - 6) or the region read would leave the capture */
        for (let dy = 8; dy < paraRect.height - 12 && dy < 220 && dy < ih - yBot - 12; dy += 8) {
          const w = Math.min(70, Math.max(30, paraRect.width - 30));
          const y = Math.round(paraRect.top + dy - 6);
          const img = region(paraFull, paraRect.left + 12, y, w, 12);
          const mx = maxPx(img);
          if (mx.lum > 120 && (!textRow || mx.lum > textRow.bright)) {
            textRow = { dy, bright: mx.lum };
          }
        }
      }
      const textSelTagged = textRow ? `${page.textSel}[data-grade-text]` : null;

      /* ---- media strip ---- */
      const media = await evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(page.mediaSel)});
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height };
      })()`);

      /* freeze the page animations so the pattern cannot drift mid-proof */
      await evaluate(`document.getAnimations().forEach((a) => a.pause()); 'ok'`);
      await sleep(300);

      const sampleGraded = async (surfaceTopTarget) => {
        const top = await scrollTopTo(page.surface, surfaceTopTarget);
        const r = await rectOf(page.surface);
        if (Math.abs(r.top - surfaceTopTarget) > 1.5) throw new Error(`rect drift: ${r.top}`);
        const y = Math.round(r.top + chosen); // screen coords
        const b = borderPixels(await strip(clipBorder, y - 2, 56, 4), accent, borderBandX);
        const g = medianLum(await strip(clipBg, y - 2, 56, 4));
        return { top, border: b.border, dist: b.border?.dist ?? 999, fill: g, y };
      };
      /* element strips are sampled by their OWN element position: scroll the
         element's box near the target screen y, then read it */
      const sampleElement = async (sel, row, targetY) => {
        const scrollToY = () => evaluate(
          `(() => { const el = document.querySelector(${JSON.stringify(sel)});
            const r = el.getBoundingClientRect();
            window.scrollTo({ top: Math.max(0, window.scrollY + r.top + ${row ?? 0} - ${targetY}), behavior: 'instant' });
            return el.getBoundingClientRect().top; })()`
        );
        let top = await scrollToY();
        for (let i = 0; i < 12 && Math.abs(top + (row ?? 0) - targetY) > 2; i++) {
          await sleep(120);
          top = await scrollToY();
        }
        const r = await evaluate(
          `(() => { const el = document.querySelector(${JSON.stringify(sel)}); const rr = el.getBoundingClientRect();
            return { left: rr.left, top: rr.top, width: rr.width, height: rr.height }; })()`
        );
        const y = Math.round(r.top + (row ?? Math.round(r.height / 2)) - 6);
        const w = Math.min(70, Math.max(30, r.width - 20));
        const img = await strip(Math.round(r.left + 10), y, w, 12);
        return maxPx(img);
      };

      const A = await sampleGraded(chosenTopA); // segment at its highest screen position
      const B = await sampleGraded(chosenTopB); // SAME segment at its lowest screen position
      const C = await sampleGraded(chosenTopA); // SAME segment back at the top

      /* the masthead's ring: accent-like pixels on its top-left corner (the
         flat accent strip / ring the masthead carries). A page that scrolls
         far can lift the masthead right into the very-light wash at the top
         of the screen and settle it back at its natural spot (~15% down, in
         the lighter tint) — light-at-top / darker-below over that travel
         proves the ring follows the screen grade (a flat, ungraded band
         would read identical at both). A page that barely scrolls cannot
         move its masthead, so the pixel check runs only where the travel
         exists; the short page still proves its ring structurally (wrapper
         + mask + fixed attachment) and shares the ring pass the blog page
         proves. */
      const mastCorner = async (targetTop) => {
        await scrollTopTo(page.masthead, targetTop);
        const r = await rectOf(page.masthead);
        const img = await strip(Math.round(r.left - 2), Math.round(r.top - 2), 30, 12);
        return borderPixels(img, accent, 4); // the accent band x inside the strip
      };
      await evaluate(`window.scrollTo(0, 0)`);
      await sleep(150);
      const mastNatTop = (await rectOf(page.masthead)).top; // its natural spot at scrollY=0
      const mastMinTop = mastNatTop - (scrollH - ih); // lowest y the page can lift it to
      let mastHigh = null, mastLow = null;
      let mastScreen = false, mastNote = "";
      if (mastNatTop - mastMinTop >= 30) {
        /* sample as high as the masthead can reach (y=2), not ih*0.03: the
           very-light band's luminance is not monotonic (the 5% stop is dimmer
           than the 0% stop), so 21px can read BELOW the natural-spot value
           and fake a failing delta */
        mastHigh = await mastCorner(2);
        mastLow = await mastCorner(Math.round(mastNatTop));
        /* the stronger ramp pulls the washed band far from the flat accent
           (a 55% very-light wash over yellow is ~dist 70), so the sanity
           limits scale with the wash, not the accent */
        mastScreen =
          mastHigh.border && mastHigh.border.dist <= 110 &&
          mastLow.border && mastLow.border.dist <= 70 &&
          mastHigh.border.lum - mastLow.border.lum >= 2;
      } else {
        mastScreen = true; // structure facts already gate the wrapper + mask
        mastNote = `page scrolls only ${(mastNatTop - mastMinTop).toFixed(0)}px — ring structure stands`;
      }

      /* text / media / back-link identity across the same two positions */
      const elA = textSelTagged ? await sampleElement(textSelTagged, textRow.dy, yTop) : null;
      const elB = textSelTagged ? await sampleElement(textSelTagged, textRow.dy, yBot) : null;
      /* The media identity strip is ONE row of the element sampled at screen
         yTop and again at yBot. That row must fit inside the viewport at BOTH
         positions — a row past the bottom would read outside the capture
         (region() now throws, but the old code silently read zeros there and
         faked a black picture). The element is usually taller than the room
         below yBot, so scan the rows that DO fit for one holding real painted
         pixels and use that row for both samples. */
      let medA = null, medB = null;
      if (media) {
        const mediaRowMax = Math.min(ih - yBot - 14, Math.max(8, media.height - 20));
        let mediaRow = null;
        for (let attempt = 0; attempt < 4 && mediaRow === null; attempt++) {
          /* force a fresh decode (lazy images can sit evicted), then verify
             paint by scanning the candidate rows from ONE capture */
          await evaluate(`(async () => {
            const el = document.querySelector(${JSON.stringify(page.mediaSel)});
            if (!el) return 'no media';
            el.scrollIntoView({ block: 'center', behavior: 'instant' });
            await new Promise((r) => setTimeout(r, 300));
            if (typeof el.decode === 'function') {
              try { await Promise.race([el.decode(), new Promise((_, rej) => setTimeout(() => rej(new Error('decode timeout')), 10000))]); } catch (e) {}
            }
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            return { complete: el.complete, naturalWidth: el.naturalWidth || 0 };
          })()`, true);
          await sleep(300);
          await scrollTopTo(page.mediaSel, yTop);
          const full = await viewportShot();
          const r = await rectOf(page.mediaSel);
          const w = Math.min(70, Math.max(30, r.width - 20));
          for (let row = 8; row <= mediaRowMax; row += 8) {
            const mx = maxPx(region(full, Math.round(r.left + 10), Math.round(r.top + row - 6), w, 12));
            if (Math.max(mx.rgb[0], mx.rgb[1], mx.rgb[2]) > 10) { mediaRow = row; break; }
          }
          if (mediaRow === null) await sleep(1500);
        }
        if (mediaRow !== null) {
          medB = await sampleElement(page.mediaSel, mediaRow, yBot);
          if (medB && Math.max(medB.rgb[0], medB.rgb[1], medB.rgb[2]) <= 10) {
            /* the picture got evicted again mid-check — decode once more */
            await evaluate(`(async () => {
              const el = document.querySelector(${JSON.stringify(page.mediaSel)});
              if (typeof el.decode === 'function') {
                try { await Promise.race([el.decode(), new Promise((_, rej) => setTimeout(() => rej(new Error('decode timeout')), 10000))]); } catch (e) {}
              }
              await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            })()`, true);
            await sleep(400);
            medB = await sampleElement(page.mediaSel, mediaRow, yBot);
          }
          /* close the loop: the first sample must match the last */
          medA = await sampleElement(page.mediaSel, mediaRow, yTop);
        }
      }
      const backA = await sampleElement(".back-link", null, yTop);
      const backB = await sampleElement(".back-link", null, yBot);

      await evaluate(`document.getAnimations().forEach((a) => a.play()); 'ok'`);

      const borderScreen = A.border.lum - B.border.lum >= 2 && C.border.lum - B.border.lum >= 2 && Math.abs(A.border.lum - C.border.lum) <= 10;
      const fillScreen = A.fill - B.fill >= 2 && C.fill - B.fill >= 2 && Math.abs(A.fill - C.fill) <= 10;
      /* the stronger ramp's bottom band is a 60% dark wash — a graded border
         at screen y≈88% legitimately reads far from the flat accent (dist
         ~120 on yellow), so only the TOP positions must stay accent-clean */
      const borderClean = A.dist <= 60 && B.dist <= 140 && C.dist <= 60;
      const textIdentity = !textRow || (elA && elB && rgbDist(elA.rgb, elB.rgb) <= 12 && Math.abs(elA.lum - elB.lum) <= 10);
      const mediaIdentity = !media || (medA && medB && rgbDist(medA.rgb, medB.rgb) <= 4);
      const backIdentity = backA && backB && rgbDist(backA.rgb, backB.rgb) <= 2 && Math.abs(backA.lum - backB.lum) <= 2;
      const pass = flat && borderScreen && fillScreen && mastScreen && borderClean && textIdentity && mediaIdentity && backIdentity;
      allPass = allPass && pass;

      console.log(`\n[${page.name} :: ${mode}]  (segment ${chosen}px below the surface top; surface spans top ${minTop.toFixed(0)}..${(naturalTop - 1).toFixed(0)})`);
      console.log(`  structure: overlay elements ${facts.overlayCount === 0 ? "none ✓" : `${facts.overlayCount} ✗`} · body/main gradients ${facts.bodyBg === "none" && facts.mainBg === "none" ? "none ✓" : "PRESENT ✗"}`);
      console.log(`  surface own background: ${facts.surfaceBgImage.includes("gradient") ? "gradient ✓" : "flat ✗"} · attachment ${facts.surfaceAttachment}${facts.surfaceAttachment === "fixed" ? " ✓" : " ✗"}`);
      console.log(`  reading column wrapper: ring ${facts.wrapperIsRing && facts.wrapperHairline ? "✓" : "✗"} · ::before mask ${facts.ringMask.includes("linear-gradient") ? "ring ✓" : "MISSING ✗"} · attachment ${facts.ringAttachment} · pointer-events ${facts.ringPointerEvents}`);
      console.log(`  masthead wrapper: ${facts.mastheadWrap ? "screen-grade-ring ✓" : "MISSING ✗"}`);
      console.log(`  back link: ${facts.backPosition} · own button lighting ${facts.backBgIsPageRamp === false ? "(not the page ramp) ✓" : "IS THE PAGE RAMP ✗"} · topmost at its own point ${facts.backTop?.inside ? "✓" : `NO ✗ (${facts.backTop?.hit})`}`);
      console.log(`  SAME border segment, three screen positions:`);
      console.log(`    highest (screen y=${A.y}): rgb(${A.border.rgb}) lum ${A.border.lum.toFixed(1)} (dist to accent ${A.dist})`);
      console.log(`    low (screen y=${B.y}): rgb(${B.border.rgb}) lum ${B.border.lum.toFixed(1)} (dist ${B.dist})`);
      console.log(`    back up (screen y=${C.y}): rgb(${C.border.rgb}) lum ${C.border.lum.toFixed(1)} (dist ${C.dist})`);
      console.log(`    border graded: high>low ${borderScreen ? "✓" : "✗"} (Δ${(A.border.lum - B.border.lum).toFixed(1)}) · repeatable ${Math.abs(A.border.lum - C.border.lum) <= 10 ? "✓" : "✗"} (Δ${Math.abs(A.border.lum - C.border.lum).toFixed(1)})`);
      console.log(`  SAME fill patch: high ${A.fill.toFixed(1)} · low ${B.fill.toFixed(1)} · back up ${C.fill.toFixed(1)} → graded ${fillScreen ? "✓" : "✗"} (Δ${(A.fill - B.fill).toFixed(1)})`);
      console.log(`  masthead ring band: ${mastNote || `top lum ${mastHigh.border.lum.toFixed(1)} · natural-spot lum ${mastLow.border.lum.toFixed(1)} → screen-graded ${mastScreen ? "✓" : "✗"} (Δ${(mastHigh.border.lum - mastLow.border.lum).toFixed(1)})`}`);
      console.log(`  TEXT strip: ${textRow ? `high lum ${elA?.lum?.toFixed(1)} · low lum ${elB?.lum?.toFixed(1)} → ungraded ${textIdentity ? "✓" : "✗"} (Δ${Math.abs((elA?.lum ?? 0) - (elB?.lum ?? 0)).toFixed(1)})` : "no long paragraph found — skipped"}`);
      console.log(`  MEDIA strip: ${media ? `high lum ${medA?.lum?.toFixed(1)} · low lum ${medB?.lum?.toFixed(1)} → ungraded ${mediaIdentity ? "✓" : "✗"} (Δ${Math.abs((medA?.lum ?? 0) - (medB?.lum ?? 0)).toFixed(1)})` : "no media found — skipped"}`);
      console.log(`  BACK LINK: high lum ${backA?.lum?.toFixed(1)} · low lum ${backB?.lum?.toFixed(1)} → ungraded ${backIdentity ? "✓" : "✗"} (Δ${Math.abs((backA?.lum ?? 0) - (backB?.lum ?? 0)).toFixed(1)})`);
      console.log(`  verdict: ${pass ? "borders + patterns share the screen-wide grade; text, media and chrome do not ✓" : "FAIL ✗"}`);
    } catch (e) {
      allPass = false;
      console.log(`\n[${page.name} :: ${mode}] CRASHED: ${e.message}`);
    }
  }
}

/* leave the window on the blog slug in day mode */
try {
  await loadPage(PAGES[0].url);
  await setMode("day");
  await evaluate("window.scrollTo(0, 0)");
  await sleep(400);
} catch {}
ws.close();
console.log(`\n### overall: ${allPass ? "ALL PASS ✓" : "SOME CHECKS FAILED ✗"}`);
console.log(`### visible window left open on ${PAGES[0].url} (day) — scroll and watch the borders and patterns follow the screen grade while text, media and the back link stay clean.`);
process.exit(allPass ? 0 : 1);
