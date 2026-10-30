#!/usr/bin/env python
"""Convert art/map PNGs to WebP (same basename, next to original).

Usage: python convert-art.py [--dry-run] [--keep] [--quality 85]
Converts, verifies (exists, non-zero, readable, alpha preserved), then deletes
the source PNGs only if every file verified (unless --keep). Requires Pillow.
Images wider/taller than 2000 px are downscaled (LANCZOS) to 2000 px max.
"""
import argparse, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DIRS = [ROOT / "web app" / "public" / "art",
        ROOT / "web app" / "public" / "maps",
        ROOT / "map-references"]
MAX_DIM = 2000  # default; override with --max-dim

def has_alpha(im):
    return im.mode in ("RGBA", "LA", "PA") or "transparency" in im.info

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--keep", action="store_true", help="do not delete PNGs")
    ap.add_argument("--quality", type=int, default=85)
    ap.add_argument("--max-dim", type=int, default=MAX_DIM, help="downscale images whose longest side exceeds this (px)")
    ap.add_argument("--only", help="only convert PNGs whose path contains this substring")
    a = ap.parse_args()

    pngs = sorted(p for d in DIRS for p in d.rglob("*") if p.suffix.lower() == ".png")
    if a.only:
        pngs = [p for p in pngs if a.only in str(p)]
    print(f"{len(pngs)} PNGs found")
    before = after = 0
    failures, done = [], []
    for p in pngs:
        w = p.with_suffix(".webp")
        before += p.stat().st_size
        if a.dry_run:
            print(f"would convert {p.relative_to(ROOT)}")
            continue
        try:
            with Image.open(p) as im:
                alpha = has_alpha(im)
                im = im.convert("RGBA" if alpha else "RGB")
                if max(im.size) > a.max_dim:
                    s = a.max_dim / max(im.size)
                    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
                im.save(w, "WEBP", quality=a.quality, alpha_quality=100, method=6)
            with Image.open(w) as r:
                r.load()
                if w.stat().st_size == 0 or (alpha and not has_alpha(r)):
                    raise ValueError("verification failed")
            after += w.stat().st_size
            done.append((p, w))
        except Exception as e:
            failures.append((p, e))
            print(f"FAIL {p}: {e}")
    if a.dry_run:
        return
    print(f"converted {len(done)}/{len(pngs)}; before {before} bytes, after {after} bytes; failures {len(failures)}")
    if failures or len(done) != len(pngs):
        print("not deleting PNGs"); sys.exit(1)
    if not a.keep:
        for p, _ in done:
            p.unlink()
        print("deleted source PNGs")

if __name__ == "__main__":
    main()
