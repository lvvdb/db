/* Fresh Squeeze — scroll-scrubbed frame stage.
 *
 * The stage is a tall section with a sticky, viewport-high child. As the
 * section scrolls through, progress 0..1 picks a frame from the sequence in
 * frames/ (see frames/manifest.js) and draws it cover-fit on a canvas.
 * Captions switch at fixed progress points (BEATS) so copy stays in sync
 * with what the footage is doing. No libraries.
 */
(() => {
  "use strict";

  const cfg = Object.assign(
    { count: 96, dir: "frames", pattern: "frame_{n}.jpg", pad: 4, width: 1280, height: 720, focal: 0.6 },
    window.FRESH_FRAMES || {}
  );

  // Progress at which each caption takes over, tuned to the Higgsfield
  // footage (see the beat map in higgsfield/PROMPTS.md): the cut opens at
  // frame 30, the pour starts at 56, the frame is all juice from about 90.
  const BEATS = [0, 0.29, 0.5, 0.8];
  // The frame scrub finishes at this fraction of the stage; the last frame
  // (the full red field) holds for the rest so the order caption gets room.
  const SCRUB_END = 0.85;

  const stage = document.getElementById("stage");
  const sticky = document.getElementById("stage-sticky");
  const canvas = document.getElementById("stage-canvas");
  const captions = Array.from(stage.querySelectorAll(".caption"));
  const beatLabel = document.getElementById("stage-beat");
  const fill = document.getElementById("stage-fill");
  const hint = document.getElementById("stage-hint");
  const nav = document.getElementById("nav");
  const NAV_H = 72;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext && canvas.getContext("2d");

  if (reduceMotion || !ctx) {
    // Poster stays visible; CSS lays every caption out in reading order.
    captions.forEach((c) => c.classList.add("is-active"));
    nav.classList.add("nav--stage");
    window.addEventListener("scroll", () => {
      const r = stage.getBoundingClientRect();
      nav.classList.toggle("nav--stage", r.bottom > NAV_H);
      nav.classList.toggle("nav--solid", r.bottom <= NAV_H);
    }, { passive: true });
    return;
  }

  const frames = new Array(cfg.count).fill(null);
  const loaded = new Array(cfg.count).fill(false);
  let target = 0;
  let drawn = -1;
  let ready = false;

  const src = (i) => `${cfg.dir}/${cfg.pattern.replace("{n}", String(i + 1).padStart(cfg.pad, "0"))}`;

  function nearestLoaded(i) {
    for (let d = 0; d < cfg.count; d++) {
      if (loaded[i - d]) return i - d;
      if (loaded[i + d]) return i + d;
    }
    return -1;
  }

  function draw(i) {
    const img = frames[i];
    const w = sticky.clientWidth;
    const h = sticky.clientHeight;
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s;
    const dh = img.naturalHeight * s;
    // Cover-fit, keeping the focal column (where the subject sits) on screen.
    let dx = w / 2 - dw * cfg.focal;
    dx = Math.min(0, Math.max(w - dw, dx));
    const dy = (h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
    drawn = i;
    if (!ready) {
      ready = true;
      stage.classList.add("is-ready");
    }
  }

  function render() {
    const i = nearestLoaded(target);
    if (i >= 0 && i !== drawn) draw(i);
  }

  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(sticky.clientWidth * dpr);
    canvas.height = Math.round(sticky.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawn = -1;
    render();
  }

  function load(i) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        loaded[i] = true;
        if (i === target || drawn < 0 || Math.abs(i - target) < Math.abs(drawn - target)) render();
        resolve();
      };
      img.onerror = resolve;
      img.src = src(i);
      frames[i] = img;
    });
  }

  // Load order: frame 0, then every 8th, 4th, 2nd, then the rest, so a
  // coarse version of the whole sequence is scrubbable within a second.
  const order = [];
  const seen = new Set();
  for (const step of [cfg.count, 8, 4, 2, 1]) {
    for (let i = 0; i < cfg.count; i += step) {
      if (!seen.has(i)) {
        seen.add(i);
        order.push(i);
      }
    }
  }
  let cursor = 0;
  function pump() {
    if (cursor >= order.length) return;
    load(order[cursor++]).then(pump);
  }
  for (let k = 0; k < 6; k++) pump();

  let ticking = false;
  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  function update() {
    ticking = false;
    const rect = stage.getBoundingClientRect();
    const vh = sticky.clientHeight;
    const scrollable = Math.max(1, rect.height - vh);
    const p = Math.min(1, Math.max(0, -rect.top / scrollable));

    target = Math.round(Math.min(1, p / SCRUB_END) * (cfg.count - 1));
    render();

    let beat = 0;
    for (let b = 1; b < BEATS.length; b++) if (p >= BEATS[b]) beat = b;
    captions.forEach((c, i) => c.classList.toggle("is-active", i === beat));
    beatLabel.textContent = `${String(beat + 1).padStart(2, "0")} / ${String(BEATS.length).padStart(2, "0")}`;
    fill.style.transform = `scaleY(${p})`;
    hint.classList.toggle("is-hidden", p > 0.04);
    sticky.classList.toggle("is-final", beat === BEATS.length - 1);

    const onStage = rect.bottom > NAV_H;
    nav.classList.toggle("nav--stage", onStage && beat < BEATS.length - 1);
    nav.classList.toggle("nav--solid", !onStage);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => { size(); onScroll(); });
  size();
  update();
})();
