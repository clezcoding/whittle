#!/usr/bin/env python3
"""Generates the Whittle brand assets (mark, wordmark, lockup, app icon) as SVG.

Mark: a wood shaving. One ribbon runs flat along the board, rolls up into a curl and thins out.
The red sliver at the start is the knife cut (fresh wood / Swiss red). The wordmark's i-dot is
the same red.
"""
import math, sys, pathlib
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "../assets/brand")
OUT.mkdir(parents=True, exist_ok=True)
FONT = pathlib.Path(__file__).parent / "fonts" / "switzer-600-normal.woff2"

INK = "#ECEEF0"       # blade steel
INK_DARK = "#0E1012"  # graphite
RED = "#FF3B2F"       # swiss red, only ever the cut

# ------------------------------------------------------------------ the shaving
def shaving(turns=1.3, r_start=95.0, thick=30.0, gap=22.0, plank=125.0, taper=0.55, bevel=26.0, cutw=24.0):
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
    # knife bevel on the cut end: bottom edge starts further right than the top edge
    left[0] = (left[0][0] + bevel, left[0][1])
    body = left + right[::-1]
    top_x, top_y = right[0]; bot_x, bot_y = left[0]
    cut = [(top_x - cutw, top_y), (top_x, top_y), (bot_x, bot_y), (bot_x - cutw, bot_y)]
    return body, cut, pts

def fit(polys, size, fill, dx=0.0, dy=0.0):
    xs = [p[0] for poly in polys for p in poly]; ys = [p[1] for poly in polys for p in poly]
    mnx, mxx, mny, mxy = min(xs), max(xs), min(ys), max(ys)
    s = size * fill / max(mxx - mnx, mxy - mny)
    cx, cy = (mnx + mxx) / 2, (mny + mxy) / 2
    f = lambda poly: [((x - cx) * s + size / 2 + dx, (y - cy) * s + size / 2 + dy) for x, y in poly]
    return [f(p) for p in polys], s, (mnx, mxx, mny, mxy)

def d_of(poly):
    return "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in poly) + " Z"

def mark_group(size, fill, ink, red, dx=0.0, dy=0.0):
    body, cut, _c = shaving()
    (b, c), s, _ = fit([body, cut], size, fill, dx, dy)
    return f'<path d="{d_of(b)}" fill="{ink}"/><path d="{d_of(c)}" fill="{red}"/>'

def mark_svg(ink=INK, red=RED, size=512, fill=0.84):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}" role="img" aria-label="Whittle">'
            f'{mark_group(size, fill, ink, red)}</svg>')

