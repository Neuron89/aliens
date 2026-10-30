#!/usr/bin/env python3
"""
ALIEN RPG item-art pipeline (supersedes the old crop_art.py page-crop approach).

Stage 1  extract : pull EMBEDDED image objects (not page crops) out of the
                   sourcebook PDFs, with their page, on-page bbox, pixel size
                   and the text near them, into
                   scripts/.scratch/pdf-images/<book>/p<page>-<n>.png
                   + scripts/.scratch/pdf-images/<book>/manifest.json
Stage 2  build   : read scripts/art-selection.json (item id -> source image +
                   optional crop, chosen by visual review) and write the final
                   per-item WebP files to web app/public/art/<cat>/cropped/,
                   plus web app/public/art/alien-art-map.json.

Usage:
  python scripts/extract-art.py extract [--pdf-dir DIR] [--book crb|acm|art]
  python scripts/extract-art.py build   [--only ID ...]
  python scripts/extract-art.py all

Selection entry format (art-selection.json -> "items"):
  "<id>": {
    "category": "weapons" | "vehicles" | "xenomorphs",
    "out": "<file>.webp",                 # filename in <cat>/cropped/
    "names": ["Display Name", ...],       # used for slug keys in the art map
    "refIds": ["reference-id", ...],      # optional extra keys for the art map
    # either a book image ...
    "book": "crb" | "acm" | "art", "page": <1-based pdf page>, "imageIndex": <n>,
    "crop": [x0, y0, x1, y1],             # optional, fractions 0..1 of the image
    "rotate": <deg>,                      # optional, counter-clockwise
    "stitch": [{"page": p, "imageIndex": n}],  # optional, right half of a 2-page spread
    # ... or a generated image
    "generated": true, "file": "scripts/.scratch/generated/<id>.png", "prompt": "..."
  }
Book images are re-extracted on demand, so `build` works from a clean checkout
as long as the PDFs are available. Generated images live in
scripts/.scratch/generated/ (ComfyUI flux1-schnell; see scripts/gen-alien-art.py).
"""
import argparse, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRATCH = ROOT / "scripts" / ".scratch"
OUT_IMG = SCRATCH / "pdf-images"
ART = ROOT / "web app" / "public" / "art"
SELECTION = ROOT / "scripts" / "art-selection.json"
DEFAULT_PDF_DIR = Path(r"C:\Users\hsnes\Projects\aliens-source-pdfs\alien documents")
BOOKS = {
    "crb": "Core Rule Book.pdf",
    "acm": "Scenario_/Alien colonial marines operations.pdf",
    "art": "Artwork.pdf",
}
MIN_PX = 150
MAX_PAGE_FRAC = 0.90
NEAR_PT = 72  # text within this distance (pt) of an image bbox counts as "nearby"


def slug(s):
    s = s.lower().replace("&", " and ")
    s = re.sub("[\"'\u2019\u201c\u201d.]", "", s)
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


# ---------------------------------------------------------------- extract
def pixmap_rgba(doc, xref, smask):
    import pymupdf
    pix = pymupdf.Pixmap(doc, xref)
    if pix.alpha:
        pix = pymupdf.Pixmap(pix, 0)
    if pix.colorspace and pix.colorspace.n != 3:
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    if smask:
        try:
            mask = pymupdf.Pixmap(doc, smask)
            if mask.width == pix.width and mask.height == pix.height:
                pix = pymupdf.Pixmap(pix, mask)
        except Exception:
            pass
    return pix


def text_lines(page):
    out = []
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            t = "".join(s["text"] for s in l["spans"]).strip()
            if t:
                out.append((t, l["bbox"], max(s["size"] for s in l["spans"])))
    return out


def rect_dist(a, b):
    dx = max(b[0] - a[2], a[0] - b[2], 0)
    dy = max(b[1] - a[3], a[1] - b[3], 0)
    return (dx * dx + dy * dy) ** 0.5


