#!/usr/bin/env python3
"""Generate the DUNE universe art set through a ComfyUI server.

Reads the Dune catalog JSON (web app/src/universes/dune/catalog/*.json) plus a
few extra entries (archetype portraits, house/faction emblems, map
illustrations), builds a txt2img prompt for each `art` path, and writes WebP
files under web app/public/art/dune/... (quality 85, <= 300 KB).

Model: Z-Image Turbo (UNETLoader + CLIPLoader lumina2 + ae VAE, 8 steps) with
a Flux-schnell (CheckpointLoaderSimple, 4 steps) fallback (--model flux).

Usage:
  python scripts/gen-dune-art.py --list               # show what would be generated
  python scripts/gen-dune-art.py --only crysknife     # one id (substring match on art path)
  python scripts/gen-dune-art.py                      # everything missing
  python scripts/gen-dune-art.py --force              # regenerate even if present
"""
import argparse, io, json, os, random, sys, time, urllib.request, urllib.parse
from pathlib import Path

from PIL import Image

HOST = os.environ.get('COMFY', 'http://192.168.1.37:8188')
ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / 'web app'
CATALOG = APP / 'src' / 'universes' / 'dune' / 'catalog'
PUBLIC = APP / 'public'
SCRATCH = ROOT / 'scripts' / '.scratch' / 'dune-art'

# NOTE: the brief's suffix said "Dune 2021 film aesthetic"; with Z-Image Turbo that phrase paints
# the film's logo into ~10% of images (cfg 1.0 ignores negatives), so the film is described, not named.
STYLE = ('dark desert sci-fi illustration, epic desert-planet film aesthetic, muted ochre and umber palette, '
         'amber rim light, matte painting, high detail, centered on black background, '
         'no text, no logo, no lettering, unmarked')
LANDSCAPE_STYLE = ('dark desert sci-fi illustration, epic desert-planet film aesthetic, muted ochre and umber palette, '
                   'amber rim light, matte painting, high detail, no text, no letters, no labels')
NEGATIVE = ('text, letters, watermark, signature, logo, caption, blurry, lowres, deformed, extra limbs, '
            'cartoon, anime, bright saturated colors, frame, border')

