"""Prototype check for answer-sheet layout 1: fill a rendered sheet, distort it like a phone photo, read it back.

Usage: python tools/omr_check.py <sheet.png> <questions> <options> <dpi>
Render the PNG from a page SVG (see docs/answer-sheet-layout.md). Stage 3 builds the real scanner from this.
"""
import random, sys
import cv2
import numpy as np

# --- layout 1 (mirror of src/lib/sheet/layout.ts) ---
MARKER_CENTRES = [(12, 12), (198, 12), (12, 285), (198, 285)]
TOP, LEFT, RIGHT = 96, 12, 198
ROWS_PER_COL, ROWS_PER_BLOCK, ROW_H, BLOCK_GAP = 25, 5, 6.6, 2.6
NUM_W, PITCH, DIAM, COL_GAP = 9, 6.2, 4.6, 4

def shape(opts):
    cw = NUM_W + opts * PITCH + COL_GAP
    usable = RIGHT - LEFT
    cols = int((usable + COL_GAP) // cw)
    gw = cols * cw - COL_GAP
    return cols, cw, LEFT + (usable - gw) / 2

def bubble(i, o, opts):
    cols, cw, sx = shape(opts)
    col, row = divmod(i, ROWS_PER_COL)
    block = row // ROWS_PER_BLOCK
    x = sx + col * cw
    y = TOP + row * ROW_H + block * BLOCK_GAP + ROW_H / 2
    return x + NUM_W + o * PITCH + PITCH / 2, y

def main(path, n_q, opts, dpi):
    img = cv2.imread(path)
    k = dpi / 25.4
    rng = random.Random(7)
    truth = []
    for i in range(n_q):
        a = rng.randrange(opts + 1)  # last value = left blank
        if a == opts:
            truth.append(None)
            continue
        truth.append(a)
        x, y = bubble(i, a, opts)
        # imperfect pencil shading: slightly off-centre, slightly small
        cv2.circle(img, (int((x + rng.uniform(-0.4, 0.4)) * k), int((y + rng.uniform(-0.4, 0.4)) * k)),
                   int(DIAM / 2 * k * rng.uniform(0.75, 0.95)), (40, 40, 40), -1)

    # Simulate a phone photo: perspective, rotation, uneven light, blur, noise.
    h, w = img.shape[:2]
    src = np.float32([[0, 0], [w, 0], [0, h], [w, h]])
    j = 0.06
    dst = np.float32([[w * j, h * 0.03], [w * (1 - j * 0.5), 0], [0, h * (1 - j * 0.3)], [w * (1 - j), h]])
    photo = cv2.warpPerspective(img, cv2.getPerspectiveTransform(src, dst), (w, h), borderValue=(90, 80, 70))
    grad = np.tile(np.linspace(0.65, 1.0, w, dtype=np.float32), (h, 1))[..., None]
    photo = np.clip(photo.astype(np.float32) * grad + np.random.default_rng(1).normal(0, 6, photo.shape), 0, 255).astype(np.uint8)
    photo = cv2.GaussianBlur(photo, (5, 5), 0)
    cv2.imwrite('/tmp/sheet/photo.jpg', photo, [cv2.IMWRITE_JPEG_QUALITY, 80])

    # --- read it back ---
    gray = cv2.cvtColor(cv2.imread('/tmp/sheet/photo.jpg'), cv2.COLOR_BGR2GRAY)
    th = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 51, 15)
    contours, _ = cv2.findContours(th, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    H, W = gray.shape
    expected = (7 * W / 210) ** 2
    cands = []
    for c in contours:
        area = cv2.contourArea(c)
        if not (0.3 * expected < area < 3 * expected):
            continue
        x, y, bw, bh = cv2.boundingRect(c)
        if not (0.7 < bw / bh < 1.4):
            continue
        hull = cv2.contourArea(cv2.convexHull(c))
        if hull == 0 or area / hull < 0.9 or area / (bw * bh) < 0.75:
            continue
        m = cv2.moments(c)
        cands.append((m['m10'] / m['m00'], m['m01'] / m['m00']))
    corners = [(0, 0), (W, 0), (0, H), (W, H)]
    found = [min(cands, key=lambda p: (p[0] - cx) ** 2 + (p[1] - cy) ** 2) for cx, cy in corners]
    hom = cv2.getPerspectiveTransform(np.float32(MARKER_CENTRES), np.float32(found))

    # Straighten to 10 px/mm and normalise lighting.
    S = 10
    to_img = hom @ np.diag([1 / S, 1 / S, 1])
    flat = cv2.warpPerspective(gray, np.linalg.inv(to_img), (210 * S, 297 * S))
    bg = cv2.medianBlur(flat, 61)
    norm = cv2.divide(flat, bg, scale=255)

    qr_val, _, _ = cv2.QRCodeDetector().detectAndDecode(flat)
    errors = 0
    for i in range(n_q):
        darkness = []
        for o in range(opts):
            x, y = bubble(i, o, opts)
            cx, cy, r = int(x * S), int(y * S), int(1.6 * S)
            patch = norm[cy - r:cy + r + 1, cx - r:cx + r + 1].astype(np.float32)
            ys, xs = np.ogrid[-r:r + 1, -r:r + 1]
            circle = xs ** 2 + ys ** 2 <= r * r
            darkness.append(1 - patch[circle].mean() / 255)
        best = int(np.argmax(darkness))
        srt = sorted(darkness, reverse=True)
        answer = best if srt[0] > 0.35 and srt[0] - srt[1] > 0.2 else None
        if answer != truth[i]:
            errors += 1
            print('mismatch q', i + 1, 'truth', truth[i], 'read', answer, [round(d, 2) for d in darkness])
    print(f'markers found: {len(cands)} candidates; QR: {qr_val!r}')
    print(f'{n_q} questions, {errors} errors')

if __name__ == '__main__':
    main(sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]))
