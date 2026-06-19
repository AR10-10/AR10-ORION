#!/usr/bin/env python3
"""Generates PWA/Apple touch icons for the iPad Runtime — Ciborgue theme.

Pure local raster generation (Pillow), no network, no external assets.
Produces: icon-192.png, icon-512.png, icon-maskable-512.png,
apple-touch-icon-180.png
"""
import os
from PIL import Image, ImageDraw

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "icons")

BG = (0, 0, 0, 255)
CYAN = (0, 242, 255, 255)
GREEN = (0, 255, 157, 255)


def draw_glyph(size: int, safe_margin_ratio: float) -> Image.Image:
    img = Image.new("RGBA", (size, size), BG)
    d = ImageDraw.Draw(img, "RGBA")
    cx = cy = size / 2
    margin = size * safe_margin_ratio
    r_outer = (size / 2) - margin

    # Outer cyan ring (system / structure)
    d.ellipse([cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer],
              outline=CYAN, width=max(2, size // 48))

    # Crosshair circuit lines
    line_w = max(1, size // 96)
    span = r_outer * 0.92
    d.line([cx - span, cy, cx + span, cy], fill=(0, 242, 255, 90), width=line_w)
    d.line([cx, cy - span, cx, cy + span], fill=(0, 242, 255, 90), width=line_w)

    # Inner synapse node (glow via stacked translucent circles)
    for i, (rad, alpha) in enumerate([(r_outer * 0.34, 40), (r_outer * 0.24, 90), (r_outer * 0.14, 255)]):
        col = (0, 242, 255, alpha) if i < 2 else GREEN
        d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=col)

    return img


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    targets = [
        ("icon-192.png", 192, 0.10),
        ("icon-512.png", 512, 0.10),
        ("icon-maskable-512.png", 512, 0.20),  # bigger safe margin for OS masking
        ("apple-touch-icon-180.png", 180, 0.08),
    ]
    for name, size, margin in targets:
        img = draw_glyph(size, margin)
        if name.startswith("apple-touch"):
            flat = Image.new("RGB", (size, size), (0, 0, 0))
            flat.paste(img, (0, 0), img)
            flat.save(os.path.join(OUT_DIR, name))
        else:
            img.save(os.path.join(OUT_DIR, name))
        print("wrote", name)


if __name__ == "__main__":
    main()