# Per-id subject overrides. Anything not listed falls back to "<name>, <category>".
SUBJECTS = {
    # weapons
    'crysknife': 'a curved milky-white crystal knife carved from a sandworm tooth, ornate wrapped hilt, single object',
    'kindjal': 'a short double-edged noble dagger with a slightly curved blade and a jeweled hilt, single object',
    'slip-tip': 'a slender poisoned stiletto with a needle point and a hollow channel, single object',
    'rapier': 'a duelling rapier with a swept guard and a thin blade, single object',
    'maula-pistol': 'a compact spring-powered dart pistol with a brass body, single object',
    'lasgun-pistol': 'a sleek laser sidearm with glowing amber emitter, single object',
    'lasgun-rifle': 'a long laser rifle with a ribbed power cell and amber emitter, single object',
    'lasgun-carbine': 'a short military laser carbine with a folding stock, single object',
    'hunter-seeker': 'a needle-thin floating assassin drone with a tiny glowing eye, single object hovering',
    'stunner': 'a small stun-dart pistol with a coiled barrel, single object',
    'flip-dart': 'a set of three small throwing darts in a leather wrist sheath, single object',
    'gom-jabbar': 'a single long golden needle held between two fingers, poisoned tip glinting',
    'shigawire-garrote': 'a coil of impossibly thin metallic wire with two small grips, single object',
    'chrysknife-ceremonial': 'an ancient crystal knife on a stone altar, cloth wrappings',
    'heavy-lascannon': 'a heavy tripod-mounted laser cannon, military, single object',
    'thopter-rockets': 'an ornithopter wing rocket pod, military hardware, single object',
    'artillery-battery': 'a squat desert artillery cannon emplacement half buried in sand',
    'atomics': 'a sealed metallic family atomics casket with warning sigils, single object',
    'sword': 'a broad soldier\'s sword with a plain guard, single object',
    'fremen-maula': 'a battered desert-worn dart pistol wrapped in cloth, single object',
    'stone-burner': 'a forbidden compact atomic device with a timer dial, single object',
    'sardaukar-blade': 'a heavy curved military blade with crimson-wrapped grip, single object',
    # armor
    'shield-belt-personal': 'a personal force-shield belt with a glowing amber buckle, faint shimmering blue force field',
    'shield-belt-military': 'a heavy military shield generator belt with power cells, faint blue shimmer',
    'shield-belt-dueling': 'an ornate dueling shield belt with filigree, faint shimmer',
    'stillsuit': 'a desert survival bodysuit with tubes and a nose plug, displayed on a stand',
    'sardaukar-armor': 'dark grey padded combat armor with a crimson sash displayed on a wooden stand, no helmet',
    'dueling-leathers': 'padded leather dueling jerkin with bracers, displayed on a stand',
    'harkonnen-armor': 'black glossy industrial soldier armor with a high collar, displayed on a stand',
    'desert-cloak': 'a heavy sand-colored hooded desert cloak, displayed on a stand',
    # gear
    'fremkit': 'an open leather desert survival kit with tools, cords and small canisters',
    'paracompass': 'a brass desert compass with magnetic needle and engraved bezel, single object',
    'thumper': 'a spring-wound metal stake device planted in sand, rhythmic hammer, single object',
    'sandsnork': 'a breathing tube with a filter cap for being buried in sand, single object',
    'water-rings': 'a cord strung with metal rings of different sizes, single object',
    'poison-snooper': 'a small radiation-scanning poison detector on a table, glowing amber lens',
    'filmbook': 'a tiny unmarked crystal disc projecting a thin beam of light, single object',
    'cone-of-silence': 'a small anti-eavesdropping field projector creating a faint dome of distortion',
    'distrans': 'a small desert bat with a tiny metal device strapped to its back',
    'solido-projector': 'a holographic projector casting a translucent figure of a robed man',
    'spice-melange': 'a small heap of glowing orange-cinnamon powder in a cupped hand',
    'semuta': 'a dark glass vial of narcotic, smoky residue, single object',
    'sapho-juice': 'a small decanter of dark red juice, single object',
    'verite': 'a sealed glass ampoule of amber liquid resting in a velvet case, unlabeled',
    'ornithopter-access': 'a dragonfly-winged aircraft parked on a rock pad',
    'sandcrawler': 'a massive tracked spice harvester crawler on dunes',
    'maker-hooks': 'two long hooked poles with leather grips for climbing a sandworm',
    'stilltent': 'a small sealed dome tent half buried in sand at dusk',
    'literjon': 'a sealed one-liter water container with a cap, single object',
    'chaumurky-kit': 'a poison antidote kit with vials and syringes',
    'suk-medkit': 'a doctor\'s medical case with surgical tools and diamond tattoo emblem',
    'glowglobe': 'a plain unmarked glowing amber light orb floating above the sand',
    'signet-ring': 'a heavy ducal signet ring with a hawk seal, single object',
    'forged-papers': 'a folded stack of blank parchment documents with red wax seals, no writing',
    'solari-purse': 'a plain unmarked leather pouch with metal coins spilling out',
    'krimskell-rope': 'a coil of hooked fiber rope, single object',
    'oil-lens-binoculars': 'heavy oil-lens binoculars, single object',
    'spice-coffee': 'an ornate coffee service with a spice-scented pot and small cups',
    'dew-collector': 'a curved dew collecting device with condensation beads',
    'windtrap': 'a tall desert windtrap tower against the sky',
    'baliset': 'a nine-string musical instrument resting on a cushion',
    'suspensor-chair': 'a floating suspensor chair hovering above a floor',
    'shield-wall-map': 'an old leather map of a desert region pinned with markers',
    'sietch-token': 'a carved bone token on a cord, single object',
    'cutteray': 'a handheld sci-fi cutting laser torch with a glowing orange emitter tip, single object',
    'carryall-contract': 'a giant carryall aircraft lifting a crawler over dunes',
    'water-of-life': 'a glowing blue liquid in a stone bowl in darkness',
    'ixian-probe': 'a sinister interrogation probe device with metal tendrils',
    'house-livery': 'folded noble livery tunic with embroidered crest',
    'bindu-meditation-cushion': 'a simple meditation mat and incense in a stone room',
    'radio-comm': 'a rugged unmarked field radio transceiver with a short antenna, single object',
    'heat-mask': 'a desert face mask with filters and goggles, single object',
    'stillsuit-repair': 'an open rolled leather pouch with patches, thin tubes and small seal pots, unlabeled',
    'slave-collar': 'a menacing control collar, single object',
    'ledger-crystal': 'a glowing data crystal containing account ledgers',
    'sandmask': 'a cloth desert face mask with goggles, single object',
    # creatures / threats
    'sandworm-small': 'a young eyeless segmented sandworm, tube-shaped body like a giant earthworm, round mouth ringed with crystal teeth, bursting from a dune, no eyes, no legs',
    'sandworm-grown': 'a huge sandworm rising from the desert, enormous circular maw, tiny figures below',
    'sandworm-ancient': 'a colossal eyeless segmented sandworm rising vertically from the dunes, giant tube-shaped body like an earthworm, enormous round mouth ringed with crystal teeth, no legs, no eyes, dust storm, tiny humans below',
    'sardaukar-squad': 'a squad of grim elite soldiers in dark grey padded combat armor and long grey cloaks, shaved heads, no helmets, rain and mist, brutalist',
    'harkonnen-assassin': 'a pale bald assassin in black with a poisoned blade, shadows',
    'creatures/hunter-seeker': 'a needle-thin floating assassin drone with a glowing eye in a dark bedroom',
    'spice-blow': 'an eruption of orange spice and sand exploding from the desert floor',
    'sandstorm': 'a towering brown wall of sandstorm rolling over the dunes, lightning flickering inside it, a tiny aircraft fleeing',
    'fremen-fedaykin': 'a desert warrior in a stillsuit with glowing blue eyes and a crystal knife',
    'bene-gesserit-sister': 'a veiled woman in black robes with piercing eyes, candlelight',
    'mentat-assassin': 'a gaunt advisor with red-stained lips holding a dagger behind his back',
    'guild-agent': 'a tall robed spacing guild agent with a hood and a strange breathing apparatus',
    'laza-tiger': 'a lean striped desert tiger with long fangs, snarling',
    'salusan-bull': 'a massive horned black bull with scarred hide, snorting dust',
    'harkonnen-troopers': 'black-armored industrial soldiers with flame lances in an orange haze',
    'smuggler-crew': 'a group of rough desert smugglers in mixed gear by a crawler',
    'desert-bandits': 'desert raiders in tattered cloaks on a rock ridge',
    'sandtrout': 'small flat leathery brown sand creatures like flattened leeches crawling around a small pool of water in the sand, macro',
    'face-dancer': 'a shapeshifter with a half-changing blank face, unsettling',
    # archetype portraits
    'mentat': 'portrait of a Mentat advisor, grey-haired, red-stained lips, calculating eyes, formal dark coat',
    'bene-gesserit': 'portrait of a Bene Gesserit reverend sister, black hooded robes, veiled hair, stern',
    'swordmaster': 'portrait of a veteran swordmaster, scarred face, leather and metal armor, sword hilt',
    'noble-scion': 'portrait of a young noble heir, dark military uniform with house insignia, proud',
    'fremen-guide': 'portrait of a Fremen desert guide, stillsuit and hood, blue-within-blue eyes',
    'suk-doctor': 'portrait of a Suk doctor, diamond tattoo on forehead, long hair in silver ring, calm',
    'spy-agent': 'portrait of a spy in a hooded cloak half in shadow, watchful eyes',
    'smuggler': 'portrait of a weathered smuggler with goggles on forehead and a stubbled grin',
    'planetologist': 'portrait of a planetologist, weathered skin, desert scarf, data pad, thoughtful',
    'guild-envoy': 'portrait of a Spacing Guild envoy, tall, bald, pale, strange collar device, unsettling',
    # houses / factions
    'house-atreides': 'a red hawk emblem on a green and black banner in a stone hall',
    'house-harkonnen': 'a griffin emblem on a pale blue banner in a black industrial hall',
    'house-corrino': 'a golden lion emblem on a scarlet banner in an imperial throne room',
    'house-tessarin': 'an emblem of a closed hand holding a water drop on an ochre and slate banner',
    'house-vaszari': 'an emblem of three stacked crescents on a white and indigo banner, salt flats',
    'house-ordrane': 'an emblem of a stag skull on a grey and russet banner, cold forest',
    'faction-bene-gesserit': 'a circle of black robed women in a dark stone chamber',
    'faction-spacing-guild': 'a colossal cylindrical starship in orbit above an orange desert planet, outer space, stars',
    'faction-fremen': 'robed desert warriors walking in single file along a dune ridge at dusk',
    'faction-choam': 'a vast merchant council chamber with ledgers and gold light',
    'faction-sardaukar': 'rows of elite soldiers in dark grey padded armor and grey cloaks standing in formation in heavy rain, shaved heads, no helmets',
    'faction-mentats': 'a mentat in a dark library with glowing data crystals',
    'faction-suk': 'a sterile medical chamber with a Suk doctor at work',
}

