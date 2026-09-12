# Fresh Squeeze website

Scroll-driven landing page for a cold-pressed juice brand. The hero is a pinned canvas that scrubs a 96-frame sequence as you scroll, the pattern behind Apple-style product pages. The frames come from four Higgsfield clips generated keyframe to keyframe. `tools/make-placeholder-frames.py` can still produce a procedural stand-in sequence if the footage is ever missing.

No build step, no framework. Open `index.html` or drop the folder on any static host.

## Run it locally

```
cd freshsqueeze
npx serve .
```

Or `python3 -m http.server 8000` and open `http://localhost:8000`.

## The footage

The hero frames come from Higgsfield: a whole watermelon in tropical key light, cut open, poured, and finally a full field of red juice under the order button. `higgsfield/PROMPTS.md` has every prompt, model and credit cost, and the beat table.

To regenerate or extend it:

1. Generate keyframes and clips on Higgsfield (the MCP connector at `https://mcp.higgsfield.ai/mcp` works from any Claude chat).
2. Put the result URLs in `higgsfield/media.json` and push. The `Fetch Higgsfield media` Action pulls them in, runs the extraction, and commits `frames/`.
3. Or, with ffmpeg installed locally, download the clips as `clip-01.mp4` to `clip-04.mp4` and run:

```
higgsfield/extract-frames.sh ~/Downloads/freshsqueeze-clips
```

Windows: `.\higgsfield\extract-frames.ps1 -Clips C:\path\to\clips`

Either way the script writes 96 frames, `frames/poster.jpg` and `frames/manifest.js`. Reload and nothing else changes.

## How the scrub works

`section.stage` is 450vh tall. Inside it, `.stage__sticky` is 100svh and `position: sticky`, so it pins while the section scrolls through. `js/main.js` turns the section's scroll position into progress 0 to 1, picks `round(min(1, progress / 0.85) * 95)` from the frame list, and draws it cover-fit on the canvas with the subject column (60% of frame width) kept on screen at every viewport size.

Captions switch at `BEATS = [0, 0.29, 0.50, 0.80]`, and the scrub itself finishes at 85% of the stage so the final red frame holds under the order caption. Those numbers are the contract between the copy and the footage. Change them in `js/main.js` if the clips are regenerated.

Frames load in a coarse-to-fine order (every 8th, then 4th, then 2nd, then the rest) so the whole sequence is scrubbable within about a second on a normal connection, sharpening as the rest arrive.

`prefers-reduced-motion` turns the pin off, keeps the poster, and lays the four captions out in reading order.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The page. All copy lives here. |
| `css/styles.css` | Tokens (light, dark, and system), stage, sections. |
| `js/main.js` | Scroll scrub, caption beats, nav state. No dependencies. |
| `frames/` | `frame_0001.jpg` to `frame_0096.jpg`, `poster.jpg`, `manifest.js`. Generated. |
| `higgsfield/PROMPTS.md` | Every prompt used, models, credits, beat map, how to regenerate one beat. |
| `higgsfield/media.json` | URLs the fetch Action pulls into the repo. |
| `higgsfield/keyframes/` | The four stills the clips interpolate between. |
| `higgsfield/extract-frames.sh` and `.ps1` | Clips in, frames out. |
| `tools/make-placeholder-frames.py` | Procedural stand-in sequence (Pillow), no longer used by default. |
| `.github/workflows/fetch-media.yml` | Pulls Higgsfield media into the branch and extracts frames on the runner. |

## Deploy

Static files only. Vercel, Netlify, Cloudflare Pages or an S3 bucket all work with the folder as the root and no build command. Frames are about 6 MB total; put them behind a CDN and the scrub is instant after first visit.
