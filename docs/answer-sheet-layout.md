# Zelvo answer sheet, layout 1

The printed sheet and the scanner must agree on where everything is. The source of truth is
`src/lib/sheet/layout.ts`; this page explains it for the scanner (stage 3). Never change layout 1 in place:
make layout 2 instead, so sheets that were already printed keep working.

All measurements are in **millimetres on an A4 page (210 × 297)**, origin top-left.

## Finding the page

- Four solid black squares, 7 × 7 mm, centred at (12, 12), (198, 12), (12, 285) and (198, 285).
- Map the four square centres in the photo onto those points (perspective transform) to straighten the page.
  Scaling by the printer ("fit to page") doesn't matter, because everything is relative to the squares.

## QR code

- At x 166–194, y 20–48 (28 mm square, including a 4-module quiet zone). Alphanumeric mode, error correction M.
- Text: `ZLV1:<exam>:<student>:<page>:<pages>`
  - `<exam>` and `<student>`: the UUID without dashes, upper-case (32 hex characters).
  - `<student>` is `0` on blank sheets.
  - Example: `ZLV1:3F2A9C1E7B4D4E8A9F102C3D4E5F6A7B:0:1:2`

## Handwriting boxes (blank sheets)

| Box | x | y | width | height |
| --- | --- | --- | --- | --- |
| Full name | 12 | 50 | 146 | 12 |
| Class | 12 | 66 | 70 | 11 |
| Subject | 88 | 66 | 70 | 11 |

Each box has a small printed label in its top-left corner. On named sheets the same boxes hold the printed
name, class and subject.

## Bubble grid

| Setting | Value |
| --- | --- |
| Top of first row | 96 |
| Usable width | 12 to 198 |
| Rows per column | 25 (in blocks of 5) |
| Row height | 6.6 |
| Extra gap between blocks | 2.6 |
| Question number width | 9 |
| Bubble spacing (centre to centre) | 6.2 |
| Bubble diameter | 4.6 |
| Gap between columns | 4 |

For an exam with `n` options (2–6):

```
columnWidth = 9 + n × 6.2 + 4
columns     = floor((186 + 4) / columnWidth)
startX      = 12 + (186 − (columns × columnWidth − 4)) / 2
perPage     = columns × 25
```

| Options | Columns | Questions per page |
| --- | --- | --- |
| 2 (A–B) | 7 | 175 |
| 3 (A–C) | 6 | 150 |
| 4 (A–D) | 5 | 125 |
| 5 (A–E) | 4 | 100 |
| 6 (A–F) | 3 | 75 |

Page `p` holds questions `(p − 1) × perPage + 1` to `min(questionCount, p × perPage)`. For the `i`-th question
on a page (0-based):

```
column  = floor(i / 25)
row     = i mod 25
block   = floor(row / 5)
centreY = 96 + row × 6.6 + block × 2.6 + 3.3
bubbleX(option o) = startX + column × columnWidth + 9 + o × 6.2 + 3.1
```

Columns are filled left to right, so an exam with fewer questions than `perPage` leaves the right-hand columns
empty.

## Reading a page (src/lib/scan)

The reader runs on the phone, in plain TypeScript, so scanning works without internet:

1. The photo is reduced to at most 1600 px on its longest side and turned into greyscale.
2. **Corner squares:** a local (adaptive) threshold, then connected dark regions; the square-ish region nearest each
   corner of the photo is taken. This runs on a half-size copy for speed.
3. **Orientation:** the page is mapped upright first; if the QR code doesn't read, upside down, then sideways.
4. **QR code:** the QR area is straightened at 7 px/mm and decoded with jsQR. It must name this exam, and its page count
   must match the exam's current settings (otherwise the sheets were printed before the exam was changed).
5. **Bubbles:** for each option, the average brightness inside 1.5 mm of the centre is compared with the paper on a
   3 mm ring around it. Levels for "empty" and "shaded" are measured on each page, so pencil, pen and lighting all work.
6. Each question becomes one character: `A`–`F` (sure), `a`–`f` (best guess, teacher should check), `-` (blank),
   `#` (more than one shaded). Unscanned pages show as `?`.
7. A straightened copy of the page (3 px/mm, greyscale JPEG, about 90 KB) is kept for checking answers later.

`tools/test` makes realistic photos of filled sheets (skewed, small, upside down, sideways, uneven light, clutter,
faint marks, rubbed-out and double marks) and runs this exact code on them. Every option count reads correctly.
