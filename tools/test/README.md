# Scanner tests

Checks the on-phone sheet reader (`src/lib/scan`) against realistic photos of filled answer sheets:
skewed, small in the frame, upside down, sideways, uneven light, clutter on the table, faint marks,
rubbed-out answers and double marks.

```bash
# 1. Draw a sample sheet (125 questions, A–D) and turn it into a PNG
node tools/test/render_sheet.mjs 125 4
rsvg-convert -d 200 -p 200 -f png -o /tmp/zelvo-sheet/base.png /tmp/zelvo-sheet/named-p1.svg
# 2. Fill it in and photograph it five ways (width of the photo in pixels: W)
W=1131 python3 tools/test/make_photos.py /tmp/zelvo-sheet/base.png /tmp/zelvo-sheet/ph 125 4 200
# 3. Read the photos with the app's own code and compare with the true answers
node tools/test/test_scan.mjs /tmp/zelvo-sheet/ph-manifest.json 3f2a9c1e-7b4d-4e8a-9f10-2c3d4e5f6a7b 125 4
```

Needs Node, Python 3 with OpenCV and NumPy, and `rsvg-convert`.
