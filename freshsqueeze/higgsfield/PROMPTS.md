# Higgsfield footage for the Fresh Squeeze stage

What was actually generated, with the exact prompts, so it can be re-run or extended.

## Approach

Four keyframes first, then four 5-second clips that interpolate keyframe to keyframe. Because clip N ends on the same still that clip N+1 starts from, every boundary is seamless and no last-frame extraction is needed. The site samples 96 frames across the 20 seconds and scrubs them with scroll.

| Beat | Clip | Start | End | Caption sits on |
| --- | --- | --- | --- | --- |
| 1 | clip-01 | K0 whole melon | K0 whole melon | dark ground, light text |
| 2 | clip-02 | K0 whole melon | K1 split | dark ground, light text |
| 3 | clip-03 | K1 split | K2 pour | dark ground, red rising |
| 4 | clip-04 | K2 pour | K3 full red field | saturated red, light text and a black button |

Composition rule in every prompt: subject at about 60 percent of frame width, the left 40 percent quiet and dark. The page keeps that column on screen at every viewport size and puts the captions in it.

## Models and cost

| Step | Model | Settings | Credits |
| --- | --- | --- | --- |
| K0 hero still | gpt_image_2_5 | 16:9, default quality, 1k | ~3 |
| K1, K2, K3 edits | gpt_image_2_5 | 16:9, quality medium, 2k, K0 as image_references | ~5 each |
| clips 1 to 4 | minimax_h3 | 16:9, 5 s, 2K, start_image + end_image | 10 each |

MiniMax H3 was the cheapest model that takes both a start and an end image (FLUX 3 Video was 27.5 at 720p, 45 at 1080p). If Higgsfield answers a submission with a preset recommendation instead of a job, resubmit the same request with `declined_preset_id` set to that preset's id.

## K0 · hero still (text to image)

```
Photoreal macro product photograph of a single whole watermelon resting on a matte charcoal-black surface, against a near-black studio backdrop that fades to a faint deep forest green at the edges. Hard tropical key light from the top left, soft rim light on the right edge. Glossy dark-green striped rind with fine dew droplets, a small curled dry stem on top. The watermelon is positioned at about 60 percent of the frame width, slightly right of center; the left 40 percent of the frame is empty, quiet and dark. Slight low camera angle, 85mm lens, shallow depth of field, cinematic, no text, no logos, no hands, no other fruit.
```

## K1 · split (edit of K0)

```
Edit the reference image. Keep the exact same camera angle, lens, lighting, matte black surface, dark backdrop and the same watermelon position at about 60 percent of frame width. The watermelon has now been sliced cleanly in half along its equator. The front half sits facing the camera showing a perfect cross-section: vivid red glistening flesh, a scatter of black seeds, a thin white inner rind ring and the green striped outer rind. The back half sits slightly behind and to the right, out of focus. Fine juice droplets on the black surface. Left 40 percent of frame stays empty and dark. Photoreal, no text, no logos, no hands.
```

## K2 · pour (edit of K0)

```
Edit the reference image. Same camera angle, lens, top-left key light, black surface, dark backdrop and watermelon position at about 60 percent of frame width. The watermelon is cut in half and the front half, cross-section facing camera, is lifted slightly above a rising flood of bright red watermelon juice. Heavy red drops fall from its lower edge. The juice surface fills the bottom 45 percent of the frame with a soft rolling wave catching the key light, and a warm red glow reflects up onto the dark backdrop. The lifted half is softening out of focus. Left 40 percent of frame stays quiet and dark above the juice. Photoreal, no text, no logos, no hands.
```

## K3 · full field (edit of K0)

```
Edit the reference image. Same lighting direction from top left. The entire frame is now filled edge to edge with luminous watermelon-red juice, calm and nearly flat, seen from just above the surface, a soft warm highlight at the upper right, a few tiny black seeds suspended and slow tiny bubbles rising. No fruit, no black surface, no backdrop visible anywhere. Photoreal, saturated red, no text, no logos, no hands.
```

## clip-01 · hold (K0 to K0)

```
Locked-off camera, no camera movement. A whole watermelon rests on a matte black surface under a hard top-left key light against a near-black backdrop. Almost nothing moves: fine dust motes drift slowly through the beam of light, dew droplets on the rind glisten and one droplet slowly runs down the side, the faint deep-green glow on the backdrop breathes very slightly brighter then back. Photoreal product film, slow, calm, no cuts, no hands, no text, no new objects.
```

## clip-02 · split (K0 to K1)

```
Locked-off camera, same top-left key light, same black surface and dark backdrop. The whole watermelon is sliced cleanly in half along its equator by an unseen blade. The front half tips forward and settles facing the camera, revealing the glistening red cross-section with black seeds and the white inner rind ring; the back half settles slightly behind and to the right. A few fine juice droplets land on the black surface. Photoreal, slow and deliberate, no cuts, no hands, no text.
```

## clip-03 · pour (K1 to K2)

```
Locked-off camera, same lighting. The front watermelon half lifts up off the surface and tilts toward the camera as heavy red juice begins to pour from its cut face in thick drops and streams. Below it, a flood of bright red watermelon juice rises from the bottom of the frame with slow rolling waves, and a warm red glow spreads up across the dark backdrop. Slow-motion feel, photoreal, no cuts, no hands, no text.
```

## clip-04 · fill (K2 to K3)

```
The red watermelon juice keeps rising with slow rolling waves until it fills the entire frame edge to edge. The watermelon halves sink beneath the surface and disappear. The camera tilts gently downward to look across the calm, luminous red surface with a few black seeds suspended in it and tiny bubbles rising slowly. Warm highlight at the upper right. Photoreal, smooth, no cuts, no text.
```

## Getting the media into the repo

Generated files live on Higgsfield's CDN. `media.json` in this folder lists what to pull, and the GitHub Action in `.github/workflows/fetch-media.yml` runs on every push that changes it: it fetches the listed keyframes into `keyframes/`, downloads the listed clips, runs `extract-frames.sh` on them, and commits the resulting `frames/` back to the same branch.

```
{
  "files": [{"url": "https://...png", "path": "freshsqueeze/higgsfield/keyframes/k0-whole.jpg"}],
  "clips": ["https://...clip-01.mp4", "https://...clip-02.mp4", "https://...clip-03.mp4", "https://...clip-04.mp4"],
  "count": 96
}
```

Working locally with ffmpeg installed, skip the Action: download the clips as `clip-01.mp4` to `clip-04.mp4` and run `extract-frames.sh <folder>` (or the `.ps1` on Windows).

## Caption sync

The four caption switch points are `BEATS` in `js/main.js`. With four equal 5-second clips the natural boundaries are 0.25, 0.50 and 0.75 of scroll progress. They were tuned after watching the footage so each caption changes just after the picture does; move them there if the clips are regenerated.

## Re-generating a single beat

Regenerate the keyframe first (edit of K0 so the scene holds), then only the two clips that touch it. Never regenerate the whole chain to fix one beat.
