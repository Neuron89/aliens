#!/usr/bin/env python3
"""
Crop per-item images from full-page RPG book scans.
Each entry in CONFIG has: out (filename in cropped/), source (path to full page PNG), region.
Region: "full" | "left" | "right" | "top" | "bottom" | "top_left" | "top_right" | "bottom_left" | "bottom_right"
or "box": [x_pct, y_pct, w_pct, h_pct] (0-100 percentages of page dimensions).
"""
import os
import json
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Install Pillow: pip install Pillow")
    raise

# Base path to web app public art (script is in project_root/scripts/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
WEB_APP = PROJECT_ROOT / "web app"
ART_BASE = WEB_APP / "public" / "art"

def get_region_box(region, w, h):
    """Return (x, y, width, height) in pixels for region name."""
    if region == "full":
        return (0, 0, w, h)
    if region == "left":
        return (0, 0, w // 2, h)
    if region == "right":
        return (w // 2, 0, w - w // 2, h)
    if region == "top":
        return (0, 0, w, h // 2)
    if region == "bottom":
        return (0, h // 2, w, h - h // 2)
    if region == "top_left":
        return (0, 0, w // 2, h // 2)
    if region == "top_right":
        return (w // 2, 0, w - w // 2, h // 2)
    if region == "bottom_left":
        return (0, h // 2, w // 2, h - h // 2)
    if region == "bottom_right":
        return (w // 2, h // 2, w - w // 2, h - h // 2)
    raise ValueError(f"Unknown region: {region}")

def get_box_pct(box_pct, w, h):
    """box_pct = [x_pct, y_pct, w_pct, h_pct] in 0-100."""
    x = int(w * box_pct[0] / 100)
    y = int(h * box_pct[1] / 100)
    bw = int(w * box_pct[2] / 100)
    bh = int(h * box_pct[3] / 100)
    return (x, y, bw, bh)

def crop_one(entry, category, base_path):
    """Crop one image. entry = { out, source, region? or box? }."""
    out_name = entry["out"]
    source_path = base_path / entry["source"]
    if not source_path.exists():
        print(f"  SKIP (missing): {source_path}")
        return False
    img = Image.open(source_path).convert("RGB")
    w, h = img.size
    if "box" in entry:
        x, y, bw, bh = get_box_pct(entry["box"], w, h)
    else:
        x, y, bw, bh = get_region_box(entry["region"], w, h)
    cropped = img.crop((x, y, x + bw, y + bh))
    out_dir = base_path / category / "cropped"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / out_name
    cropped.save(out_path, "PNG", optimize=True)
    print(f"  OK: {out_name}")
    return True

def main():
    config_path = Path(__file__).parent / "crop_art_config.json"
    if not config_path.exists():
        print("Missing crop_art_config.json")
        return
    with open(config_path) as f:
        config = json.load(f)
    base_path = ART_BASE
    for category, entries in config.items():
        if category.startswith("_"):
            continue
        print(f"\n{category}:")
        for entry in entries:
            crop_one(entry, category, base_path)
    print("\nDone.")

if __name__ == "__main__":
    main()
