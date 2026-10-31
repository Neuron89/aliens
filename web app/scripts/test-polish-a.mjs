/* Polish wave A — headless checks (no server, no browser):
   1. sheet/Portrait.jsx monogram(): spelled-out ranks / titles are skipped like the short forms.
   2. player/HandoutDoc.jsx markSeenOnce(): the handout-seen receipt fires once per handout.
   3. Source wiring: one handout reader (PhoneLayer mounts HandoutDoc; PlayerView and HandoutViewer
      no longer in the path), the TRACKER tab icon is a real path (no CSS stand-in), the tab bar sizes
      itself for 4 or 5 tabs, the TV hides the ROUND box while the spotlight banner shows the turn,
      the GM strip has a ⋯ overflow menu, and an untrained (0) skill renders as an empty box.
   Usage: node scripts/test-polish-a.mjs */
import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import assert from 'assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };
const src = (p) => readFileSync(join(ROOT, p), 'utf8');

const { build } = await import('esbuild');
const outDir = join(ROOT, 'node_modules', '.cache', 'test-polish-a');
mkdirSync(outDir, { recursive: true });
/* App contexts (import.meta.glob of the content packs etc.) are stubbed: only pure helpers are tested. */
const stubContexts = {
  name: 'stub-contexts',
  setup(b) {
    b.onResolve({ filter: /\/(UniverseContext|GameContext|apiToken|sfx)$/ }, (a) => ({ path: a.path, namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const useUniverse = () => ({}); export const useGame = () => ({}); export const apiHeaders = () => ({}); export const play = () => {}; export const reducedFx = () => true;', loader: 'js' }));
  },
};
async function load(entry, name) {
  const outfile = join(outDir, `${name}.mjs`);
  await build({ entryPoints: [join(ROOT, entry)], bundle: true, format: 'esm', platform: 'neutral', outfile, external: ['react', 'react/jsx-runtime'], jsx: 'automatic',
    loader: { '.jsx': 'jsx', '.css': 'empty', '.json': 'json' }, plugins: [stubContexts], logLevel: 'error' });
  return import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
}

/* ── 1. Monogram ── */
{
  const { monogram } = await load('src/engine/components/sheet/Portrait.jsx', 'portrait');
  const cases = [
    ['Sergeant Ruth Okafor', 'RO'], ['Sgt. Ruth Okafor', 'RO'], ['Cpl. Dana Hicks', 'DH'], ['Corporal Dana Hicks', 'DH'],
    ['Captain Ellen Vance', 'EV'], ['Lieutenant Mara Ortiz', 'MO'], ['Doctor Ilse Brandt', 'IB'], ['Dr. Ilse Brandt', 'IB'],
    ['Lady Margot Fenring', 'MF'], ['Lord Kaius Varrin', 'KV'], ['Duke Leto Atreides', 'LA'], ['Duchess Ilia Moritani', 'IM'],
    ['Reverend Mother Gaius Helen Mohiam', 'GM'], ['Master Tomas Hale', 'TH'], ['Private Jo Pike', 'JP'], ['Major Ren Abara', 'RA'],
    ['Colonel Asha Diallo', 'AD'], ['Commander Ivo Strand', 'IS'], ['Captain Dr. Vance Ruiz', 'VR'], ['The Lady Ysolde', 'YS'],
    ['Ruth Okafor', 'RO'], ['Ash', 'AS'], ['Bishop (synthetic)', 'BI'], ['Captain', 'CA'], ['Lady', 'LA'], ['', '?'],
    ['Majorie Coll', 'MC'], ['Masterson Reed', 'MR'], ['Duncan Idaho', 'DI'],
  ];
  for (const [name, want] of cases) eq(monogram(name), want, `monogram(${JSON.stringify(name)})`);
}

/* ── 2. handout-seen once ── */
{
  const hd = await load('src/engine/components/player/HandoutDoc.jsx', 'handout-doc');
  const sent = [];
  const onSeen = (id) => sent.push(id);
  ok(hd.markSeenOnce({ id: 'h-1', seen: false }, onSeen), 'first open sends the receipt');
  ok(!hd.markSeenOnce({ id: 'h-1', seen: false }, onSeen), 're-mount (StrictMode / reopen from FILES) does not resend');
  ok(!hd.markSeenOnce({ id: 'h-2', seen: true }, onSeen), 'already seen → no receipt');
  ok(!hd.markSeenOnce(null, onSeen) && !hd.markSeenOnce({ id: 'h-3' }, null), 'no handout / no callback → nothing');
  ok(hd.markSeenOnce({ id: 'h-3' }, onSeen), 'another handout sends its own receipt');
  eq(sent, ['h-1', 'h-3'], 'exactly one receipt per handout');
}

/* ── 3. Wiring ── */
{
  const phone = src('src/engine/components/player/PhoneLayer.jsx');
  const pv = src('src/engine/components/PlayerView.jsx');
  ok(/import HandoutDoc from '\.\/HandoutDoc'/.test(phone) && /<HandoutDoc [^>]*onSeen=\{handoutSeen\}/.test(phone), 'PhoneLayer mounts HandoutDoc with the seen receipt');
  ok(!/HandoutViewer/.test(phone) && !/HandoutViewer|<HandoutDoc/.test(pv), 'single reader: no HandoutViewer, no second mount in PlayerView');
  const hdSrc = src('src/engine/components/player/HandoutDoc.jsx');
  ok(/useDialog\(onClose\)/.test(hdSrc) && /e\.key !== 'Tab'/.test(hdSrc) && /data-autofocus onClick=\{onClose\}>CLOSE/.test(hdSrc), 'reader keeps focus management (dialog hook, Tab trap, CLOSE)');

  const icons = src('src/engine/components/player/icons.jsx');
  ok(/^\s*tracker: </m.test(icons), "icons.jsx has a 'tracker' path");
  ok(/\['tracker', 'TRACKER', 'tracker'\]/.test(pv), 'TRACKER tab uses the tracker icon');
  const trk = src('src/engine/components/player/tracker.css');
  ok(!/\.pp-tabs/.test(trk) && !/mask:/.test(trk), 'tracker.css: no tab-bar override, no CSS-drawn icon');
  const pcss = src('src/engine/components/player/player.css');
  ok(/\.pp-tabs \{[^}]*grid-auto-flow: column;[^}]*grid-auto-columns: minmax\(0, 1fr\)/.test(pcss), 'tab bar sizes itself for any tab count');

  const ov = src('src/engine/components/board/Overlays.jsx');
  const bv = src('src/engine/components/BoardView.jsx');
  ok(/Overlays\(\{ terminalName, hideTurn = false \}\)/.test(ov) && /ini\?\.current && !hideTurn/.test(ov), 'Overlays hides the ROUND box on hideTurn');
  ok(/<Overlays terminalName=\{terminalName\} hideTurn=\{!!spotTurn\} \/>/.test(bv), 'BoardView passes hideTurn while the spotlight banner shows');

  const hdr = src('src/engine/components/Header.jsx');
  ok(/function StripMore/.test(hdr) && /className="strip-more-btn"/.test(hdr) && /aria-expanded=\{open\}/.test(hdr), 'GM strip ⋯ overflow menu');
  ok(/\{dmLive && <CodeButton/.test(hdr) && /<UniversesButton align="right" \/>/.test(hdr), 'CODE and UNIVERSES stay in the strip');
  const css = src('src/index.css');
  ok(/@media \(max-width: 600px\) \{\s*\.strip-inline \{ display: none; \}\s*\.strip-more \{ display: inline-block; \}/.test(css), '≤ 600px: chips collapse into ⋯');
  ok(/\.strip-more-btn \{[^}]*min-width: 44px; height: 44px/.test(css), '⋯ is a 44px target');

  const sheet = src('src/engine/components/CharacterSheet.jsx');
  ok(/cs-skill-val is-zero/.test(sheet) && /\.cs-zero \{/.test(css), 'skill 0 renders as an empty box');
}

console.log(`test-polish-a: ${checks} checks passed`);
