# Brand

`icon.svg` is the source: the house drawn as an outline, filled with one warm
ramp from a deep terracotta at the peak to a pale gold at the floor. There is
no tile behind it - the mark is transparent throughout, so it sits among Home
Assistant's other integration icons rather than on a square of its own.

Geometry worth keeping: the outer corner radius is 33 and the inner is 20, so
the wall stays an even thickness around every corner. The viewBox is trimmed
hard to the artwork, so the house meets the left and right edges and is
centered vertically. home-assistant/brands wants an icon cropped to its
content, and an earlier framing that left a margin on all four sides sat
lower in its box than it looked.

The PNGs Home Assistant and HACS read live in `custom_components/hemma/brand/`,
at 256 and 512 square with a transparent background.

To regenerate after editing the SVG, render each size natively rather than
downscaling - the gradient bands when resampled:

```
chrome --headless=new --default-background-color=00000000 \
       --window-size=512,512 --screenshot=icon@2x.png icon.svg
# then the same with width/height 256 on the <svg> element and --window-size=256,256
```

The same two files are what the PR to home-assistant/brands carries, as
`custom_integrations/hemma/icon.png` and `icon@2x.png`. Until that PR merges,
Home Assistant shows a placeholder no matter what ships here.
