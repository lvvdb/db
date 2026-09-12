#!/usr/bin/env python3
"""Procedural stand-in frames for the Fresh Squeeze scroll stage.

Same output contract as higgsfield/extract-frames.sh:
  frames/frame_0001.jpg ... frames/frame_NNNN.jpg
  frames/poster.jpg   (copy of frame 1, shown before JS runs)
  frames/manifest.js  (count + naming pattern the page reads)

Once the Higgsfield clips are extracted, this output is simply overwritten.

Usage: python3 tools/make-placeholder-frames.py [--count 96] [--out frames]
Requires Pillow (pip install pillow).
"""
import argparse
import math
import os
import random
import shutil

from PIL import Image, ImageDraw, ImageOps

W, H = 1280, 720
SS = 2  # supersample factor for anti-aliasing
FW, FH = W * SS, H * SS

# Beat boundaries, kept in sync with BEATS in js/main.js
B1, B2, B3 = 0.28, 0.58, 0.86

NIGHT_TOP = (9, 28, 22)
NIGHT_BOT = (22, 52, 40)
DAWN_BOT = (52, 88, 60)
DUSK_TOP = (26, 44, 38)
DUSK_BOT = (128, 60, 22)
POUR_TOP = (58, 40, 30)
ORANGE = (255, 122, 26)
ORANGE_HI = (255, 184, 96)
ORANGE_LO = (170, 58, 6)
CREAM = (255, 234, 198)
WEDGE_A = (255, 140, 44)
WEDGE_B = (255, 168, 64)
LEAF = (66, 132, 78)
LEAF_DARK = (30, 78, 46)
JUICE = (255, 122, 26)
JUICE_TOP = (255, 164, 70)
GLOW = (255, 206, 130)


def lerp(a, b, t):
    return a + (b - a) * t


def clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def span(t, a, b):
    return clamp((t - a) / (b - a))


def ease_out(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3


def ease_in(t):
    t = clamp(t)
    return t * t


def ease_in_out(t):
    t = clamp(t)
    return t * t * (3 - 2 * t)


def mix(c1, c2, t):
    return tuple(int(round(lerp(a, b, t))) for a, b in zip(c1, c2))


def vgrad(size, top, bottom):
    g = Image.linear_gradient("L").resize(size)
    return ImageOps.colorize(g, black=top, white=bottom)


def radial(size):
    return Image.radial_gradient("L").resize(size)


def scaled_alpha(img, alpha):
    if alpha >= 1:
        return img
    out = img.copy()
    out.putalpha(out.getchannel("A").point(lambda a: int(a * alpha)))
    return out


def paste_center(dst, sprite, cx, cy, scale=1.0, angle=0.0, alpha=1.0):
    if scale <= 0.01 or alpha <= 0.01:
        return
    s = sprite
    if angle:
        s = s.rotate(angle, resample=Image.BICUBIC)
    if scale != 1.0:
        s = s.resize((max(1, int(s.width * scale)), max(1, int(s.height * scale))), Image.LANCZOS)
    s = scaled_alpha(s, alpha)
    dst.alpha_composite(s, (int(cx - s.width / 2), int(cy - s.height / 2)))


def make_sphere(R):
    """A whole orange: shaded sphere, peel dimples, stem and one leaf."""
    S = int(R * 2.7)
    c = S // 2
    body = Image.new("RGBA", (S, S), ORANGE + (255,))
    shade = ImageOps.colorize(radial((int(R * 3.4), int(R * 3.4))), black=ORANGE_HI, white=ORANGE_LO).convert("RGBA")
    body.paste(shade, (int(c - 0.38 * R - shade.width / 2), int(c - 0.42 * R - shade.height / 2)))

    dimples = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    dd = ImageDraw.Draw(dimples)
    rng = random.Random(7)
    for _ in range(1100):
        a = rng.random() * math.tau
        r = R * math.sqrt(rng.random()) * 0.97
        x, y = c + r * math.cos(a), c + r * math.sin(a)
        s = rng.uniform(1.1, 2.4) * SS
        dd.ellipse((x - s, y - s, x + s, y + s), fill=(120, 40, 5, 34))
    body = Image.alpha_composite(body, dimples)

    rim = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    rim_alpha = radial((2 * R, 2 * R)).point(lambda v: int(clamp((v - 150) / 105) * 230))
    rim_col = Image.new("RGBA", (2 * R, 2 * R), (80, 26, 0, 255))
    rim_col.putalpha(rim_alpha)
    rim.paste(rim_col, (c - R, c - R))
    body = Image.alpha_composite(body, rim)

    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).ellipse((c - R, c - R, c + R, c + R), fill=255)
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    img.paste(body, (0, 0), mask)

    d = ImageDraw.Draw(img)
    d.ellipse((c - 0.07 * R, c - R - 0.06 * R, c + 0.07 * R, c - R + 0.08 * R), fill=LEAF_DARK)
    base = (c + 0.02 * R, c - R + 0.02 * R)
    ang = math.radians(-52)
    dx, dy = math.cos(ang), math.sin(ang)
    nx, ny = -dy, dx
    L = 0.85 * R
    top, bot = [], []
    for k in range(25):
        u = k / 24
        w = 0.24 * R * math.sin(math.pi * u)
        px, py = base[0] + dx * L * u, base[1] + dy * L * u
        top.append((px + nx * w, py + ny * w))
        bot.append((px - nx * w, py - ny * w))
    d.polygon(top + bot[::-1], fill=LEAF)
    d.line([base, (base[0] + dx * L * 0.92, base[1] + dy * L * 0.92)], fill=LEAF_DARK, width=int(2.5 * SS))
    return img