def app_icon_svg(size=1024):
    pad = size * 0.098; box = size - 2 * pad; rad = box * 0.2237
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}" role="img" aria-label="Whittle">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1D2125"/><stop offset="1" stop-color="#0A0C0E"/></linearGradient>
<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>
<rect x="{pad}" y="{pad}" width="{box}" height="{box}" rx="{rad}" fill="url(#g)"/>
<rect x="{pad+1}" y="{pad+1}" width="{box-2}" height="{box-2}" rx="{rad-1}" fill="none" stroke="url(#s)" stroke-width="2"/>
{mark_group(size, 0.56, INK, RED, dy=-8)}
</svg>'''

# ------------------------------------------------------------------ wordmark
def wordmark_parts(text="whittle", track=-0.03):
    f = TTFont(str(FONT))
    gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f["head"].unitsPerEm; hmtx = f["hmtx"]
    x = 0.0; paths = []; tittle = None
    for ch in text:
        gn = "dotlessi" if ch == "i" else cmap[ord(ch)]
        pen = SVGPathPen(gs)
        gs[gn].draw(TransformPen(pen, (1, 0, 0, -1, x, 0)))
        paths.append(pen.getCommands())
        if ch == "i":
            bp = BoundsPen(gs); gs[gn].draw(bp)
            x0, y0, x1, y1 = bp.bounds
            r = (x1 - x0) * 0.66 / 2
            tittle = (x + (x0 + x1) / 2, -(y1 + 78 + r), r)
        x += hmtx[gn][0] + track * upm
    width = x - track * upm
    return " ".join(paths), tittle, width

ASC, DESC = 760, 20

def wordmark_svg(ink=INK, red=RED, height=160):
    d, t, width = wordmark_parts()
    pad = 30
    vb = (-pad, -ASC - pad, width + 2 * pad, ASC + DESC + 2 * pad)
    sc = height / vb[3]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb[0]:.0f} {vb[1]:.0f} {vb[2]:.0f} {vb[3]:.0f}" '
            f'width="{vb[2]*sc:.0f}" height="{height}" role="img" aria-label="Whittle">'
            f'<path d="{d}" fill="{ink}"/><circle cx="{t[0]:.1f}" cy="{t[1]:.1f}" r="{t[2]:.1f}" fill="{red}"/></svg>')

def lockup_svg(ink=INK, red=RED):
    """Mark + wordmark, optically aligned: mark height equals the ascender-to-baseline height."""
    d, t, width = wordmark_parts()
    body, cut, _c = shaving()
    xs = [p[0] for poly in (body, cut) for p in poly]; ys = [p[1] for poly in (body, cut) for p in poly]
    mnx, mxx, mny, mxy = min(xs), max(xs), min(ys), max(ys)
    mark_h = 600.0                      # mark sits on the baseline, a bit under ascender height
    ms = mark_h / (mxy - mny)
    mw = (mxx - mnx) * ms
    tf = lambda poly: [((x - mnx) * ms, (y - mxy) * ms) for x, y in poly]
    mb, mc = tf(body), tf(cut)
    gapx = 90
    ox = mw + gapx
    pad = 30
    W = ox + width + 2 * pad; H = ASC + DESC + 2 * pad
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-pad} {-ASC-pad} {W:.0f} {H:.0f}" width="{W*0.16:.0f}" height="{H*0.16:.0f}" role="img" aria-label="Whittle">'
            f'<path d="{d_of(mb)}" fill="{ink}"/><path d="{d_of(mc)}" fill="{red}"/>'
            f'<g transform="translate({ox:.1f} 0)"><path d="{d}" fill="{ink}"/><circle cx="{t[0]:.1f}" cy="{t[1]:.1f}" r="{t[2]:.1f}" fill="{red}"/></g></svg>')

files = {
    "mark.svg": mark_svg(),
    "mark-light.svg": mark_svg(ink=INK_DARK),
    "mark-mono.svg": mark_svg(ink="#000", red="#000"),
    "app-icon.svg": app_icon_svg(),
    "wordmark.svg": wordmark_svg(),
    "wordmark-light.svg": wordmark_svg(ink=INK_DARK),
    "lockup.svg": lockup_svg(),
    "lockup-light.svg": lockup_svg(ink=INK_DARK),
}
for name, svg in files.items():
    (OUT / name).write_text(svg)
    print("wrote", name, len(svg), "bytes")


# ---- geometry for the app: body, cut and centerline in a 512 box, for the animated curl
def emit_ts(path):
    body, cut, center = shaving()
    (b, c, cl), s, _ = fit([body, cut, center], 512, 0.84)
    def d(poly, close=True):
        return "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in poly) + (" Z" if close else "")
    pathlib.Path(path).parent.mkdir(parents=True, exist_ok=True)
    pathlib.Path(path).write_text(
        "// Generated by tools/brand/make_logo.py. Do not edit by hand.\n"
        f"export const CURL_BODY = '{d(b)}'\n"
        f"export const CURL_CUT = '{d(c)}'\n"
        f"export const CURL_CENTER = '{d(cl[::4] + [cl[-1]], close=False)}'\n"
        f"export const CURL_STROKE = {40 * s:.1f}\n"
    )
    print("wrote", path)

if len(sys.argv) > 2:
    emit_ts(sys.argv[2])
