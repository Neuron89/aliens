/* UI helper checks (no browser): Maps-tab grouping, the Stories card plan
   picker and the MapEngine legend layout. Run: node scripts/test-ui-polish.mjs */
import assert from 'assert/strict';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };

const { groupMaps, planNoun, firstPlan } = await imp('src/engine/components/mapGroups.js');
const { legendLayout, pathPoints, polygonHitsRect, LEGEND_MAX_ROWS, LEGEND_COL_W } = await imp('src/engine/components/legendLayout.js');
const { maps: alienMaps } = await imp('src/universes/alien/maps/index.js');
const { maps: duneMaps } = await imp('src/universes/dune/maps/index.js');
const pack = (u, id) => JSON.parse(readFileSync(join(ROOT, `src/universes/${u}/content/${id}.json`), 'utf8'));

/* ── planNoun ── */
eq(planNoun({ theme: { board: { levelNoun: 'DECK' } } }), 'DECK PLAN', 'ALIEN plan noun');
eq(planNoun({ theme: { board: { levelNoun: 'LEVEL' } } }), 'FLOOR PLAN', 'DUNE plan noun');
eq(planNoun(null), 'DECK PLAN', 'default plan noun');

/* ── groupMaps: the Chariot pack (2 plans + 4 Cronus deck images) and an image-only pack ── */
const engineIds = new Set(alienMaps.filter((m) => m.kind === 'engine').map((m) => m.id));
const tag = (p) => (p.maps || []).map((m) => ({ ...m, engine: m.engine || (engineIds.has(m.id) ? m.id : undefined), group: p.meta.title }));
const chariot = pack('alien', 'chariot-of-the-gods');
const acm = pack('alien', 'acm-arcturian-apocalypse');
const groups = groupMaps([...tag(acm), ...tag(chariot)]);
eq(groups.map((g) => g.name), [chariot.meta.title, acm.meta.title], 'scenarios with an interactive plan sort first');
const cg = groups[0];
eq(cg.items.map((i) => i.map.id), ['uscss-montero', 'uscss-cronus'], 'Chariot shows its two plans at top level');
eq(cg.items[1].children.map((m) => m.id), ['cronus-deck-a', 'cronus-deck-b', 'cronus-deck-c', 'cronus-deck-d'], 'Cronus deck images fold under the Cronus');
eq(cg.items[0].children, [], 'Montero has no folded images');
eq(cg.maps.length, chariot.maps.length, 'group count still counts every map');
eq(groups[1].items.length, acm.maps.length, 'image-only pack keeps every map at top level');
ok(groups[1].items.every((i) => i.children.length === 0), 'unrelated images never fold');
const explicit = groupMaps([{ id: 'p', title: 'SHIP', group: 'G', engine: 'p' }, { id: 'x', title: 'Unrelated', src: '/x.png', parent: 'p', group: 'G' }]);
eq(explicit[0].items[0].children.map((m) => m.id), ['x'], 'explicit parent folds an image');

/* ── firstPlan: first pack map with an engine plan (universe map engine.config) ── */
const fakeEngine = (id) => Object.assign(() => null, { config: { decks: [{ id: 'A', level: `${id}-l1` }] } });
const uni = { maps: [
  { id: 'ship-a', engine: fakeEngine('a'), levels: [{ id: 'a-l1' }], crop: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 } },
  { id: 'ship-b', engine: fakeEngine('b') },
  { id: 'image-only', src: '/i.png' },
] };
eq(firstPlan(uni, { maps: [{ id: 'image-only', src: '/i.png' }, { id: 'ship-b' }] })?.level, 'b-l1', 'skips image maps, level from the deck');
eq(firstPlan(uni, { maps: [{ id: 'pack-copy', engine: 'ship-a' }] })?.crop, { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }, 'string engine ref resolves, keeps crop');
eq(firstPlan(uni, { maps: [{ id: 'image-only' }] }), null, 'no plan → null (motif fallback)');
eq(firstPlan(uni, {}), null, 'pack without maps → null');