def make_slice(R):
    """Cross-section: rind, pith ring, ten wedges, membranes, vesicle texture."""
    S = int(R * 2.3)
    c = S // 2
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((c - R, c - R, c + R, c + R), fill=(255, 150, 58, 255))
    rp = R * 0.93
    d.ellipse((c - rp, c - rp, c + rp, c + rp), fill=CREAM + (255,))
    ri = R * 0.84
    n = 10
    for k in range(n):
        a0 = k * 360 / n
        d.pieslice((c - ri, c - ri, c + ri, c + ri), a0, a0 + 360 / n, fill=(WEDGE_A if k % 2 == 0 else WEDGE_B) + (255,))
    tex = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    td = ImageDraw.Draw(tex)
    rng = random.Random(3)
    for _ in range(1600):
        a = rng.random() * math.tau
        r = ri * math.sqrt(rng.random()) * 0.97
        x, y = c + r * math.cos(a), c + r * math.sin(a)
        s = rng.uniform(1.0, 2.4) * SS
        td.ellipse((x - s, y - s, x + s, y + s), fill=(255, 214, 140, 72))
    img = Image.alpha_composite(img, tex)
    d = ImageDraw.Draw(img)
    for k in range(n):
        a = math.radians(k * 360 / n)
        d.line((c, c, c + ri * math.cos(a), c + ri * math.sin(a)), fill=CREAM + (255,), width=int(5 * SS))
    d.ellipse((c - 0.08 * R, c - 0.08 * R, c + 0.08 * R, c + 0.08 * R), fill=CREAM + (255,))
    # edge darkening, clipped to the disc so the sprite's corners stay clear
    depth = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    dep_alpha = radial((2 * R, 2 * R)).point(lambda v: int(clamp((v - 120) / 135) * 110))
    disc = Image.new("L", (2 * R, 2 * R), 0)
    ImageDraw.Draw(disc).ellipse((0, 0, 2 * R - 1, 2 * R - 1), fill=255)
    dep_alpha = Image.eval(Image.merge("L", [dep_alpha]), lambda v: v)
    dep_alpha.paste(0, (0, 0, 2 * R, 2 * R), ImageOps.invert(disc))
    dep_col = Image.new("RGBA", (2 * R, 2 * R), (120, 40, 0, 255))
    dep_col.putalpha(dep_alpha)
    depth.paste(dep_col, (c - R, c - R))
    return Image.alpha_composite(img, depth)


