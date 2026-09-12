# Fresh Squeeze website

Scroll-driven landing page for a cold-pressed juice brand. The hero is a pinned canvas that scrubs a 96-frame sequence as you scroll, the pattern behind Apple-style product pages. The frames come from four chained Higgsfield clips. Until those are generated, a procedural placeholder sequence keeps the page fully working end to end.

No build step, no framework. Open `index.html` or drop the folder on any static host.

## Run it locally

```
cd freshsqueeze
npx serve .
```

Or `python3 -m http.server 8000` and open `http://localhost:8000`.

## Swap in the Higgsfield footage

1. Add the Higgsfield connector to Claude (`https://mcp.higgsfield.ai/mcp` under Customize, then Connectors) and generate the hero still plus four clips using `higgsfield/PROMPTS.md`.
2. Save them as `clip-01.mp4` to `clip-04.mp4` in one folder.
3. Run the extract script. It concatenates the clips, samples 96 frames evenly, writes `frames/manifest.js` and `frames/poster.jpg`, and replaces the placeholders.

```
higgsfield/extract-frames.sh ~/Downloads/freshsqueeze-clips
```

Windows: `.\higgsfield\extract-frames.ps1 -Clips C:\path\to\clips`

Reload the page. Nothing else changes.

## How the scrub works

`section.stage` is 450vh tall. Inside it, `.stage__sticky` is 100svh and `position: sticky`, so it pins while the section scrolls through. `js/main.js` turns the section's scroll position into progress 0 to 1, picks `round(progress * 95)` from the frame list, and draws it cover-fit on the canvas with the subject column (60% of frame width) kept on screen at every viewport size.

Captions switch at `BEATS = [0, 0.28, 0.58, 0.86]`. Those four numbers are the contract between the copy, the footage and the placeholder generator. Change them in `js/main.js` if the real clips land their beats elsewhere.

Frames load in a coarse-to-fine order (every 8th, then 4th, then 2nd, then the rest) so the whole sequence is scrubbable within about a second on a normal connection, sharpening as the rest arrive.

`prefers-reduced-motion` turns the pin off, keeps the poster, and lays the four captions out in reading order.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The page. All copy lives here. |
| `css/styles.css` | Tokens (light, dark, and system), stage, sections. |
| `js/main.js` | Scroll scrub, caption beats, nav state. No dependencies. |
| `frames/` | `frame_0001.jpg` to `frame_0096.jpg`, `poster.jpg`, `manifest.js`. Generated. |
| `higgsfield/PROMPTS.md` | Hero still and four clip prompts, chaining steps, beat map. |
| `higgsfield/extract-frames.sh` and `.ps1` | Clips in, frames out. |
| `tools/make-placeholder-frames.py` | Regenerates the stand-in sequence (Pillow). |

## Deploy

Static files only. Vercel, Netlify, Cloudflare Pages or an S3 bucket all work with the folder as the root and no build command. Frames are about 6 MB total; put them behind a CDN and the scrub is instant after first visit.
