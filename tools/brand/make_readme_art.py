#!/usr/bin/env python3
"""Generates the README artwork as SVG with outlined text (so it looks the same everywhere).

    python3 tools/brand/make_readme_art.py            # writes assets/readme/*.svg

Outputs, each in a dark and a light variant (README picks with <picture>):
    banner-*.svg   hero banner
    flow-*.svg     scan -> review -> clean -> undo
    layers-*.svg   what stands between a rule and your files
"""
import math, pathlib, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

HERE = pathlib.Path(__file__).parent
ROOT = HERE.parent.parent
OUT = ROOT / "assets" / "readme"
OUT.mkdir(parents=True, exist_ok=True)

SANS = TTFont(HERE / "fonts" / "switzer-600-normal.woff2")
SANS_REG = TTFont(HERE / "fonts" / "switzer-400-normal.woff2")
MONO = TTFont(ROOT / "apps" / "gui" / "public" / "fonts" / "geist-mono-500-normal.woff2")

THEMES = {
    "dark": dict(ground="#0E1012", surface="#15181B", raised="#1B1F23", ink="#ECEEF0", muted="#8B939B",
                 line="#2A2E33", red="#FF3B2F", shaving="#E8D2AE"),
    "light": dict(ground="#F1F1EE", surface="#E8E8E4", raised="#FFFFFF", ink="#0E1012", muted="#5B6168",
                  line="#CFCFCA", red="#E5281C", shaving="#8A6A35"),
}


def text(font, s, size, x, y, fill, tracking=-0.03, anchor="start"):
    """Outlined text. Returns an SVG <path>. Kerning is not applied, tracking compensates."""
    gs = font.getGlyphSet()
    cmap = font.getBestCmap()
    upm = font["head"].unitsPerEm
    k = size / upm
    adv = []
    for ch in s:
        g = cmap.get(ord(ch)) or cmap.get(ord("?"))
        adv.append((g, gs[g].width * k + tracking * size))
    total = sum(a for _, a in adv) - tracking * size
    cx = x - (total if anchor == "end" else total / 2 if anchor == "middle" else 0)
    parts = []
    for g, a in adv:
        pen = SVGPathPen(gs, ntos=lambda v: ('%.1f' % v).rstrip('0').rstrip('.'))
        gs[g].draw(TransformPen(pen, (k, 0, 0, -k, cx, y)))
        d = pen.getCommands()
        if d:
            parts.append(d)
        cx += a
    return f'<path d="{" ".join(parts)}" fill="{fill}"/>'


