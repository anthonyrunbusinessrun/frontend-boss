# Design notes

The supplied PNGs are 2880x1800, i.e. 1440x900 at 2x. All numbers below are CSS px, measured from pixels
(they override the design-system markdown where the two disagree).

## Frame
- Header 62px (`#0B1F3A`), search 379x32 at x=905.5, avatar 38px with a 2px `#EF4444` ring ending at x=1416.
- Tab bar 44px (1px `#1E3A5F` border all round, 42px content). Tab text 13/600, padding 0 18.5px. Active tab `#CF0E38` with a 3px x 38px underline overlapping the bottom border.
- Sidebar 260px including 1px side borders, inner padding 15px (12px on Items). CTA 36px, "Find a view…" 31px.
- Content padding 20px (25px on Items). Title 20/700 (22px on the uppercase Transactions / Items titles).
- Toolbar chips are 28px tall, 12px type, 11px padding. Chip top to table top is 21.5px on most screens.

## Table themes
Every screen has its own table theme, encoded as a `TableTheme` in its view file: header height, header border,
row colours, divider tints, group-row height. They are intentionally not unified because the designs differ.

## Colours worth knowing (sampled)
Toggle on `#1565C0`, knob `#F2F5FA`, footer buttons `#1E3A5F`, colour-card selected row `#0A344D`,
share notice / button `#3A86C8`, profile menu dividers `#E5E5E5`, BUSINESS badge `#FF8C2B`, BETA `#F2C500`,
secondary row text / icons `#9AC0DA`, delete red `#C62828`, success `#22C55E`.
Full badge palette: `src/lib/tones.ts`.

## Card sizes (CSS px)
Sort 340x640, Hide fields 340x657, Filter 608x~375, Color 380x220, Share and sync 440x~436, Share dialog 420x266,
Group by 640x~200, Profile menu 320x~668.