/* Every bundled pack of both universes names a map that exists as an engine plan (so every card gets a thumbnail). */
for (const [u, umaps] of [['alien', alienMaps], ['dune', duneMaps]]) {
  const ids = new Set(umaps.filter((m) => m.kind === 'engine').map((m) => m.id));
  for (const id of ['chariot-of-the-gods', 'destroyer-of-worlds', 'heart-of-darkness', 'hopes-last-day', 'kesslers-landing', 'ridgeback-station', 'tartarus-reach',
    'the-water-debt', 'silence-on-the-erg', 'the-nine-days-of-silence', 'the-weighing-of-house-varrin']) {
    const f = join(ROOT, `src/universes/${u}/content/${id}.json`);
    if (!existsSync(f)) continue;
    const p = pack(u, id);
    ok((p.maps || []).some((m) => ids.has(typeof m.engine === 'string' ? m.engine : m.id)), `${u}/${id} has an engine plan for its library card`);
  }
}

/* ── legend layout ── */
const rows = (n) => Array.from({ length: n }, (_, i) => ({ y: 18 + i * 18, label: i % 3 ? 'DOORWAY' : 'CREW AREA (FLOOR TINT)' }));
eq(legendLayout(rows(10), { x: 905, y: 85 }).twoCol, false, '10 rows stay one column');
eq(legendLayout(rows(LEGEND_MAX_ROWS), { x: 905, y: 85 }).twoCol, false, `${LEGEND_MAX_ROWS} rows stay one column`);
const two = legendLayout(rows(15), { x: 905, y: 85 });
eq([two.twoCol, two.rows], [true, 8], '15 rows wrap into 8 + 7');
eq(two.dy, 8 * 18, 'second column moves up to the first row');
ok(two.boxW > LEGEND_COL_W && two.dx === two.boxW - LEGEND_COL_W, 'box grows leftwards, right edge kept');
ok(two.colW >= 20 + 'CREW AREA (FLOOR TINT)'.length * 3.9, 'columns fit the longest label');
eq(legendLayout(rows(15), { columns: 1 }).twoCol, false, 'legendColumns: 1 forces one column');
eq(legendLayout(rows(4), { columns: 2 }).rows, 2, 'legendColumns: 2 forces two');
eq(pathPoints('M 0 0 L 10 0 L 10 10 Z'), [[0, 0], [10, 0], [10, 10]], 'pathPoints parses an absolute polygon');
eq(pathPoints('M0 0 c 1 1 2 2 3 3'), null, 'curves/relative paths are not guessed');
ok(polygonHitsRect([[0, 0], [10, 0], [10, 10], [0, 10]], { x0: 5, y0: 5, x1: 20, y1: 20 }), 'overlap detected');
ok(!polygonHitsRect([[0, 0], [10, 0], [10, 10], [0, 10]], { x0: 11, y0: 0, x1: 20, y1: 5 }), 'clear rect not hit');
ok(polygonHitsRect([[0, 0], [100, 0], [100, 100], [0, 100]], { x0: 40, y0: 40, x1: 60, y1: 60 }), 'rect inside polygon is a hit');
/* Real plans: Prometheus' hexagon leaves room for two columns; Fort Nebraska's site fills the corner, so it stays one tall column. */
for (const [name, expect] of [['prometheus', true], ['nebraska', false]]) {
  const g = await imp(`src/universes/alien/maps/${name}.geometry.js`);
  const lay = legendLayout(rows(name === 'prometheus' ? 15 : 14), { x: g.W - 195, y: 85, hullPath: g.OUTLINE });
  eq(lay.twoCol, expect, `${name}: legend ${expect ? 'wraps' : 'stays one column'} around the hull`);
}

console.log(`test-ui-polish: ${checks} checks passed`);
