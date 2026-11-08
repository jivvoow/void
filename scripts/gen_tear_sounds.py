"""Paper-tearing sounds for "찢어서 홀씨" (original synthesis, no samples).

tear_loop.wav — a seamless loop of paper fibres giving way, played (and sped up / louder)
               while the finger drags across the sheet.
rip.wav       — the sharp "쫙!" when a tear goes all the way through.

Real tearing is thousands of tiny fibre breaks: short clicks of band-limited noise, irregular
in time and loudness, over a papery hiss, with the odd bigger "crack". That is what this builds.
"""
import math, os, random, struct, wave

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'sounds')
os.makedirs(OUT, exist_ok=True)
rng = random.Random(42)


def write(name, xs, gain, drive=1.0):
    peak = max(1e-9, max(abs(x) for x in xs))
    if drive > 1:
        # Soft-clip: tame the spiky clicks so the tear sounds full and loud, not thin.
        t = math.tanh(drive)
        xs = [math.tanh(drive * x / peak) / t for x in xs]
        peak = 1.0
    k = gain / peak
    with wave.open(os.path.join(OUT, name), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1.0, min(1.0, x * k)) * 32767)) for x in xs))


def biquad(xs, kind, f0, q):
    """RBJ cookbook band-pass / high-pass / low-pass."""
    w0 = 2 * math.pi * f0 / SR
    a = math.sin(w0) / (2 * q)
    c = math.cos(w0)
    if kind == 'bp':
        b0, b1, b2 = a, 0.0, -a
    elif kind == 'hp':
        b0, b1, b2 = (1 + c) / 2, -(1 + c), (1 + c) / 2
    else:
        b0, b1, b2 = (1 - c) / 2, 1 - c, (1 - c) / 2
    a0, a1, a2 = 1 + a, -2 * c, 1 - a
    b0, b1, b2, a1, a2 = b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0
    x1 = x2 = y1 = y2 = 0.0
    out = []
    for x in xs:
        y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, x, y1, y
        out.append(y)
    return out


def fibres(n, rate_per_s, loud=1.0, crack_every=0.0):
    """Sparse train of fibre-break clicks (decaying noise grains) of random size."""
    out = [0.0] * n
    t = 0.0
    while True:
        t += rng.expovariate(rate_per_s)
        i = int(t * SR)
        if i >= n:
            break
        big = crack_every and rng.random() < crack_every
        amp = loud * (rng.uniform(0.6, 1.0) if big else rng.uniform(0.05, 0.45) ** 1.6)
        length = int(SR * (rng.uniform(0.004, 0.012) if big else rng.uniform(0.0006, 0.003)))
        tau = length / 3.5
        for j in range(length):
            if i + j >= n:
                break
            out[i + j] += amp * rng.uniform(-1, 1) * math.exp(-j / tau)
    return out


def paper(n, density, crack):
    """One stretch of tearing: hiss + fibre clicks, shaped into the paper's band."""
    hiss = [rng.uniform(-1, 1) for _ in range(n)]
    hiss = biquad(biquad(hiss, 'hp', 1800, 0.7), 'lp', 9000, 0.7)
    # the tear's "grain" wavers as the finger speeds up and slows down
    clicks = fibres(n, density, 1.0, crack)
    crisp = biquad(clicks, 'hp', 1200, 0.7)
    body = biquad(clicks, 'bp', 700, 1.1)  # a little papery body under the crackle
    out = []
    for i in range(n):
        wav = 0.75 + 0.25 * math.sin(2 * math.pi * 3.1 * i / SR) * math.sin(2 * math.pi * 0.7 * i / SR + 1)
        out.append(0.16 * hiss[i] * wav + 1.0 * crisp[i] + 0.55 * body[i])
    return out


def tear_loop():
    dur = 1.6
    fade = int(0.12 * SR)
    n = int(dur * SR) + fade
    xs = paper(n, density=1400, crack=0.012)
    peak = max(abs(x) for x in xs)
    xs = [math.tanh(4.0 * x / peak) for x in xs]  # loud & full (before the crossfade → no seam click)
    # Seamless loop: crossfade the extra tail into the head (equal-power).
    out = xs[: n - fade]
    for i in range(fade):
        g = i / fade
        out[i] = out[i] * math.sin(g * math.pi / 2) + xs[n - fade + i] * math.cos(g * math.pi / 2)
    return out


def rip():
    """'쫙!' — a fast, loud burst: dense crackle that swells and rushes off, with a crack up front."""
    dur = 0.42
    n = int(dur * SR)
    xs = paper(n, density=3200, crack=0.03)
    out = []
    for i in range(n):
        t = i / n
        e = min(1.0, t / 0.03) * (1 - t) ** 1.7 * (1 + 0.6 * math.exp(-t * 18))
        out.append(xs[i] * e)
    # the first fibres snapping all at once
    for j in range(int(0.012 * SR)):
        out[j + int(0.004 * SR)] += 2.2 * rng.uniform(-1, 1) * math.exp(-j / (0.003 * SR))
    return biquad(out, 'hp', 300, 0.7)


write('tear_loop.wav', tear_loop(), 0.9)
write('rip.wav', rip(), 0.98, drive=4.5)
for f in ('tear_loop.wav', 'rip.wav'):
    print(f, os.path.getsize(os.path.join(OUT, f)))
