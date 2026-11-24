"""Make realistic test photos of filled answer sheets, with the true answers saved alongside."""
import json, random, sys, math
import cv2, numpy as np

TOP, LEFT, RIGHT = 96, 12, 198
ROWS_PER_COL, ROWS_PER_BLOCK, ROW_H, BLOCK_GAP = 25, 5, 6.6, 2.6
NUM_W, PITCH, DIAM, COL_GAP = 9, 6.2, 4.6, 4

def shape(opts):
    cw = NUM_W + opts * PITCH + COL_GAP
    cols = int((186 + COL_GAP) // cw)
    return cols, cw, LEFT + (186 - (cols * cw - COL_GAP)) / 2

def bubble(i, o, opts):
    cols, cw, sx = shape(opts)
    col, row = divmod(i, ROWS_PER_COL)
    y = TOP + row * ROW_H + (row // ROWS_PER_BLOCK) * BLOCK_GAP + ROW_H / 2
    return sx + col * cw + NUM_W + o * PITCH + PITCH / 2, y

def fill(img, k, n, opts, seed, extras=True):
    rng = random.Random(seed)
    truth = []
    for i in range(n):
        r = rng.random()
        if r < 0.08:
            truth.append('-'); continue
        a = rng.randrange(opts)
        x, y = bubble(i, a, opts)
        shade = rng.choice([25, 40, 60, 80])
        cv2.circle(img, (int((x + rng.uniform(-.5, .5)) * k), int((y + rng.uniform(-.5, .5)) * k)),
                   int(DIAM / 2 * k * rng.uniform(.7, .98)), (shade,) * 3, -1)
        t = chr(65 + a)
        if extras and r > 0.97:  # a second clear mark -> multiple
            b = (a + 1) % opts
            x2, y2 = bubble(i, b, opts)
            cv2.circle(img, (int(x2 * k), int(y2 * k)), int(DIAM / 2 * k * .85), (40,) * 3, -1)
            t = '#'
        elif extras and r > 0.94:  # a rubbed-out earlier answer (light grey smudge)
            b = (a + 1 + rng.randrange(opts - 1)) % opts
            x2, y2 = bubble(i, b, opts)
            cv2.circle(img, (int(x2 * k), int(y2 * k)), int(DIAM / 2 * k * .8), (205,) * 3, -1)
        truth.append(t)
    return ''.join(truth)

def photo(sheet, out, fill_frac, rot, bg, seed, width=int(__import__("os").environ.get("W", 1400))):
    rng = np.random.default_rng(seed)
    h, w = sheet.shape[:2]
    if rot:
        sheet = np.ascontiguousarray(np.rot90(sheet, k=rot // 90))
        h, w = sheet.shape[:2]
    canvas_w = int(w / fill_frac); canvas_h = int(h / fill_frac)
    if rot in (90, 270):
        canvas_w = int(w / fill_frac); canvas_h = int(h / (fill_frac * 0.95))
    canvas = np.full((canvas_h, canvas_w, 3), bg, np.uint8)
    # clutter on the table
    for _ in range(6):
        c = tuple(int(v) for v in rng.integers(0, 120, 3))
        cx, cy = int(rng.integers(0, canvas_w)), int(rng.integers(0, canvas_h))
        cv2.rectangle(canvas, (cx, cy), (cx + int(rng.integers(20, 200)), cy + int(rng.integers(20, 200))), c, -1)
    j = 0.05
    src = np.float32([[0, 0], [w, 0], [0, h], [w, h]])
    ox, oy = (canvas_w - w) / 2, (canvas_h - h) / 2
    jit = lambda: rng.uniform(-j, j) * w
    dst = np.float32([[ox + jit(), oy + jit()], [ox + w + jit(), oy + jit()], [ox + jit(), oy + h + jit()], [ox + w + jit(), oy + h + jit()]])
    m = cv2.getPerspectiveTransform(src, dst)
    warped = cv2.warpPerspective(sheet, m, (canvas_w, canvas_h), borderMode=cv2.BORDER_TRANSPARENT, dst=canvas.copy())
    mask = cv2.warpPerspective(np.full((h, w), 255, np.uint8), m, (canvas_w, canvas_h))
    canvas[mask > 0] = warped[mask > 0]
    # light: gradient + soft shadow
    gx = np.linspace(rng.uniform(.55, .8), 1.0, canvas_w, dtype=np.float32)
    gy = np.linspace(1.0, rng.uniform(.75, .95), canvas_h, dtype=np.float32)
    light = np.outer(gy, gx)[..., None]
    img = np.clip(canvas.astype(np.float32) * light + rng.normal(0, 5, canvas.shape), 0, 255).astype(np.uint8)
    img = cv2.GaussianBlur(img, (3, 3), 0)
    scale = width / img.shape[1]
    img = cv2.resize(img, (width, int(img.shape[0] * scale)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(out, img, [cv2.IMWRITE_JPEG_QUALITY, 85])

if __name__ == '__main__':
    src, out_prefix, n, opts, dpi = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
    k = dpi / 25.4
    base = cv2.imread(src)
    cases = [
        dict(name='upright', fill=0.85, rot=0, bg=(60, 70, 90)),
        dict(name='small', fill=0.55, rot=0, bg=(150, 140, 120)),
        dict(name='upside-down', fill=0.8, rot=180, bg=(30, 30, 30)),
        dict(name='sideways', fill=0.8, rot=90, bg=(90, 60, 40)),
        dict(name='sideways-left', fill=0.8, rot=270, bg=(200, 200, 200)),
    ]
    manifest = []
    for i, c in enumerate(cases):
        sheet = base.copy()
        truth = fill(sheet, k, n, opts, seed=i + 1)
        path = f'{out_prefix}-{c["name"]}.jpg'
        photo(sheet, path, c['fill'], c['rot'], c['bg'], seed=i + 10)
        manifest.append({'file': path, 'truth': truth, 'case': c['name']})
    json.dump(manifest, open(f'{out_prefix}-manifest.json', 'w'))
    print('made', len(manifest), 'photos')
