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

## Reading a bubble

`tools/omr_check.py` is a working prototype: it fills a rendered sheet, distorts it like a phone photo
(perspective, uneven light, blur, noise), then finds the squares, straightens the page, reads the QR code and
decides each answer. On every option count it reads all questions correctly. The stage 3 scanner builds on it.