# Images not tied to a catalog item: map illustrations + place art.
EXTRAS = [
    ('/maps/dune/harvester-crawler.webp', 1536, 1024, 'map',
     'top-down orthographic tactical battle map of a giant spice harvester crawler in the deep desert, '
     'rectangular industrial deck with machinery bays, cockpit at one end, intake scoops, catwalks, '
     'surrounded by rippled sand dunes, overhead view, game map, grid-friendly'),
    ('/maps/dune/carthag-market.webp', 1536, 1024, 'map',
     'top-down orthographic tactical battle map of a crowded desert city lower market district, '
     'narrow alleys, stalls with cloth awnings, a central fountain plaza, flat rooftops, overhead view, game map'),
    ('/art/dune/places/arrakeen-residency.webp', 1536, 1024, 'land',
     'a monumental brutalist desert palace with tall stone walls at sunset, ornithopters overhead'),
    ('/art/dune/places/sietch-qarrat.webp', 1536, 1024, 'land',
     'a hidden cave entrance in a towering rock wall above the desert, Fremen silhouettes, dusk'),
]


def http_json(path, payload=None):
    url = HOST + path
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def workflow(model, prompt, w, h, seed, negative=NEGATIVE):
    if model == 'zimage':
        return {
            '1': {'class_type': 'UNETLoader', 'inputs': {'unet_name': 'z_image_turbo_bf16.safetensors', 'weight_dtype': 'default'}},
            '2': {'class_type': 'CLIPLoader', 'inputs': {'clip_name': 'qwen_3_4b.safetensors', 'type': 'lumina2'}},
            '3': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'ae.safetensors'}},
            '4': {'class_type': 'ModelSamplingAuraFlow', 'inputs': {'model': ['1', 0], 'shift': 3.0}},
            '5': {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['2', 0], 'text': prompt}},
            '6': {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['2', 0], 'text': negative}},
            '7': {'class_type': 'EmptySD3LatentImage', 'inputs': {'width': w, 'height': h, 'batch_size': 1}},
            '8': {'class_type': 'KSampler', 'inputs': {'model': ['4', 0], 'positive': ['5', 0], 'negative': ['6', 0],
                  'latent_image': ['7', 0], 'seed': seed, 'steps': 8, 'cfg': 1.0,
                  'sampler_name': 'res_multistep', 'scheduler': 'simple', 'denoise': 1.0}},
            '9': {'class_type': 'VAEDecode', 'inputs': {'samples': ['8', 0], 'vae': ['3', 0]}},
            '10': {'class_type': 'SaveImage', 'inputs': {'images': ['9', 0], 'filename_prefix': 'dune_art'}},
        }
    # flux schnell (single-file checkpoint)
    return {
        '1': {'class_type': 'CheckpointLoaderSimple', 'inputs': {'ckpt_name': 'flux1-schnell-fp8.safetensors'}},
        '5': {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['1', 1], 'text': prompt}},
        '6': {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['1', 1], 'text': ''}},
        '7': {'class_type': 'EmptySD3LatentImage', 'inputs': {'width': w, 'height': h, 'batch_size': 1}},
        '8': {'class_type': 'KSampler', 'inputs': {'model': ['1', 0], 'positive': ['5', 0], 'negative': ['6', 0],
              'latent_image': ['7', 0], 'seed': seed, 'steps': 4, 'cfg': 1.0,
              'sampler_name': 'euler', 'scheduler': 'simple', 'denoise': 1.0}},
        '9': {'class_type': 'VAEDecode', 'inputs': {'samples': ['8', 0], 'vae': ['1', 2]}},
        '10': {'class_type': 'SaveImage', 'inputs': {'images': ['9', 0], 'filename_prefix': 'dune_art'}},
    }


