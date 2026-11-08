"""Render the app icon / adaptive icon / splash / favicon from the in-app cloud character.

Uses the same silhouette as src/components/CloudCharacter.tsx (240×160 artboard), drawn with
Pillow at 4× and downsampled for smooth edges.   python scripts/gen_icons.py
"""
import math, os
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets')
SS = 4  # supersampling

SKY = ['#7C7993', '#9C93AE', '#C6B2C6', '#E9C9C8', '#F7DCCB']
SKY_AT = [0, 0.28, 0.55, 0.8, 1]
BODY_HI, BODY_MID, BODY_EDGE, BODY_SHADE = '#FFFFFF', '#FBF3F1', '#E6D8E6', '#D6C6DA'
FACE, CHEEK = '#6B6480', '#F2B3BC'


def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def gradient_at(stops, at, t):
    for i in range(len(at) - 1):
        if t <= at[i + 1]:
            return lerp(hex2rgb(stops[i]), hex2rgb(stops[i + 1]), (t - at[i]) / (at[i + 1] - at[i]))
    return hex2rgb(stops[-1])


def sky(size):
    img = Image.new('RGB', (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        d.line([(0, y), (size, y)], fill=gradient_at(SKY, SKY_AT, y / (size - 1)))
    return img


def tint(canvas, rgb, mask):
    """Paint a solid colour through an L mask (mask = alpha), no grey fringes."""
    layer = Image.new('RGBA', canvas.size, tuple(rgb) + (255,))
    layer.putalpha(mask)
    canvas.alpha_composite(layer)


def bezier(p0, p1, p2, p3, n=64):
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        out.append((u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
                    u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1]))
    return out


def silhouette_mask(scale, ox, oy, W, H):
    """Cloud body mask in an image of W×H; artboard units × scale, offset (ox, oy)."""
    m = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(m)
    T = lambda x, y: (ox + x * scale, oy + y * scale)
    dome = bezier((46, 140), (40, 76), (78, 34), (120, 34)) + bezier((120, 34), (162, 34), (200, 76), (194, 140))
    d.polygon([T(*p) for p in dome], fill=255)
    for cx in (42, 198):
        d.ellipse([T(cx - 32, 126 - 21), T(cx + 32, 126 + 21)], fill=255)
    d.rounded_rectangle([T(18, 124), T(222, 146)], radius=11 * scale, fill=255)
    return m


def draw_cloud(canvas, scale, ox, oy, face=True, flat=None):
    """Composite the cloud onto RGBA `canvas`. `flat` = single colour (monochrome icon)."""
    W, H = canvas.size
    mask = silhouette_mask(scale, ox, oy, W, H)
    T = lambda x, y: (ox + x * scale, oy + y * scale)
    if flat:
        tint(canvas, flat[:3], mask)
        d = ImageDraw.Draw(canvas)
        for cx in (90, 150):
            d.ellipse([T(cx - 17, 141 - 10.5), T(cx + 17, 141 + 10.5)], fill=flat)
        return

    # soft shadow under the cloud
    sh = Image.new('L', (W, H), 0)
    ImageDraw.Draw(sh).ellipse([T(14, 145), T(226, 158)], fill=90)
    sh = sh.filter(ImageFilter.GaussianBlur(6 * scale))
    tint(canvas, hex2rgb('#6E6486'), sh)

    # body: radial highlight top-left → edge, plus a bottom shade
    body = Image.new('RGBA', (W, H))
    bp = body.load()
    hx, hy = T(98, 58)
    r = 150 * scale
    bx0, by0 = T(10, 30)
    bx1, by1 = T(230, 160)
    hi, mid, edge, shade = map(hex2rgb, (BODY_HI, BODY_MID, BODY_EDGE, BODY_SHADE))
    for y in range(int(by0), min(H, int(by1))):
        for x in range(int(bx0), min(W, int(bx1))):
            t = min(1.0, math.hypot(x - hx, y - hy) / r)
            c = lerp(hi, mid, t / 0.45) if t < 0.45 else lerp(mid, edge, (t - 0.45) / 0.55)
            sy = (y - oy) / scale
            s = max(0.0, min(1.0, (sy - 70) / 80)) * 0.35
            c = lerp(c, shade, s)
            bp[x, y] = c + (255,)
    body.putalpha(mask)
    canvas.alpha_composite(body)

    d = ImageDraw.Draw(canvas)
    # specular highlight
    spec = Image.new('L', (W, H), 0)
    ImageDraw.Draw(spec).ellipse([T(62, 48), T(122, 72)], fill=200)
    spec = ImageChops.multiply(spec.filter(ImageFilter.GaussianBlur(5 * scale)), mask)
    tint(canvas, (255, 255, 255), spec)
    # paws
    for cx in (90, 150):
        d.ellipse([T(cx - 17, 141 - 10.5), T(cx + 17, 141 + 10.5)], fill=hex2rgb(BODY_MID) + (255,),
                  outline=hex2rgb(BODY_EDGE) + (255,), width=max(1, int(1.2 * scale)))
    if not face:
        return
    # cheeks
    ch = Image.new('L', (W, H), 0)
    cd = ImageDraw.Draw(ch)
    for cx in (92, 148):
        cd.ellipse([T(cx - 9, 115 - 5), T(cx + 9, 115 + 5)], fill=150)
    ch = ch.filter(ImageFilter.GaussianBlur(1.5 * scale))
    tint(canvas, hex2rgb(CHEEK), ch)
    # sleepy ‿ ‿ eyes and a small smile (quadratic curves as polylines)
    def quad(p0, p1, p2, n=24):
        return [T((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
                  (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in (i / n for i in range(n + 1))]
    w = max(2, int(2.8 * scale))
    for curve in (quad((97, 104), (104, 110), (111, 104)), quad((129, 104), (136, 110), (143, 104)),
                  quad((115, 115), (120, 120), (125, 115))):
        d.line(curve, fill=hex2rgb(FACE) + (255,), width=w, joint='curve')
        for p in (curve[0], curve[-1]):
            d.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill=hex2rgb(FACE) + (255,))


def render(size, bg, cloud_frac, flat=None, face=True, y_bias=0.0):
    S = size * SS
    canvas = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    if bg == 'sky':
        canvas.paste(sky(S).convert('RGBA'))
    scale = S * cloud_frac / 240
    ox = (S - 240 * scale) / 2
    oy = S / 2 - 96 * scale + S * y_bias
    draw_cloud(canvas, scale, ox, oy, face=face, flat=flat)
    return canvas.resize((size, size), Image.LANCZOS)


def save(img, name, rgb=False):
    path = os.path.join(ROOT, name)
    (img.convert('RGB') if rgb else img).save(path, optimize=True)
    print(name, img.size, os.path.getsize(path) // 1024, 'KB')


# iOS / Expo icon: full-bleed sky, no transparency (App Store rule).
save(render(1024, 'sky', 0.82), 'icon.png', rgb=True)
# Android adaptive: the launcher masks to a circle/squircle → keep the cloud inside the 66% safe zone.
save(render(1024, None, 0.58), 'android-icon-foreground.png')
save(sky(1024), 'android-icon-background.png', rgb=True)
save(render(1024, None, 0.58, flat=(255, 255, 255, 255), face=False), 'android-icon-monochrome.png')
# Splash: the cloud on the transparent splash (backgroundColor comes from app.json).
save(render(512, None, 0.9), 'splash-icon.png')
save(render(48, 'sky', 0.8), 'favicon.png', rgb=True)
