#!/usr/bin/env python3
"""
Generate item art for ALIEN items that have no usable sourcebook illustration.

Reads scripts/art-selection.json, and for every entry with "generated": true
renders its "prompt" with ComfyUI (flux1-schnell-fp8, 4 steps, cfg 1,
euler/simple, 1024x1024) into the entry's "file" (scripts/.scratch/generated/).
Then run `python scripts/extract-art.py build` to produce the final WebP files.

Usage: python scripts/gen-alien-art.py [--only ID ...] [--force] [--seed N]
"""
import argparse, json, time, urllib.request, urllib.parse, zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SELECTION = ROOT / "scripts" / "art-selection.json"
COMFY = "http://192.168.1.37:8188"


def call(path, data=None):
    req = urllib.request.Request(COMFY + path, data=json.dumps(data).encode() if data is not None else None,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def workflow(prompt, seed, prefix):
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "flux1-schnell-fp8.safetensors"}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": prompt}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": ""}},
        "4": {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "5": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0],
              "latent_image": ["4", 0], "seed": seed, "steps": 4, "cfg": 1.0,
              "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": prefix}},
    }


def generate(item_id, entry, seed_base):
    seed = entry.get("seed", (zlib.crc32(item_id.encode()) + seed_base) % 2**31)
    pid = json.loads(call("/prompt", {"prompt": workflow(entry["prompt"], seed, f"alien-art/{item_id}-{int(time.time())}")}))["prompt_id"]
    for _ in range(600):
        hist = json.loads(call(f"/history/{pid}"))
        # (a unique SaveImage prefix defeats ComfyUI's cache, so outputs are always reported)
        if pid in hist and hist[pid].get("status", {}).get("status_str") == "error":
            raise RuntimeError(f"{item_id}: {hist[pid]['status']}")
        if pid in hist and hist[pid].get("outputs"):
            img = hist[pid]["outputs"]["7"]["images"][0]
            q = urllib.parse.urlencode({"filename": img["filename"], "subfolder": img["subfolder"], "type": img["type"]})
            out = ROOT / entry["file"]
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(call(f"/view?{q}"))
            return seed
        time.sleep(1)
    raise TimeoutError(item_id)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args()
    sel = json.loads(SELECTION.read_text(encoding="utf-8"))
    changed = False
    for item_id, e in sel["items"].items():
        if not e.get("generated") or (a.only and item_id not in a.only):
            continue
        if (ROOT / e["file"]).exists() and not a.force:
            continue
        seed = generate(item_id, e, a.seed)
        if e.get("seed") != seed:
            e["seed"] = seed
            changed = True
        print(f"  {item_id}: seed {seed}")
    if changed:
        SELECTION.write_text(json.dumps(sel, indent=1, ensure_ascii=False), encoding="utf-8")