def generate(model, prompt, w, h, seed):
    res = http_json('/prompt', {'prompt': workflow(model, prompt, w, h, seed), 'client_id': 'gen-dune-art'})
    pid = res['prompt_id']
    t0 = time.time()
    while time.time() - t0 < 300:
        time.sleep(1.5)
        hist = http_json(f'/history/{pid}')
        if pid in hist:
            entry = hist[pid]
            if entry.get('status', {}).get('status_str') == 'error':
                raise RuntimeError(json.dumps(entry['status'])[:500])
            for node in entry.get('outputs', {}).values():
                for img in node.get('images', []):
                    q = urllib.parse.urlencode({'filename': img['filename'], 'subfolder': img.get('subfolder', ''), 'type': img.get('type', 'output')})
                    with urllib.request.urlopen(f'{HOST}/view?{q}', timeout=60) as r:
                        return r.read(), time.time() - t0
    raise TimeoutError('ComfyUI did not finish in 300 s')


def save_webp(png_bytes, out_path, max_kb=300):
    img = Image.open(io.BytesIO(png_bytes)).convert('RGB')
    out_path.parent.mkdir(parents=True, exist_ok=True)
    for q in (85, 78, 70, 62, 55):
        buf = io.BytesIO()
        img.save(buf, 'WEBP', quality=q, method=6)
        if buf.tell() <= max_kb * 1024:
            break
    out_path.write_bytes(buf.getvalue())
    return buf.tell(), q


