#!/usr/bin/env python3
"""Generates the README artwork as SVG with outlined text (so it looks the same everywhere).

    python3 tools/brand/make_readme_art.py            # writes assets/readme/*.svg

Outputs, each in a dark and a light variant (README picks with <picture>):
    banner-*.svg   hero banner
    flow-*.svg     scan -> review -> clean -> undo
    layers-*.svg   what stands between a rule and your files
    scan-*.svg     animated: a scan finds space, a clean quarantines it
    terminal-*.svg animated: scan, clean, undo in a terminal
    risk-*.svg     the three risk levels
    modules-*.svg  the five things Whittle does
    arch-*.svg     rules -> core -> command line and app
    views-*.svg    animated: the eight views of the app
    palette-*.svg  animated: the command palette finding Xcode

The animated files use CSS only (no script, no SMIL). The resting state of every
element is the finished picture, so a viewer that blocks animation, or a reader
who prefers reduced motion, sees a complete image.
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



# ================================================================== motion
class Motion:
    """Collects CSS keyframes for one SVG. Resting state = finished picture."""

    def __init__(self, dur):
        self.dur, self.css, self.n = dur, [], 0

    def _p(self, t):
        return round(max(0.0, min(self.dur, t)) / self.dur * 100, 3)

    def _cls(self):
        self.n += 1
        return f"k{self.n}"

    def _wrap(self, inner, cls):
        return f'<g class="m {cls}">{inner}</g>'

    def show(self, inner, at, until=None, dy=12, fade=0.45):
        """Hidden, then eases in at `at`, stays until `until`, then hides until the loop restarts."""
        c, end = self._cls(), (self.dur - 0.7 if until is None else until)
        a, b, d, e = self._p(at), self._p(at + fade), self._p(end), self._p(end + 0.3)
        kf = f"0%,{a}%{{opacity:0;transform:translateY({dy}px)}}{b}%,{d}%{{opacity:1;transform:none}}"
        kf += f"{e}%,100%{{opacity:0;transform:none}}" if end + 0.3 < self.dur else ""
        # a view that gives way to another one rests hidden; only the last one stays in the still image
        base = "opacity:0;" if until is not None and until < self.dur - 1 else ""
        self.css.append(f".{c}{{{base}animation:{c} {self.dur}s ease-out infinite}}@keyframes {c}{{{kf}}}")
        return self._wrap(inner, c)

    def pulse(self, inner, at, length, peak=1.0):
        """Resting state hidden; visible only in [at, at+length]."""
        c = self._cls()
        a, b, d, e = self._p(at), self._p(at + 0.2), self._p(at + length - 0.2), self._p(at + length)
        self.css.append(f".{c}{{opacity:0;animation:{c} {self.dur}s linear infinite}}"
                        f"@keyframes {c}{{0%,{a}%{{opacity:0}}{b}%,{d}%{{opacity:{peak}}}{e}%,100%{{opacity:0}}}}")
        return self._wrap(inner, c)

    def grow(self, inner, at, length, steps=None):
        """Scales from the left edge, 0 -> 1."""
        c = self._cls()
        a, b = self._p(at), self._p(at + length)
        self.css.append(f".{c}{{transform-box:fill-box;transform-origin:0 50%;animation:{c} {self.dur}s ease-out infinite}}"
                        f"@keyframes {c}{{0%,{a}%{{transform:scaleX(0)}}{b}%,100%{{transform:scaleX(1)}}}}")
        return self._wrap(inner, c)

    def dim(self, inner, at, until, to=0.22, dx=0):
        """Fades to `to` between at and until, then back."""
        c = self._cls()
        a, b, d, e = self._p(at), self._p(at + 0.5), self._p(until), self._p(until + 0.5)
        self.css.append(f".{c}{{animation:{c} {self.dur}s ease-in-out infinite}}"
                        f"@keyframes {c}{{0%,{a}%{{opacity:1;transform:none}}{b}%,{d}%{{opacity:{to};transform:translateX({dx}px)}}{e}%,100%{{opacity:1;transform:none}}}}")
        return self._wrap(inner, c)

    def slide(self, inner, at, length, y0, y1):
        """A beam: hidden, moves y0 -> y1 over [at, at+length], hidden again."""
        c = self._cls()
        a, b, d = self._p(at), self._p(at + length), self._p(at + length + 0.3)
        self.css.append(f".{c}{{opacity:0;animation:{c} {self.dur}s linear infinite}}"
                        f"@keyframes {c}{{0%,{a}%{{opacity:0;transform:translateY({y0}px)}}{self._p(at + .2)}%{{opacity:1}}"
                        f"{b}%{{opacity:1;transform:translateY({y1}px)}}{d}%,100%{{opacity:0;transform:translateY({y1}px)}}}}")
        return self._wrap(inner, c)

    def type_on(self, inner, x, y, w, h, cover, at, length, steps):
        """Typewriter: a cover shrinks from the right edge of the text in `steps` steps."""
        c = self._cls()
        a, b = self._p(at), self._p(at + length)
        self.css.append(f".{c}{{transform-box:fill-box;transform-origin:100% 50%;transform:scaleX(0);animation:{c} {self.dur}s linear infinite}}"
                        f"@keyframes {c}{{0%,{a}%{{transform:scaleX(1);animation-timing-function:steps({steps},end)}}{b}%,100%{{transform:scaleX(0)}}}}")
        return inner + f'<rect class="m {c}" x="{x}" y="{y}" width="{w}" height="{h}" fill="{cover}"/>'

    def enter(self, inner, delay, dy=16, length=0.9):
        """Plays once when the image loads."""
        c = self._cls()
        self.css.append(f".{c}{{animation:{c} {length}s ease-out {delay}s both}}"
                        f"@keyframes {c}{{from{{opacity:0;transform:translateY({dy}px)}}to{{opacity:1;transform:none}}}}")
        return self._wrap(inner, c)

    def loop(self, inner, kf, secs, delay=0.0, ease="ease-in-out", base=""):
        c = self._cls()
        self.css.append(f".{c}{{{base}animation:{c} {secs}s {ease} {delay}s infinite}}@keyframes {c}{{{kf}}}")
        return self._wrap(inner, c)

    def style(self):
        return "<style>" + "".join(self.css) + "@media (prefers-reduced-motion:reduce){.m{animation:none!important}}</style>"


def svg_m(w, h, body, label, m):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="{label}">'
            f'{m.style()}{body}</svg>\n')


def adv(font, size, tracking=0.0):
    """Advance of one glyph (monospace fonts only)."""
    g = font.getBestCmap()[ord("0")]
    return font.getGlyphSet()[g].width * size / font["head"].unitsPerEm + tracking * size


def text_width(font, s_, size, tracking=0.0):
    gs, cmap, upm = font.getGlyphSet(), font.getBestCmap(), font["head"].unitsPerEm
    return sum(gs[cmap.get(ord(ch)) or cmap.get(ord("?"))].width * size / upm + tracking * size for ch in s_) - tracking * size


def wrap_words(v, n):
    words, line, lines = v.split(), "", []
    for w_ in words:
        if len(line) + len(w_) + 1 > n and line:
            lines.append(line); line = w_
        else:
            line = (line + " " + w_).strip()
    lines.append(line)
    return lines


def risk_glyph(kind, cx, cy, r, t):
    """Safe = filled, review = half, manual = ring. Shape carries the meaning, not only colour."""
    if kind == "safe":
        return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{t["shaving"]}"/>'
    if kind == "review":
        return (f'<circle cx="{cx}" cy="{cy}" r="{r - 1}" fill="none" stroke="{t["shaving"]}" stroke-width="2.5"/>'
                f'<path d="M{cx} {cy - r} A{r} {r} 0 0 1 {cx} {cy + r} Z" fill="{t["shaving"]}"/>')
    return f'<circle cx="{cx}" cy="{cy}" r="{r - 1}" fill="none" stroke="{t["red"]}" stroke-width="2.8"/>'


def mark_split(cx, cy, size):
    body, cut = shaving()
    xs = [p[0] for poly in (body, cut) for p in poly]; ys = [p[1] for poly in (body, cut) for p in poly]
    s_ = size / max(max(xs) - min(xs), max(ys) - min(ys))
    mx, my = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    f = lambda poly: "M" + " L".join(f"{(x - mx) * s_ + cx:.1f} {(y - my) * s_ + cy:.1f}" for x, y in poly) + " Z"
    return f(body), f(cut)


# ------------------------------------------------------------------ banner (animated)
def banner_a(t):
    W, H = 1600, 560
    m = Motion(1)
    b = [f'<rect width="{W}" height="{H}" fill="{t["ground"]}"/>',
         f'<path d="M1010 0 L1600 0 L1600 560 L{1010 - 560 * 0.53:.0f} 560 Z" fill="{t["surface"]}"/>']
    body, cut = mark_split(1300, 280, 372)
    big = f'<path d="{body}" fill="{t["ink"]}"/>' + m.loop(f'<path d="{cut}" fill="{t["red"]}"/>', "0%,100%{opacity:1}50%{opacity:.5}", 3.6)
    b.append(m.loop(big, "0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}", 7.0))
    # shavings drifting off the mark
    import random
    rnd = random.Random(7)
    for i in range(9):
        x0, y0 = rnd.uniform(1120, 1470), rnd.uniform(300, 420)
        dx, dy, rot = rnd.uniform(-60, 60), rnd.uniform(130, 190), rnd.uniform(-200, 200)
        dur, delay, w_ = rnd.uniform(5.5, 9), -rnd.uniform(0, 8), rnd.uniform(16, 30)
        shape = f'<rect x="{x0:.0f}" y="{y0:.0f}" width="{w_:.0f}" height="5" rx="2.5" fill="{t["shaving"]}"/>'
        kf = (f"0%{{opacity:0;transform:translate(0,0) rotate(0)}}15%{{opacity:.85}}"
              f"100%{{opacity:0;transform:translate({dx:.0f}px,{dy:.0f}px) rotate({rot:.0f}deg)}}")
        b.append(m.loop(f'<g style="transform-box:fill-box;transform-origin:center">{shape}</g>', kf, dur, delay, "ease-in", "opacity:0;"))
    b.append(m.enter(mark(150, 118, 58, t["ink"], t["red"]) + text(SANS, "whittle", 44, 196, 134, t["ink"], tracking=-0.03), 0.05, 10))
    b.append(m.enter(text(SANS, "Shave your Mac", 96, 120, 292, t["ink"], tracking=-0.045), 0.15))
    b.append(m.enter(text(SANS, "down to what you use.", 96, 120, 396, t["ink"], tracking=-0.045), 0.3))
    b.append(m.enter(text(SANS_REG, "Find leftovers. Clear caches. Tidy folders. Undo anything.", 30, 124, 466, t["muted"], tracking=-0.005), 0.5, 10))
    return svg_m(W, H, "".join(b), "Whittle: shave your Mac down to what you use", m)


# ------------------------------------------------------------------ flow (animated)
def flow_a(t):
    W, H = 1600, 430
    m = Motion(12)
    b = [f'<rect width="{W}" height="{H}" fill="{t["ground"]}"/>']
    steps = [("01", "Scan", ["Reads only.", "Changes nothing."]),
             ("02", "Review", ["Every item, with the", "reason it is listed."]),
             ("03", "Clean", ["Moves to quarantine.", "Nothing is deleted yet."]),
             ("04", "Undo", ["One click puts it back.", "Space frees after 30 days."])]
    cw, gap, x0, y0, ch = 340, 50, 45, 70, 290
    for i, (n, title, lines) in enumerate(steps):
        x = x0 + i * (cw + gap)
        last = i == len(steps) - 1
        card = [f'<rect x="{x}" y="{y0}" width="{cw}" height="{ch}" rx="12" fill="{t["surface"]}" stroke="{t["line"]}" stroke-width="2"/>',
                f'<path d="M{x} {y0 + 12} Q{x} {y0} {x + 12} {y0} L{x + 24} {y0} L{x + 8} {y0 + ch} L{x + 12} {y0 + ch} Q{x} {y0 + ch} {x} {y0 + ch - 12} Z" fill="{t["red"] if last else t["shaving"]}" opacity="{1 if last else .9}"/>',
                text(MONO, n, 24, x + 48, y0 + 62, t["muted"], tracking=0.02),
                text(SANS, title, 58, x + 48, y0 + 140, t["ink"], tracking=-0.035)]
        for j, ln in enumerate(lines):
            card.append(text(SANS_REG, ln, 23, x + 44, y0 + 198 + j * 34, t["muted"], tracking=0))
        b.append(m.enter("".join(card), 0.1 + i * 0.18))
        hi = t["red"] if last else t["shaving"]
        b.append(m.pulse(f'<rect x="{x - 3}" y="{y0 - 3}" width="{cw + 6}" height="{ch + 6}" rx="15" fill="none" stroke="{hi}" stroke-width="3"/>', 1.0 + i * 2.6, 2.6))
        if not last:
            ax = x + cw + 12
            arrow = f'<path d="M{ax} {y0 + ch / 2} h28 m-10 -10 l10 10 l-10 10" fill="none" stroke="{t["muted"]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
            b.append(m.loop(arrow, "0%,100%{transform:translateX(0)}50%{transform:translateX(5px)}", 2.4, i * 0.3))
    return svg_m(W, H, "".join(b), "Scan, review, clean, undo", m)


# ------------------------------------------------------------------ layers (animated)
def layers_a(t):
    W, H = 1600, 360
    m = Motion(11)
    b = [f'<rect width="{W}" height="{H}" fill="{t["ground"]}"/>']
    items = [("RULE", "A rule says where to look"),
             ("SAFETY LAYER", "Refuses system paths, git data, real apps, your libraries"),
             ("PLAN", "You see every action before it runs"),
             ("JOURNAL", "Every step is written down, append-only"),
             ("QUARANTINE", "Nothing is deleted. Undo is one command")]
    n = len(items)
    cw = (W - 140 - (n - 1) * 24) / n
    for i, (k, v) in enumerate(items):
        x = 70 + i * (cw + 24)
        hot = k == "SAFETY LAYER"
        card = [f'<rect x="{x:.0f}" y="60" width="{cw:.0f}" height="240" rx="12" fill="{t["surface"]}" stroke="{t["red"] if hot else t["line"]}" stroke-width="{3 if hot else 2}"/>',
                text(MONO, f"0{i + 1}", 20, x + 28, 112, t["muted"], tracking=0.02),
                text(MONO, k, 22 if len(k) < 9 else 18, x + 28, 168, t["red"] if hot else t["shaving"], tracking=0.04)]
        for j, ln in enumerate(wrap_words(v, 22)[:4]):
            card.append(text(SANS_REG, ln, 22, x + 28, 208 + j * 28, t["ink"], tracking=0))
        b.append(m.enter("".join(card), 0.1 + i * 0.15))
        hi = t["red"] if hot else t["shaving"]
        b.append(m.pulse(f'<rect x="{x - 3:.0f}" y="57" width="{cw + 6:.0f}" height="246" rx="15" fill="none" stroke="{hi}" stroke-width="3"/>', 1.0 + i * 1.9, 1.9))
    return svg_m(W, H, "".join(b), "Rule, safety layer, plan, journal, quarantine", m)


# ------------------------------------------------------------------ scan (animated)
def scan_a(t):
    W, H, D = 1600, 640, 15.0
    m = Motion(D)
    b = [f'<rect width="{W}" height="{H}" fill="{t["ground"]}"/>',
         f'<defs><linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{t["red"]}" stop-opacity="0"/><stop offset="1" stop-color="{t["red"]}" stop-opacity=".22"/></linearGradient></defs>',
         f'<rect x="40" y="40" width="1000" height="560" rx="14" fill="{t["surface"]}" stroke="{t["line"]}" stroke-width="2"/>',
         f'<rect x="1080" y="40" width="480" height="560" rx="14" fill="{t["surface"]}" stroke="{t["line"]}" stroke-width="2"/>',
         text(MONO, "SCAN", 20, 80, 92, t["muted"], tracking=0.08),
         text(SANS_REG, "reads only, changes nothing", 20, 1010, 92, t["muted"], tracking=0, anchor="end"),
         f'<path d="M80 112 H1000" stroke="{t["line"]}" stroke-width="2"/>']
    rows = [("Xcode DerivedData", "dev", 14.6, "safe", 1.0), ("node_modules, idle projects", "dev", 10.2, "safe", 0.70),
            ("Homebrew and npm caches", "caches", 6.8, "safe", 0.47), ("Leftovers of removed apps", "app-leftovers", 3.7, "review", 0.26),
            ("Old iPhone backups", "caches", 9.0, "manual", 0.62)]
    y0, step = 150, 84
    moved = []
    for i, (name, sub, gb, kind, frac) in enumerate(rows):
        y = y0 + i * step
        at = 1.2 + i * 0.7
        colour = t["red"] if kind == "manual" else t["shaving"]
        row = [text(SANS_REG, name, 28, 80, y + 30, t["ink"], tracking=-0.01),
               text(MONO, sub, 17, 80, y + 56, t["muted"], tracking=0.02),
               f'<rect x="500" y="{y + 20}" width="220" height="12" rx="6" fill="{t["line"]}"/>',
               m.grow(f'<rect x="500" y="{y + 20}" width="{220 * frac:.0f}" height="12" rx="6" fill="{colour}"/>', at + 0.1, 0.9),
               risk_glyph(kind, 758, y + 26, 9, t),
               text(MONO, kind, 18, 778, y + 32, t["red"] if kind == "manual" else t["muted"], tracking=0.02),
               text(MONO, f"{gb:.1f} GB", 24, 1010, y + 34, t["ink"], tracking=0, anchor="end")]
        shown = m.show("".join(row), at, dy=10)
        if kind == "safe":
            moved.append(shown)
            continue
        b.append(shown)
    # rows that Clean moves out and Undo brings back share one dimming group each
    for r in moved:
        b.append(m.dim(r, 7.6, 11.2, 0.22, 36))
    # scan beam
    beam = (f'<rect x="41" y="-40" width="998" height="40" fill="url(#beam)"/>'
            f'<rect x="41" y="-2" width="998" height="3" fill="{t["red"]}"/>')
    b.append(m.slide(beam, 0.9, 3.4, 130, 590))
    # counter
    rx = 1120
    b.append(text(MONO, "CAN BE REMOVED", 20, rx, 100, t["muted"], tracking=0.08))
    counts = [(0.0, "0.0"), (1.4, "14.6"), (2.1, "24.8"), (2.8, "31.6"), (3.5, "35.3")]
    for k, (at, v) in enumerate(counts):
        nxt = counts[k + 1][0] if k + 1 < len(counts) else None
        glyphs = text(SANS, v, 132, rx, 250, t["ink"], tracking=-0.05) + text(SANS, "GB", 48, rx + text_width(SANS, v, 132, -0.05) + 18, 250, t["muted"], tracking=-0.02)
        b.append(m.show(glyphs, at, nxt if nxt else D - 0.7, dy=0, fade=0.2))
    b.append(m.show(text(SANS_REG, "31.6 GB of it safe to clear", 26, rx, 306, t["shaving"], tracking=0), 4.2, dy=8))
    b.append(m.show(text(SANS_REG, "9.0 GB more, only you can judge", 22, rx, 344, t["muted"], tracking=0), 4.6, dy=8))
    # buttons
    def button(label, y, fill, ink, outline):
        return (f'<rect x="{rx}" y="{y}" width="400" height="76" rx="12" fill="{fill}" stroke="{outline}" stroke-width="2"/>'
                + text(SANS, label, 28, rx + 200, y + 49, ink, tracking=-0.01, anchor="middle"))
    press = lambda y: f'<rect x="{rx}" y="{y}" width="400" height="76" rx="12" fill="{t["red"]}" opacity=".9"/>'
    by = 410
    b.append(m.show(button("Clean 31.6 GB", by, t["raised"], t["ink"], t["shaving"]), 5.2, 8.0, dy=8))
    b.append(m.pulse(press(by) + text(SANS, "Clean 31.6 GB", 28, rx + 200, by + 49, "#ffffff", tracking=-0.01, anchor="middle"), 7.0, 0.8))
    b.append(m.show(button("Undo", by, t["raised"], t["ink"], t["line"]), 8.0, D - 0.7, dy=8))
    b.append(m.pulse(press(by) + text(SANS, "Undo", 28, rx + 200, by + 49, "#ffffff", tracking=-0.01, anchor="middle"), 11.0, 0.7))
    sy = 530
    b.append(m.show(text(SANS_REG, "Moved to quarantine.", 24, rx, sy, t["ink"], tracking=0) +
                    text(SANS_REG, "Yours to restore for 30 days.", 22, rx, sy + 32, t["muted"], tracking=0), 7.8, 11.2, dy=8))
    b.append(m.show(text(SANS_REG, "Restored. Nothing was lost.", 24, rx, sy, t["ink"], tracking=0) +
                    text(SANS_REG, "Everything is back where it was.", 22, rx, sy + 32, t["muted"], tracking=0), 11.4, D - 0.7, dy=8))
    return svg_m(W, H, "".join(b), "A scan finds 35.3 GB, a clean moves 31.6 GB to quarantine, undo puts it back", m)


# ------------------------------------------------------------------ terminal (animated)
def terminal_a(t):
    W, H, D = 1600, 800, 18.0
    m = Motion(D)
    dark = t["ground"] == "#0E1012"
    win = t["surface"] if dark else t["raised"]
    bar = t["raised"] if dark else t["surface"]
    b = [f'<rect width="{W}" height="{H}" fill="{t["ground"]}"/>',
         f'<rect x="40" y="30" width="1520" height="740" rx="16" fill="{win}" stroke="{t["line"]}" stroke-width="2"/>',
         f'<path d="M40 46 Q40 30 56 30 H1544 Q1560 30 1560 46 V94 H40 Z" fill="{bar}"/>',
         f'<path d="M40 94 H1560" stroke="{t["line"]}" stroke-width="2"/>']
    for i, col in enumerate(("#FF5F57", "#FEBC2E", "#28C840")):
        b.append(f'<circle cx="{76 + i * 30}" cy="62" r="9" fill="{col}"/>')
    b.append(text(MONO, "whittle: zsh", 20, 186, 69, t["muted"], tracking=0))
    fs, lh, x0, y0 = 25, 35, 84, 148
    cw_ = adv(MONO, fs)
    ink, tan, mut, red = t["ink"], t["shaving"], t["muted"], t["red"]
    P = lambda s_, col: (s_, col)
    # each line: (segments, kind) with segments [(text, colour)], kind cmd/out/blank
    L = []
    cmd = lambda c: L.append(([("~ ", mut), (c, ink)], "cmd"))
    out = lambda *segs: L.append((list(segs), "out"))
    blank = lambda: L.append(([], "blank"))
    cmd("whittle scan")
    out(("   206 MB", tan), ("  can be removed", ink))
    out(("   165 MB", tan), ("  of it is safe to clear right away", ink))
    out(("  17.0 MB", tan), ("  more that only you can judge (marked manual)", ink))
    blank()
    out(("dev                     ", ink), ("159 MB", tan))
    out(("  safe      ", tan), ("94.0 MB  ", ink), ("Xcode DerivedData · Atlas-bnxqkd", ink))
    out(("  safe      ", tan), ("46.0 MB  ", ink), ("Rust target · old-tool", ink))
    out(("  caution   ", ink), ("28.0 MB  ", ink), ("com.spotify.client", ink))
    out(("  manual    ", red), ("17.0 MB  ", ink), ("Google", ink))
    out(("Nothing was changed. `whittle clean` moves the safe items to quarantine (undoable).", mut))
    blank()
    cmd("whittle clean --risk safe --yes")
    out(("Quarantined 4 item(s), 165 MB. Kept in quarantine for 30 days.", ink))
    blank()
    cmd("whittle undo")
    out(("Restored 4 item(s) from run 1792543202-8400.", ink))
    # timeline: commands type, outputs fade in
    times, t_now = [], 0.9
    for segs, kind in L:
        times.append(t_now)
        t_now += {"cmd": 1.6, "out": 0.42, "blank": 0.25}[kind]
        if kind == "cmd" and L.index((segs, kind)) in (0, 11, 14):
            pass
    # extra pause after each command finishes typing
    t_now = 0.9
    times = []
    for segs, kind in L:
        times.append(t_now)
        t_now += {"cmd": 1.55, "out": 0.4, "blank": 0.2}[kind]
        if kind == "cmd":
            t_now += 0.45
    for i, ((segs, kind), at) in enumerate(zip(L, times)):
        if kind == "blank":
            continue
        y = y0 + i * lh
        x = x0
        parts = []
        for s_, col in segs:
            parts.append(text(MONO, s_, fs, x, y, col, tracking=0))
            x += len(s_) * cw_
        total = x - x0
        if kind == "cmd":
            typed = len("".join(s_ for s_, _ in segs)) - 2
            cover_x = x0 + 2 * cw_
            line = m.type_on("".join(parts), cover_x, y - fs, total - 2 * cw_ + 2, fs + 12, win, at, 0.9, typed)
            b.append(m.show(line, at, dy=0, fade=0.05))
        else:
            b.append(m.show("".join(parts), at, dy=6, fade=0.3))
    # blinking prompt at the end
    ey = y0 + len(L) * lh
    prompt = text(MONO, "~ ", fs, x0, ey, mut, tracking=0)
    b.append(m.show(prompt, times[-1] + 0.6, dy=0, fade=0.1))
    cursor = f'<rect x="{x0 + 2 * cw_ + 2:.0f}" y="{ey - fs + 2}" width="{cw_ * 0.9:.0f}" height="{fs + 2}" fill="{ink}"/>'
    b.append(m.show(m.loop(cursor, "0%,49%{opacity:1}50%,100%{opacity:0}", 1.0, 0, "steps(1,end)"), times[-1] + 0.6, dy=0, fade=0.1))
    return svg_m(W, H, "".join(b), "A terminal: whittle scan lists what can go, whittle clean moves it to quarantine, whittle undo restores it", m)


# ------------------------------------------------------------------ risk
def risk_a(t):
    W, H = 1600, 400
    m = Motion(1)
    b = [f'<rect width="{W}" height="{H}" fill="{t["ground"]}"/>']
    cards = [("safe", "SAFE", "Regenerates on its own.", "Caches, build folders, logs.", "Selected for you", t["shaving"]),
             ("review", "REVIEW", "Probably unneeded.", "Data of an app you uninstalled.", "You decide", t["shaving"]),
             ("manual", "MANUAL", "Only you know.", "Device backups, folders Whittle cannot place.", "Not counted in the headline", t["red"])]
    cw, gap = 480, 40
    for i, (kind, label, l1, l2, foot, col) in enumerate(cards):
        x = 60 + i * (cw + gap)
        card = [f'<rect x="{x}" y="50" width="{cw}" height="300" rx="14" fill="{t["surface"]}" stroke="{t["line"]}" stroke-width="2"/>',
                f'<rect x="{x}" y="50" width="{cw}" height="6" rx="3" fill="{col}"/>',
                risk_glyph(kind, x + 62, 128, 26, t),
                text(MONO, label, 26, x + 108, 138, col, tracking=0.1),
                text(SANS, l1, 40, x + 40, 210, t["ink"], tracking=-0.03)]
        for j, ln in enumerate(wrap_words(l2, 34)):
            card.append(text(SANS_REG, ln, 24, x + 40, 254 + j * 32, t["muted"], tracking=0))
        card.append(text(MONO, foot, 19, x + 40, 322, t["ink"], tracking=0.01))
        b.append(m.enter("".join(card), 0.1 + i * 0.18))
    return svg_m(W, H, "".join(b), "Risk levels: safe regenerates on its own, review is probably unneeded, manual is only for you to judge", m)


# ------------------------------------------------------------------ modules
def modules_a(t):
    W, H = 1600, 470
    m = Motion(1)
    b = [f'<rect width="{W}" height="{H}" fill="{t["ground"]}"/>']
    sk = lambda fill="none": f'fill="{fill}" stroke="{t["shaving"]}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"'
    icons = [
        lambda x, y: f'<path d="M{x + 52} {y + 20} A24 24 0 1 0 {x + 56} {y + 40}" {sk()}/><path d="M{x + 56} {y + 12} V{y + 24} H{x + 44}" {sk()}/>',
        lambda x, y: f'<path d="M{x + 22} {y + 14} L{x + 6} {y + 32} L{x + 22} {y + 50}" {sk()}/><path d="M{x + 42} {y + 14} L{x + 58} {y + 32} L{x + 42} {y + 50}" {sk()}/><path d="M{x + 36} {y + 10} L{x + 28} {y + 54}" stroke="{t["red"]}" stroke-width="4" stroke-linecap="round"/>',
        lambda x, y: f'<rect x="{x + 6}" y="{y + 8}" width="52" height="48" rx="10" fill="none" stroke="{t["shaving"]}" stroke-width="4" stroke-dasharray="7 8" stroke-linecap="round"/>',
        lambda x, y: f'<rect x="{x + 4}" y="{y + 4}" width="36" height="40" rx="7" {sk()}/><rect x="{x + 24}" y="{y + 20}" width="36" height="40" rx="7" fill="{t["surface"]}" stroke="{t["shaving"]}" stroke-width="4"/>',
        lambda x, y: f'<path d="M{x + 6} {y + 14} H{x + 58}" {sk()}/><path d="M{x + 6} {y + 32} H{x + 44}" {sk()}/><path d="M{x + 6} {y + 50} H{x + 30}" {sk()}/>',
    ]
    tiles = [("Caches & logs", "5 to 40 GB", "App caches, logs, Xcode, Homebrew, npm, Cargo and more"),
             ("Dev projects", "2 to 30 GB", "node_modules, target and .venv of projects you left idle"),
             ("App leftovers", "0.5 to 10 GB", "Files of apps that are no longer installed"),
             ("Duplicates", "opt-in", "Identical files, checked by size, then hash"),
             ("Tidy a folder", "just order", "Downloads and Desktop sorted by type and date")]
    n = len(tiles)
    cw, gap = (W - 120 - (n - 1) * 20) / n, 20
    for i, (title, size_, desc) in enumerate(tiles):
        x = 60 + i * (cw + gap)
        tile = [f'<rect x="{x:.0f}" y="40" width="{cw:.0f}" height="390" rx="14" fill="{t["surface"]}" stroke="{t["line"]}" stroke-width="2"/>',
                icons[i](x + 32, 76),
                text(SANS, title, 33, x + 32, 214, t["ink"], tracking=-0.03),
                text(MONO, size_, 21, x + 32, 254, t["shaving"], tracking=0.02)]
        for j, ln in enumerate(wrap_words(desc, 19)[:5]):
            tile.append(text(SANS_REG, ln, 21, x + 32, 300 + j * 30, t["muted"], tracking=0))
        b.append(m.enter("".join(tile), 0.05 + i * 0.12))
    return svg_m(W, H, "".join(b), "Five modules: caches and logs, dev projects, app leftovers, duplicates, tidy a folder", m)


# ------------------------------------------------------------------ architecture
def arch_a(t):
    W, H = 1600, 500
    m = Motion(1)
    b = [f'<rect width="{W}" height="{H}" fill="{t["ground"]}"/>']

    def box(x, y, w, h, title, sub, hot=False, fill=None):
        return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{fill or t["surface"]}" stroke="{t["red"] if hot else t["line"]}" stroke-width="{3 if hot else 2}"/>'
                + text(MONO, title, 22, x + 24, y + 44, t["red"] if hot else t["shaving"], tracking=0.02)
                + "".join(text(SANS_REG, ln, 20, x + 24, y + 78 + j * 26, t["muted"], tracking=0)
                          for j, ln in enumerate(wrap_words(sub, max(8, int((w - 48) / 10.2))))))

    def flow_line(x1, y1, x2, y2):
        d = f"M{x1} {y1} L{x2} {y2}"
        line = (f'<path d="{d}" stroke="{t["muted"]}" stroke-width="3" fill="none" stroke-dasharray="9 11" stroke-linecap="round" class="m dash"/>'
                f'<path d="M{x2 - 12} {y2 - 10} L{x2} {y2} L{x2 - 12} {y2 + 10}" stroke="{t["muted"]}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>')
        return line
    m.css.append("@keyframes dash{to{stroke-dashoffset:-40}}.dash{animation:dash 1.6s linear infinite}")
    b.append(m.enter(box(50, 150, 270, 200, "rules/*.yaml", "Where to look, as data. One entry, one pull request."), 0.05))
    b.append(m.enter(f'<rect x="400" y="50" width="620" height="400" rx="16" fill="{t["raised"] if t["ground"] != "#0E1012" else t["surface"]}" stroke="{t["line"]}" stroke-width="2"/>'
                     + text(MONO, "crates/whittle-core", 24, 432, 100, t["ink"], tracking=0.02)
                     + text(SANS_REG, "all behaviour, no UI", 20, 432, 130, t["muted"], tracking=0), 0.2))
    cells = [("scan", "reads only"), ("plan", "what would change"), ("safety", "refuses, always"), ("apply", "quarantine or trash"), ("journal", "append-only"), ("undo", "restores")]
    for i, (k, v) in enumerate(cells):
        cx, cy = 432 + (i % 3) * 196, 170 + (i // 3) * 140
        b.append(m.enter(box(cx, cy, 180, 116, k, v, hot=(k == "safety"), fill=t["ground"]).replace('font-size', 'font-size'), 0.35 + i * 0.08, 10))
    b.append(m.enter(box(1110, 70, 440, 150, "whittle-cli", "The `whittle` command. Dry run unless you say otherwise."), 0.6))
    b.append(m.enter(box(1110, 280, 440, 170, "whittle-app", "Tauri v2 shell. Sends finding ids, never paths. React UI on top."), 0.75))
    b.append(flow_line(322, 250, 396, 250))
    b.append(flow_line(1022, 190, 1106, 150))
    b.append(flow_line(1022, 310, 1106, 350))
    return svg_m(W, H, "".join(b), "Rules feed whittle-core, which the command line and the Tauri app both use", m)


# ------------------------------------------------------------------ views (animated)
def views_a(t):
    W, H, D = 1600, 560, 16.0
    m = Motion(D)
    b = [f'<rect width="{W}" height="{H}" fill="{t["ground"]}"/>',
         f'<rect x="50" y="40" width="1500" height="480" rx="16" fill="{t["surface"]}" stroke="{t["line"]}" stroke-width="2"/>',
         f'<path d="M470 40 V520" stroke="{t["line"]}" stroke-width="2"/>',
         mark(106, 92, 38, t["ink"], t["red"]),
         text(SANS, "whittle", 30, 140, 103, t["ink"], tracking=-0.03)]
    views = [("Overview", "1", "One number: what can go.", [0.92, 0.55, 0.3, 0.12]),
             ("Review", "2", "Every finding, with a reason.", [0.8, 0.8, 0.8, 0.8]),
             ("Tidy a folder", "3", "Sort a messy folder. Preview first.", [0.3, 0.55, 0.8, 0.45]),
             ("History", "4", "Every run, with undo.", [0.5, 0.7, 0.35, 0.6]),
             ("Insights", "5", "Where the space sits: category, risk, age.", [0.95, 0.7, 0.42, 0.2]),
             ("Apps", "6", "Leftovers, grouped per app.", [0.6, 0.85, 0.4, 0.25]),
             ("Rules", "7", "Where Whittle looks, as YAML.", [0.4, 0.4, 0.65, 0.4]),
             ("Quarantine", "8", "What can still come back.", [0.75, 0.5, 0.35, 0.2])]
    rh, ry = 46, 140
    for i, (name, key, desc, bars) in enumerate(views):
        y = ry + i * rh
        b.append(text(SANS_REG, name, 24, 96, y + 32, t["ink"] if i == len(views) - 1 else t["muted"], tracking=-0.005))
        b.append(text(MONO, "cmd " + key, 18, 440, y + 30, t["muted"], tracking=0.02, anchor="end"))
        at = i * 2.0
        b.append(m.pulse(f'<rect x="70" y="{y}" width="380" height="{rh - 6}" rx="9" fill="{t["raised"]}" stroke="{t["line"]}" stroke-width="2"/>'
                         f'<path d="M70 {y + 6} L84 {y + 6} L76 {y + rh - 12} L72 {y + rh - 12} Z" fill="{t["red"]}"/>'
                         + text(SANS, name, 24, 96, y + 32, t["ink"], tracking=-0.005), at, 2.0))
        panel = [text(SANS, name, 76, 530, 150, t["ink"], tracking=-0.045),
                 text(SANS_REG, desc, 30, 534, 206, t["muted"], tracking=0)]
        for j, f in enumerate(bars):
            yy = 286 + j * 54
            panel.append(f'<rect x="534" y="{yy}" width="900" height="14" rx="7" fill="{t["line"]}"/>')
            panel.append(m.grow(f'<rect x="534" y="{yy}" width="{900 * f:.0f}" height="14" rx="7" fill="{t["shaving"] if j else t["red"]}"/>', at + 0.25 + j * 0.12, 0.7))
        last = i == len(views) - 1
        b.append(m.show("".join(panel), at, None if last else at + 2.0, dy=10, fade=0.35))
    return svg_m(W, H, "".join(b), "The app's views: overview, review, tidy, history, insights, apps, rules, quarantine", m)


# ------------------------------------------------------------------ command palette (animated)
def palette_a(t):
    W, H, D = 1600, 560, 10.0
    m = Motion(D)
    b = [f'<rect width="{W}" height="{H}" fill="{t["ground"]}"/>']
    x, y, w, h = 330, 50, 940, 460
    b.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="16" fill="{t["surface"]}" stroke="{t["line"]}" stroke-width="2"/>')
    b.append(f'<path d="M{x} {y + 90} H{x + w}" stroke="{t["line"]}" stroke-width="2"/>')
    b.append(f'<circle cx="{x + 52}" cy="{y + 46}" r="11" fill="none" stroke="{t["muted"]}" stroke-width="3"/><path d="M{x + 60} {y + 54} l10 10" stroke="{t["muted"]}" stroke-width="3" stroke-linecap="round"/>')
    q = "xcode"
    for k in range(1, len(q) + 1):
        a = 0.8 + (k - 1) * 0.28
        until = 0.8 + k * 0.28 if k < len(q) else D - 0.7
        b.append(m.show(text(SANS_REG, q[:k], 34, x + 96, y + 58, t["ink"], tracking=0), a, until, dy=0, fade=0.01))
    b.append(m.loop(f'<rect x="{x + 96 + 100}" y="{y + 26}" width="3" height="40" fill="{t["red"]}"/>', "0%,49%{opacity:1}50%,100%{opacity:0}", 1.1))
    b.append(text(MONO, "cmd K", 20, x + w - 36, y + 54, t["muted"], tracking=0.02, anchor="end"))
    rows = [("FINDINGS", None, None), ("Xcode DerivedData", "dev \u00b7 safe", "14.6 GB"),
            ("Xcode device support files", "dev \u00b7 safe", "5.2 GB"), ("RULES", None, None),
            ("Xcode DerivedData", "rule \u00b7 xcode-derived-data", "")]
    yy = y + 120
    for i, (a, bsub, c) in enumerate(rows):
        at = 2.6 + i * 0.25
        if bsub is None:
            row = text(MONO, a, 17, x + 40, yy + 18, t["muted"], tracking=0.08)
            step = 44
        else:
            hot = i == 1
            row = ""
            if hot:
                row += f'<rect x="{x + 20}" y="{yy - 4}" width="{w - 40}" height="64" rx="10" fill="{t["raised"]}"/><path d="M{x + 20} {yy + 4} L{x + 32} {yy + 4} L{x + 26} {yy + 52} L{x + 22} {yy + 52} Z" fill="{t["red"]}"/>'
            row += text(SANS, a, 26, x + 48, yy + 26, t["ink"], tracking=-0.01) + text(MONO, bsub, 16, x + 48, yy + 50, t["muted"], tracking=0.02)
            if c:
                row += text(MONO, c, 22, x + w - 44, yy + 34, t["shaving"], tracking=0, anchor="end")
            step = 70
        b.append(m.show(row, at, None, dy=8, fade=0.35))
        yy += step
    foot = text(MONO, "up/down move    enter run    esc close", 16, x + 40, y + h - 24, t["muted"], tracking=0.04)
    b.append(m.show(foot, 3.6, None, dy=0))
    return svg_m(W, H, "".join(b), "The command palette: typing xcode finds findings and rules", m)


ALL = (("banner", banner_a), ("flow", flow_a), ("layers", layers_a), ("scan", scan_a),
       ("terminal", terminal_a), ("risk", risk_a), ("modules", modules_a), ("arch", arch_a),
       ("views", views_a), ("palette", palette_a))


if __name__ == "__main__":
    for name, fn in ALL:
        for variant, t in THEMES.items():
            p = OUT / f"{name}-{variant}.svg"
            p.write_text(fn(t))
            print("wrote", p.relative_to(ROOT), p.stat().st_size // 1024, "KiB")