def extract(pdf_dir, only=None):
    import pymupdf
    for book, rel in BOOKS.items():
        if only and book not in only:
            continue
        doc = pymupdf.open(pdf_dir / rel)
        dest = OUT_IMG / book
        dest.mkdir(parents=True, exist_ok=True)
        manifest = []
        for pno, page in enumerate(doc, start=1):
            area = page.rect.width * page.rect.height
            lines = text_lines(page)
            cands = []
            for idx, im in enumerate(page.get_images(full=True)):
                xref, smask, w, h = im[0], im[1], im[2], im[3]
                try:
                    bb = page.get_image_bbox(im)
                except Exception:
                    continue
                if bb.is_empty or bb.is_infinite:
                    continue
                frac = (bb.width * bb.height) / area
                cands.append(dict(idx=idx, xref=xref, smask=smask, w=w, h=h, bbox=list(bb), frac=frac))
            usable = [c for c in cands if min(c["w"], c["h"]) >= MIN_PX and c["frac"] <= MAX_PAGE_FRAC]
            if not usable:  # e.g. Artwork.pdf: one full-page painting per page
                usable = [c for c in cands if min(c["w"], c["h"]) >= MIN_PX and c["frac"] <= 1.05]
            seen = set()
            for c in usable:
                key = (c["xref"], tuple(round(v) for v in c["bbox"]))
                if key in seen:
                    continue
                seen.add(key)
                near = sorted(((rect_dist(c["bbox"], lb), t, sz) for t, lb, sz in lines
                               if rect_dist(c["bbox"], lb) <= NEAR_PT), key=lambda x: x[0])
                fn = f"p{pno:03d}-{c['idx']}.png"
                try:
                    pix = pixmap_rgba(doc, c["xref"], c["smask"])
                    pix.save(dest / fn)
                except Exception as e:
                    print(f"  ! {book} p{pno} img{c['idx']}: {e}", file=sys.stderr)
                    continue
                manifest.append(dict(
                    file=fn, page=pno, imageIndex=c["idx"], xref=c["xref"], width=c["w"], height=c["h"],
                    hasAlpha=bool(c["smask"]), bbox=[round(v, 1) for v in c["bbox"]],
                    pageFraction=round(c["frac"], 3),
                    nearbyText=[t for _, t, _ in near[:12]],
                    pageHeadings=[t for t, _, sz in lines if sz >= 11][:8],
                ))
        (dest / "manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False), encoding="utf-8")
        print(f"{book}: {len(manifest)} candidate images -> {dest}")


def extract_one(pdf_dir, book, page, index):
    """Re-extract a single image (used by build when scratch is missing)."""
    import pymupdf
    doc = pymupdf.open(pdf_dir / BOOKS[book])
    im = doc[page - 1].get_images(full=True)[index]
    dest = OUT_IMG / book / f"p{page:03d}-{index}.png"
    dest.parent.mkdir(parents=True, exist_ok=True)
    pixmap_rgba(doc, im[0], im[1]).save(dest)
    return dest


# ---------------------------------------------------------------- build
def finish(img, max_px=1024):
    """Trim transparent/solid borders, pad to square-ish transparent canvas, cap size."""
    from PIL import Image, ImageChops
    img = img.convert("RGBA")
    alpha = img.getchannel("A")
    transparent_bg = alpha.getextrema()[0] < 16
    if transparent_bg:
        box = alpha.point(lambda a: 255 if a > 12 else 0).getbbox()
    else:
        rgb = img.convert("RGB")
        bg = Image.new("RGB", rgb.size, rgb.getpixel((0, 0)))
        diff = ImageChops.difference(rgb, bg).convert("L").point(lambda v: 255 if v > 18 else 0)
        box = diff.getbbox()
    fill = (0, 0, 0, 0) if transparent_bg else img.getpixel((0, 0))[:3] + (255,)
    plain_backdrop = transparent_bg or (box is not None and box != (0, 0) + img.size)
    if box:
        img = img.crop(box)
    w, h = img.size
    if plain_backdrop:  # pad to a square-ish canvas (aspect <= 1.6) in the backdrop colour
        side_w, side_h = w, h
        if w > h * 1.6:
            side_h = int(w / 1.6)
        elif h > w * 1.6:
            side_w = int(h / 1.6)
        pad = int(max(side_w, side_h) * 0.04)
        canvas = Image.new("RGBA", (side_w + 2 * pad, side_h + 2 * pad), fill)
        canvas.paste(img, ((canvas.width - w) // 2, (canvas.height - h) // 2), img)
        img = canvas
    if not transparent_bg:
        img = img.convert("RGB")
    if max(img.size) > max_px:
        s = max_px / max(img.size)
        img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
    return img


def load_book_image(pdf_dir, book, page, index):
    from PIL import Image
    p = OUT_IMG / book / f"p{page:03d}-{index}.png"
    if not p.exists():
        p = extract_one(pdf_dir, book, page, index)
    return Image.open(p).convert("RGBA")


def source_image(entry, pdf_dir):
    from PIL import Image
    if entry.get("generated"):
        return Image.open(ROOT / entry["file"])
    img = load_book_image(pdf_dir, entry["book"], entry["page"], entry["imageIndex"])
    if entry.get("stitch"):  # two-page spread: append the right-hand half(s)
        parts = [img] + [load_book_image(pdf_dir, entry["book"], s["page"], s["imageIndex"]) for s in entry["stitch"]]
        h = min(p.height for p in parts)
        parts = [p if p.height == h else p.resize((round(p.width * h / p.height), h), Image.LANCZOS) for p in parts]
        img = Image.new("RGBA", (sum(p.width for p in parts), h), (0, 0, 0, 0))
        x = 0
        for p in parts:
            img.paste(p, (x, 0))
            x += p.width
    if entry.get("crop"):
        x0, y0, x1, y1 = entry["crop"]
        W, H = img.size
        img = img.crop((round(x0 * W), round(y0 * H), round(x1 * W), round(y1 * H)))
    if entry.get("rotate"):
        img = img.rotate(entry["rotate"], expand=True, resample=Image.BICUBIC)
    return img


def build(pdf_dir, only=None):
    sel = json.loads(SELECTION.read_text(encoding="utf-8"))
    amap_path = ART / "alien-art-map.json"
    amap = {}
    for item_id, e in sel["items"].items():
        url = f"/art/{e['category']}/cropped/{e['out']}"
        if not only or item_id in only:
            img = finish(source_image(e, pdf_dir))
            out = ART / e["category"] / "cropped" / e["out"]
            out.parent.mkdir(parents=True, exist_ok=True)
            img.save(out, "WEBP", quality=85, method=6)
            print(f"  {item_id:32s} -> {url} {img.size}")
        keys = [item_id, Path(e["out"]).stem] + e.get("refIds", []) + [slug(n) for n in e.get("names", [])]
        for k in keys:
            amap.setdefault(k, url)
    amap_path.write_text(json.dumps(dict(sorted(amap.items())), indent=1), encoding="utf-8")
    print(f"art map: {len(amap)} keys -> {amap_path}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("stage", choices=["extract", "build", "all"])
    ap.add_argument("--pdf-dir", type=Path, default=DEFAULT_PDF_DIR)
    ap.add_argument("--book", action="append")
    ap.add_argument("--only", nargs="*")
    a = ap.parse_args()
    if a.stage in ("extract", "all"):
        extract(a.pdf_dir, a.book)
    if a.stage in ("build", "all"):
        build(a.pdf_dir, a.only)