def liquid_polygon(level, amp, phase, offset=0):
    pts = []
    step = 8 * SS
    for x in range(0, FW + step, step):
        y = level + offset + amp * math.sin(math.tau * (x / FW) * 2.0 + phase) + amp * 0.4 * math.sin(math.tau * (x / FW) * 5.0 - phase * 1.7)
        pts.append((x, y))
    pts.append((FW + step, FH + 10))
    pts.append((0, FH + 10))
    return pts


def draw_drop(d, x, y, r):
    d.ellipse((x - r, y - r, x + r, y + r), fill=JUICE_TOP + (255,))
    d.polygon([(x - r * 0.95, y - r * 0.3), (x + r * 0.95, y - r * 0.3), (x, y - r * 2.2)], fill=JUICE_TOP + (255,))
    d.ellipse((x - r * 0.45, y - r * 0.55, x - r * 0.1, y - r * 0.15), fill=(255, 236, 200, 255))


def render(t, sphere, slc, drops, bubbles):
    # background
    if t < B1:
        top, bot = NIGHT_TOP, mix(NIGHT_BOT, DAWN_BOT, span(t, 0, B1))
    elif t < B2:
        k = span(t, B1, B2)
        top, bot = mix(NIGHT_TOP, DUSK_TOP, k), mix(DAWN_BOT, DUSK_BOT, k)
    else:
        k = span(t, B2, B3)
        top, bot = mix(DUSK_TOP, POUR_TOP, k), DUSK_BOT
    frame = vgrad((FW, FH), top, bot).convert("RGBA")

    FX = 0.6 * FW
    R = int(0.27 * FH)

    # whole orange rises in, recedes as the slice takes over
    if t < 0.52:
        rise = ease_out(span(t, 0.0, 0.22))
        y = lerp(1.18 * FH, 0.5 * FH, rise)
        sc = lerp(0.9, 1.0, rise)
        recede = ease_in_out(span(t, B1, 0.5))
        x = lerp(FX, 0.76 * FW, recede)
        y = lerp(y, 0.58 * FH, recede)
        sc = lerp(sc, 0.62, recede)
        alpha = 1 - span(t, 0.36, 0.52)
        paste_center(frame, sphere, x, y, sc, 0, alpha)

    # cross-section grows, turns slowly, lifts as juice rises, fades under it
    if 0.26 <= t < 0.90:
        grow = ease_out(span(t, 0.26, 0.42))
        sc = lerp(0.18, 1.0, grow)
        lift = ease_in_out(span(t, B2, B3))
        cy = lerp(0.5 * FH, 0.4 * FH, lift)
        sc = lerp(sc, sc * 0.86, lift)
        angle = -14 + 46 * span(t, 0.26, 0.86)
        alpha = min(span(t, 0.26, 0.34), 1 - span(t, 0.80, 0.90))
        paste_center(frame, slc, FX, cy, sc, angle, alpha)

    # droplets fall from the slice toward the rising surface
    if B2 - 0.06 <= t < B3:
        layer = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        for (xo, t0, dur, r) in drops:
            k = span(t, t0, t0 + dur)
            if 0 < k < 1:
                lift = ease_in_out(span(t, B2, B3))
                y0 = lerp(0.5 * FH, 0.4 * FH, lift) + R * 0.9
                lvl = lerp(1.05 * FH, 0.45 * FH, ease_in_out(span(t, B2, B3)))
                y = lerp(y0, lvl, ease_in(k))
                draw_drop(d, FX + xo * R, y, r * SS)
        frame = Image.alpha_composite(frame, layer)

    # juice fills the frame
    if t >= B2:
        if t < B3:
            level = lerp(1.05 * FH, 0.45 * FH, ease_in_out(span(t, B2, B3)))
            amp = 14 * SS
        else:
            level = lerp(0.45 * FH, -0.12 * FH, ease_in_out(span(t, B3, 0.96)))
            amp = 14 * SS * (1 - span(t, B3, 0.96))
        phase = t * 42
        layer = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        d.polygon(liquid_polygon(level, amp, phase), fill=JUICE_TOP + (255,))
        d.polygon(liquid_polygon(level, amp, phase, offset=16 * SS), fill=JUICE + (255,))
        frame = Image.alpha_composite(frame, layer)

    # final beat: warm glow and slow bubbles
    if t >= B3:
        k = span(t, B3, 1.0)
        glow = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        gs = int(1.3 * FH)
        ga = radial((gs, gs)).point(lambda v: int((1 - v / 255) * 200 * ease_out(k)))
        gc = Image.new("RGBA", (gs, gs), GLOW + (255,))
        gc.putalpha(ga)
        glow.paste(gc, (int(FX - gs / 2), int(0.38 * FH - gs / 2)))
        frame = Image.alpha_composite(frame, glow)
        layer = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        for (bx, ph, size, speed) in bubbles:
            u = (k * speed + ph) % 1.0
            y = FH * (1.02 - u * 1.04)
            r = size * SS * lerp(0.6, 1.0, u)
            a = int(150 * (1 - abs(u - 0.5) * 1.6))
            if a > 0:
                d.ellipse((bx * FW - r, y - r, bx * FW + r, y + r), outline=(255, 226, 180, a), width=int(2 * SS))
        frame = Image.alpha_composite(frame, layer)

    # vignette keeps the left column quiet for captions
    vig_strength = 0.6 if t < B3 else lerp(0.6, 0.18, span(t, B3, 1.0))
    vig = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
    va = radial((int(FW * 1.25), int(FH * 1.6))).point(lambda v: int(clamp((v - 70) / 185) * 255 * vig_strength))
    vc = Image.new("RGBA", va.size, (6, 18, 14, 255))
    vc.putalpha(va)
    vig.paste(vc, (int(FW / 2 - va.width / 2), int(FH / 2 - va.height / 2)))
    frame = Image.alpha_composite(frame, vig)

    return frame.convert("RGB").resize((W, H), Image.LANCZOS)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=96)
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frames"))
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    for f in os.listdir(args.out):
        if f.startswith("frame_") and f.endswith(".jpg"):
            os.remove(os.path.join(args.out, f))

    R = int(0.27 * FH)
    sphere = make_sphere(R)
    slc = make_slice(int(R * 1.08))
    rng = random.Random(11)
    drops = [(rng.uniform(-0.5, 0.5), B2 - 0.06 + i * 0.045, rng.uniform(0.09, 0.14), rng.uniform(9, 16)) for i in range(7)]
    bubbles = [(rng.uniform(0.08, 0.92), rng.random(), rng.uniform(6, 16), rng.uniform(0.6, 1.4)) for _ in range(22)]

    n = args.count
    for i in range(n):
        t = i / (n - 1)
        img = render(t, sphere, slc, drops, bubbles)
        img.save(os.path.join(args.out, f"frame_{i + 1:04d}.jpg"), quality=82, optimize=True, progressive=True)
        if i % 12 == 0 or i == n - 1:
            print(f"frame {i + 1}/{n}", flush=True)

    shutil.copyfile(os.path.join(args.out, "frame_0001.jpg"), os.path.join(args.out, "poster.jpg"))
    with open(os.path.join(args.out, "manifest.js"), "w") as fh:
        fh.write(
            "// Generated. Rewritten by tools/make-placeholder-frames.py and higgsfield/extract-frames.sh.\n"
            f'window.FRESH_FRAMES = {{ count: {n}, dir: "frames", pattern: "frame_{{n}}.jpg", pad: 4, width: {W}, height: {H}, focal: 0.6 }};\n'
        )
    print(f"wrote {n} frames, poster.jpg and manifest.js to {args.out}")


if __name__ == "__main__":
    main()