def shaving(turns=1.3, r_start=95.0, thick=30.0, gap=22.0, plank=125.0, taper=0.55, bevel=26.0, cutw=24.0):
    """Same geometry as make_logo.py, returned as raw polygons."""
    k = (thick + gap) / (2 * math.pi)
    pts, w = [], []
    for i in range(40):
        pts.append((-plank + plank * i / 40, 0.0)); w.append(thick)
    cx, cy = 0.0, -r_start
    phi_max = 2 * math.pi * turns
    n = 420
    for i in range(n + 1):
        ph = phi_max * i / n
        r = r_start - k * ph
        pts.append((cx + r * math.sin(ph), cy + r * math.cos(ph)))
        w.append(thick * (1 - taper * (i / n) ** 2))
    left, right = [], []
    for i, (x, y) in enumerate(pts):
        a = pts[max(i - 1, 0)]; b = pts[min(i + 1, len(pts) - 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        nn = math.hypot(dx, dy) or 1
        nx, ny = -dy / nn, dx / nn
        h = w[i] / 2
        left.append((x + nx * h, y + ny * h)); right.append((x - nx * h, y - ny * h))
    left[0] = (left[0][0] + bevel, left[0][1])
    body = left + right[::-1]
    tx, ty = right[0]; bx, by = left[0]
    cut = [(tx - cutw, ty), (tx, ty), (bx, by), (bx - cutw, by)]
    return body, cut


def mark(cx, cy, size, ink, red, opacity=1.0):
    body, cut = shaving()
    xs = [p[0] for poly in (body, cut) for p in poly]; ys = [p[1] for poly in (body, cut) for p in poly]
    s = size / max(max(xs) - min(xs), max(ys) - min(ys))
    mx, my = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    f = lambda poly: "M" + " L".join(f"{(x - mx) * s + cx:.1f} {(y - my) * s + cy:.1f}" for x, y in poly) + " Z"
    return f'<g opacity="{opacity}"><path d="{f(body)}" fill="{ink}"/><path d="{f(cut)}" fill="{red}"/></g>'


def svg(w, h, body, label):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="{label}">'
            f'{body}</svg>\n')


# ------------------------------------------------------------------ banner
def banner(t):
    W, H = 1600, 560
    b = [f'<rect width="{W}" height="{H}" fill="{t["ground"]}"/>']
    # a bevelled band, the 28 degree cut of the brand, very quiet
    b.append(f'<path d="M1010 0 L1600 0 L1600 560 L{1010 - 560 * 0.53:.0f} 560 Z" fill="{t["surface"]}"/>')
    b.append(mark(1300, 280, 372, t["ink"], t["red"]))
    b.append(mark(150, 118, 58, t["ink"], t["red"]))
    b.append(text(SANS, "whittle", 44, 196, 134, t["ink"], tracking=-0.03))
    b.append(text(SANS, "Shave your Mac", 96, 120, 292, t["ink"], tracking=-0.045))
    b.append(text(SANS, "down to what you use.", 96, 120, 396, t["ink"], tracking=-0.045))
    b.append(text(SANS_REG, "Find leftovers. Clear caches. Tidy folders. Undo anything.", 30, 124, 466, t["muted"], tracking=-0.005))
    return svg(W, H, "".join(b), "Whittle: shave your Mac down to what you use")


# ------------------------------------------------------------------ flow
def flow(t):
    W, H = 1600, 430
    b = [f'<rect width="{W}" height="{H}" fill="{t["ground"]}"/>']
    steps = [
        ("01", "Scan", ["Reads only.", "Changes nothing."]),
        ("02", "Review", ["Every item, with the", "reason it is listed."]),
        ("03", "Clean", ["Moves to quarantine.", "Nothing is deleted yet."]),
        ("04", "Undo", ["One click puts it back.", "Space frees after 30 days."]),
    ]
    cw, gap, x0, y0, ch = 340, 50, 45, 70, 290
    for i, (n, title, lines) in enumerate(steps):
        x = x0 + i * (cw + gap)
        last = i == len(steps) - 1
        b.append(f'<rect x="{x}" y="{y0}" width="{cw}" height="{ch}" rx="12" fill="{t["surface"]}" stroke="{t["line"]}" stroke-width="2"/>')
        # bevelled red sliver on the left edge of every card, the brand's cut
        b.append(f'<path d="M{x} {y0 + 12} Q{x} {y0} {x + 12} {y0} L{x + 24} {y0} L{x + 8} {y0 + ch} L{x + 12} {y0 + ch} Q{x} {y0 + ch} {x} {y0 + ch - 12} Z" fill="{t["red"] if last else t["shaving"]}" opacity="{1 if last else .9}"/>')
        b.append(text(MONO, n, 24, x + 48, y0 + 62, t["muted"], tracking=0.02))
        b.append(text(SANS, title, 58, x + 48, y0 + 140, t["ink"], tracking=-0.035))
        for j, ln in enumerate(lines):
            b.append(text(SANS_REG, ln, 23, x + 44, y0 + 198 + j * 34, t["muted"], tracking=0))
        if not last:
            ax = x + cw + 12
            b.append(f'<path d="M{ax} {y0 + ch / 2} h28 m-10 -10 l10 10 l-10 10" fill="none" stroke="{t["muted"]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>')
    return svg(W, H, "".join(b), "Scan, review, clean, undo")


# ------------------------------------------------------------------ layers
def layers(t):
    W, H = 1600, 360
    b = [f'<rect width="{W}" height="{H}" fill="{t["ground"]}"/>']
    items = [
        ("RULE", "A rule says where to look"),
        ("SAFETY LAYER", "Refuses system paths, git data, real apps, your libraries"),
        ("PLAN", "You see every action before it runs"),
        ("JOURNAL", "Every step is written down, append-only"),
        ("QUARANTINE", "Nothing is deleted. Undo is one command"),
    ]
    n = len(items)
    cw = (W - 140 - (n - 1) * 24) / n
    for i, (k, v) in enumerate(items):
        x = 70 + i * (cw + 24)
        hot = k == "SAFETY LAYER"
        b.append(f'<rect x="{x:.0f}" y="60" width="{cw:.0f}" height="240" rx="12" fill="{t["surface"]}" stroke="{t["red"] if hot else t["line"]}" stroke-width="{3 if hot else 2}"/>')
        b.append(text(MONO, f"0{i + 1}", 20, x + 28, 112, t["muted"], tracking=0.02))
        b.append(text(MONO, k, 22 if len(k) < 9 else 18, x + 28, 168, t["red"] if hot else t["shaving"], tracking=0.04))
        # wrap description on spaces to ~22 chars
        words, line, lines = v.split(), "", []
        for w_ in words:
            if len(line) + len(w_) + 1 > 22 and line:
                lines.append(line); line = w_
            else:
                line = (line + " " + w_).strip()
        lines.append(line)
        for j, ln in enumerate(lines[:4]):
            b.append(text(SANS_REG, ln, 22, x + 28, 208 + j * 28, t["ink"], tracking=0))
    return svg(W, H, "".join(b), "Rule, safety layer, plan, journal, quarantine")


for name, fn in (("banner", banner), ("flow", flow), ("layers", layers)):
    for variant, t in THEMES.items():
        p = OUT / f"{name}-{variant}.svg"
        p.write_text(fn(t))
        print("wrote", p.relative_to(ROOT), p.stat().st_size // 1024, "KiB")
