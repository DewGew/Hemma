# Brand

`icon.svg` is the source. The PNGs Home Assistant and HACS actually read live in
`custom_components/hemma/brand/`, at 256 and 512 square with a transparent
corner radius.

To regenerate after editing the SVG:

```
chrome --headless --screenshot=icon@2x.png --window-size=512,512 \
       --default-background-color=00000000 icon.svg
sips -z 256 256 icon@2x.png --out icon.png
```
