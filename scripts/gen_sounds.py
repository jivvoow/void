"""Synthesise the app's tiny sound effects (original, no samples) as 16-bit mono WAVs."""
import math, os, random, struct, wave

SR = 22050
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'sounds')
os.makedirs(OUT, exist_ok=True)
random.seed(7)


def write(name, samples, gain=0.8):
    peak = max(1e-9, max(abs(s) for s in samples))
    k = gain / peak
    with wave.open(os.path.join(OUT, name), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, s * k)) * 32767)) for s in samples))


def env(i, n, attack, release):
    a = int(attack * SR)
    r = int(release * SR)
    if i < a:
        return i / max(1, a)
    if i > n - r:
        return max(0.0, (n - i) / max(1, r))
    return 1.0


def lowpass(xs, alpha):
    y, out = 0.0, []
    for x in xs:
        y += alpha * (x - y)
        out.append(y)
    return out


# gulp ??a round little "轅爰?: pitch drops quickly, then a tiny second bloop.
def gulp():
    out = []
    for part, (dur, f0, f1, amp) in enumerate([(0.11, 620, 210, 1.0), (0.08, 420, 160, 0.55)]):
        n = int(dur * SR)
        ph = 0.0
        for i in range(n):
            t = i / n
            f = f0 * (f1 / f0) ** t
            ph += 2 * math.pi * f / SR
            e = math.sin(math.pi * min(1, t * 1.15)) ** 1.5
            out.append(amp * e * (math.sin(ph) + 0.25 * math.sin(2 * ph)))
        if part == 0:
            out += [0.0] * int(0.025 * SR)
    return out


# blow ??"?꾩슦~": breathy noise that swells then trails off, filter opening with the breath.
def blow():
    dur = 0.95
    n = int(dur * SR)
    out, y1, y2 = [], 0.0, 0.0
    for i in range(n):
        t = i / n
        e = (t / 0.22) ** 1.4 if t < 0.22 else (1 - (t - 0.22) / 0.78) ** 1.8
        alpha = 0.05 + 0.13 * math.sin(math.pi * min(1, t * 1.3))
        x = random.uniform(-1, 1)
        y1 += alpha * (x - y1)
        y2 += alpha * (y1 - y2)
        out.append(y2 * e)
    return out


# seeds ??airy twinkles scattering upward (a few soft high pings, randomly placed).
def seeds():
    dur = 1.1
    n = int(dur * SR)
    out = [0.0] * n
    notes = [1568, 1760, 2093, 2349, 2637, 3136]
    for k in range(9):
        start = int((0.02 + k * 0.085 + random.uniform(0, 0.04)) * SR)
        f = random.choice(notes) * random.uniform(0.995, 1.005)
        amp = 0.55 * (1 - k / 12)
        for i in range(int(0.45 * SR)):
            j = start + i
            if j >= n:
                break
            t = i / SR
            out[j] += amp * math.exp(-t * 9) * math.sin(2 * math.pi * f * t) * min(1, t * 400)
    # a breath of air underneath
    air = lowpass([random.uniform(-1, 1) for _ in range(n)], 0.08)
    return [s + 0.18 * a * math.sin(math.pi * i / n) for i, (s, a) in enumerate(zip(out, air))]


# clear ??gentle two-note bell, "?뚰썙, ?댁젣 蹂대궡以ъ뼱??.
def clear():
    dur = 1.4
    n = int(dur * SR)
    out = [0.0] * n
    for start_s, f, amp in [(0.0, 1046.5, 0.8), (0.16, 1568.0, 0.6)]:
        s0 = int(start_s * SR)
        for i in range(n - s0):
            t = i / SR
            e = math.exp(-t * 3.2) * min(1, t * 300)
            out[s0 + i] += amp * e * (math.sin(2 * math.pi * f * t) + 0.3 * math.sin(2 * math.pi * f * 2.01 * t) * math.exp(-t * 4))
    return out


# puff ??instant mode: a soft little "?? of air when the melted line clears.
def puff():
    dur = 0.22
    n = int(dur * SR)
    noise = lowpass([random.uniform(-1, 1) for _ in range(n)], 0.12)
    ph = 0.0
    out = []
    for i in range(n):
        t = i / n
        ph += 2 * math.pi * (300 - 120 * t) / SR
        e = math.sin(math.pi * t) ** 2
        out.append(e * (0.7 * noise[i] + 0.35 * math.sin(ph)))
    return out


# rip — paper tearing: a dense run of tiny fibre snaps riding a brief papery hiss.
def rip():
    dur = 0.34
    n = int(dur * SR)
    out = [0.0] * n
    hiss = [random.uniform(-1, 1) for _ in range(n)]
    hp, prev = [], 0.0
    for x in hiss:  # crude high-pass → papery
        hp.append(x - prev * 0.6)
        prev = x
    for i in range(n):
        t = i / n
        e = min(1, t / 0.05) * (1 - t) ** 1.3
        out[i] = 0.35 * hp[i] * e
    snaps = int(70 + random.random() * 20)
    for _ in range(snaps):
        c = int(random.betavariate(1.6, 2.2) * (n - 200))
        amp = random.uniform(0.3, 1.0)
        for j in range(random.randint(25, 90)):
            out[c + j] += amp * random.uniform(-1, 1) * math.exp(-j / 18)
    return out


write('gulp.wav', gulp(), 0.7)
write('blow.wav', blow(), 0.75)
write('seeds.wav', seeds(), 0.55)
write('clear.wav', clear(), 0.5)
write('puff.wav', puff(), 0.5)
write('rip.wav', rip(), 0.6)
for f in sorted(os.listdir(OUT)):
    print(f, os.path.getsize(os.path.join(OUT, f)))

