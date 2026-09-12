# Higgsfield scene prompts

One continuous shot, 20 seconds, cut into four 5-second clips that chain last-frame to first-frame. The site samples 96 frames across the whole thing and scrubs them with scroll. The four caption beats below land at fixed points in that sequence, so the footage has to hit the same beats.

## Settings that must match on every clip

Aspect ratio 16:9. Resolution 1920 x 1080 (1280 x 720 also works, the extract script downsizes to 1280 wide either way). Duration 5 seconds. Camera locked off, or one slow push in. No cuts, no whip pans, no speed ramps. Same lighting direction in every clip: key light from top left. Nothing enters frame that isn't in the prompt.

Composition rule for every clip: the subject sits at 60 percent of frame width, slightly right of center. The left 40 percent stays quiet and dark, that's where the captions live. The site's cover-crop keeps that 60 percent column on screen on phones too.

Avoid in every clip: text, logos, labels, hands, people, extra fruit appearing, flicker, lens flares, watermarks, film grain.

## Hero still

Generate this first with an image model, then use it as the start image for clip 1. Every clip inherits its look.

```
A single whole Valencia orange, photoreal, floating at rest against a deep forest-green studio backdrop that fades to near black at the edges. Dawn-like key light from the top left, soft rim light on the right edge, fine dimpled peel texture, one small glossy leaf at the stem. Orange positioned at 60% of frame width, slight low angle, macro product photography, 85mm lens, shallow depth of field, 16:9.
```

## Clip 1 · Dawn (frames 1 to 27, caption "Squeezed at 5 a.m. At your door by 8.")

Start image: hero still.

```
Slow product shot. The whole orange drifts upward a few centimeters and settles, rotating gently so the leaf catches the light. The green backdrop warms almost imperceptibly toward the bottom as if a sunrise is beginning behind it. Fine dust motes drift through the key light. Locked-off camera, 5 seconds, no cuts.
```

## Clip 2 · Split (frames 28 to 55, caption "Never heated. Never from concentrate.")

Start image: last frame of clip 1.

```
The orange rotates to face camera and a clean horizontal cut opens across its equator. The top half lifts away and recedes out of focus toward the upper left, revealing a perfect cross-section: bright segments, white pith ring, thin membranes, glistening vesicles. The cross-section turns slowly clockwise and fills more of the frame. Backdrop warms from forest green to deep amber at the bottom. Locked-off camera, 5 seconds, no cuts.
```

## Clip 3 · Pour (frames 56 to 82, caption "Three days fresh. That's the point.")

Start image: last frame of clip 2.

```
Juice begins to run from the lower edge of the cross-section in slow, heavy drops. Below, a surface of bright orange juice rises steadily from the bottom of frame with a soft rolling wave, catching the key light. The slice lifts slightly and softens out of focus as the juice level climbs past half frame. Backdrop is now warm amber. Locked-off camera, slow motion feel, 5 seconds, no cuts.
```

## Clip 4 · Full (frames 83 to 96, caption "Pick your first box.")

Start image: last frame of clip 3.

```
The juice surface rises until it fills the entire frame, wave settling flat. Frame becomes a full field of luminous orange juice with a soft warm glow at upper right and a few slow tiny bubbles rising. Calm, bright, no subject other than the juice itself. Locked-off camera, 5 seconds, no cuts.
```

The last clip ends on a flat warm-orange field on purpose. The final caption and its button use dark green text and sit on that field.

## Chaining the clips

Generate clip 1 from the hero still. Pull its last frame and use that as the start image for clip 2. Repeat for clips 3 and 4.

Pull a last frame with ffmpeg:

```
ffmpeg -sseof -0.04 -i clip-01.mp4 -frames:v 1 -update 1 last-01.png
```

If a clip drifts (color shift, fruit changes shape, an extra object appears), regenerate that clip only, from the same start image. Never regenerate the whole chain.

Name the finished clips `clip-01.mp4` through `clip-04.mp4` in one folder, then run `higgsfield/extract-frames.sh <that-folder>` (or the `.ps1` on Windows).

## Beat map

| Beat | Scroll progress | Frames | On screen | Caption |
| --- | --- | --- | --- | --- |
| 1 | 0.00 to 0.28 | 1 to 27 | Whole orange, dawn light | Squeezed at 5 a.m. At your door by 8. |
| 2 | 0.28 to 0.58 | 28 to 55 | Cross-section revealed and turning | Never heated. Never from concentrate. |
| 3 | 0.58 to 0.86 | 56 to 82 | Drops fall, juice level rises | Three days fresh. That's the point. |
| 4 | 0.86 to 1.00 | 83 to 96 | Full orange field, glow | Pick your first box. |

The progress numbers are `BEATS` in `js/main.js`. Move them there if the footage lands its beats at different times, don't recut the footage to match the code.

## Using the Higgsfield MCP from Claude

Connector URL: `https://mcp.higgsfield.ai/mcp`. Add it under Customize, then Connectors, name it Higgsfield, and enable it for the chat. Then the prompts above can be sent straight from the conversation: generate the hero still, generate clip 1 from it, and so on. Download the four clips and run the extract script.