def collect_jobs():
    jobs = []
    seen = set()
    files = ['careers.json', 'weapons.json', 'armor.json', 'gear.json', 'creatures.json', 'factions.json']
    for fn in files:
        p = CATALOG / fn
        if not p.exists():
            continue
        for item in json.loads(p.read_text(encoding='utf-8')):
            for key in ('art', 'portrait'):
                art = item.get(key)
                if not art or art in seen or not art.startswith('/art/dune/'):
                    continue
                seen.add(art)
                stem = Path(art).stem
                subject = SUBJECTS.get(f'{Path(art).parent.name}/{stem}') or SUBJECTS.get(stem) or f"{item['name']}, {item.get('category', '')}"
                folder = Path(art).parent.name
                if folder in ('creatures', 'factions'):
                    w, h = 1024, 1024
                else:
                    w, h = 1024, 1024
                jobs.append((art, w, h, 'item', subject))
    for key in ('house-atreides', 'house-harkonnen', 'house-corrino', 'house-tessarin', 'house-vaszari', 'house-ordrane',
                'faction-bene-gesserit', 'faction-spacing-guild', 'faction-fremen', 'faction-choam',
                'faction-sardaukar', 'faction-mentats', 'faction-suk'):
        art = f'/art/dune/factions/{key}.webp'
        if art not in seen:
            seen.add(art)
            jobs.append((art, 1024, 1024, 'item', SUBJECTS[key]))
    for art, w, h, kind, subject in EXTRAS:
        if art not in seen:
            jobs.append((art, w, h, kind, subject))
    return jobs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', default='zimage', choices=['zimage', 'flux'])
    ap.add_argument('--only', help='substring of the art path to generate')
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--list', action='store_true')
    ap.add_argument('--seed', type=int, default=None)
    args = ap.parse_args()

    jobs = collect_jobs()
    if args.only:
        keys = [k for k in args.only.split(',') if k]
        jobs = [j for j in jobs if any(k in j[0] for k in keys)]
    if args.list:
        for j in jobs:
            print(j[0], j[1], j[2], '|', j[4][:70])
        print(len(jobs), 'jobs')
        return
    SCRATCH.mkdir(parents=True, exist_ok=True)
    done = skipped = failed = 0
    for art, w, h, kind, subject in jobs:
        out = PUBLIC / art.lstrip('/')
        if out.exists() and not args.force:
            skipped += 1
            continue
        style = LANDSCAPE_STYLE if kind in ('map', 'land') else STYLE
        prompt = f'{subject}, {style}'
        seed = args.seed if args.seed is not None else random.randint(1, 2**31)
        try:
            png, secs = generate(args.model, prompt, w, h, seed)
            (SCRATCH / (Path(art).stem + '.png')).write_bytes(png)
            size, q = save_webp(png, out)
            done += 1
            print(f'OK {art} {w}x{h} {secs:.1f}s {size // 1024}KB q{q}', flush=True)
        except Exception as e:  # keep going; report at the end
            failed += 1
            print(f'FAIL {art}: {e}', flush=True)
    print(f'done={done} skipped={skipped} failed={failed}')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
