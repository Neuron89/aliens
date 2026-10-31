import React, { useState, useMemo, useEffect, useRef } from 'react';
import { catalog } from '../universe.core.js';
import { houses } from '../reference/houses.js';
import { factions } from '../reference/factions.js';
import { rules } from '../rules.js';

/* ═══════════════════════════════════════════════════════════════════════
   THE IMPERIUM — Dune reference tab.
   Card grids with generated art for archetypes, weapons, armor, assets,
   threats, Houses and factions; category chips + search; a detail drawer
   with stats, effects and cross-references. Consequence tables for
   conditions and injuries. All data from ../catalog/*.json.
   ═══════════════════════════════════════════════════════════════════════ */

const DRIVE = Object.fromEntries(rules.attributes.map((a) => [a.key, a.label]));
const SKILL = Object.fromEntries(rules.skills.map((s) => [s.key, s.label]));
const ITEMS = new Map([...catalog.weapons, ...catalog.armor, ...catalog.gear].map((i) => [i.id, i]));
const TALENTS = new Map(catalog.talents.map((t) => [t.id, t]));
const nice = (s) => String(s || '').replace(/-/g, ' ').toUpperCase();

const TABS = [
  { id: 'archetypes', label: 'ARCHETYPES', items: catalog.careers, cat: () => 'archetype' },
  { id: 'weapons', label: 'WEAPONS', items: catalog.weapons, cat: (x) => x.category },
  { id: 'armor', label: 'SHIELDS & ARMOR', items: catalog.armor, cat: (x) => x.category },
  { id: 'gear', label: 'ASSETS & GEAR', items: catalog.gear, cat: (x) => x.category },
  { id: 'threats', label: 'THREATS', items: catalog.creatures, cat: (x) => x.type },
  { id: 'houses', label: 'HOUSES', items: houses, cat: (x) => (/minor/i.test(x.rank) ? 'minor house' : x.rank.toLowerCase()) },
  { id: 'factions', label: 'FACTIONS', items: factions, cat: () => 'faction' },
  { id: 'consequences', label: 'CONSEQUENCES', items: null },
];

/* Pills shown on each card, per tab. */
function pills(tab, x) {
  switch (tab) {
    case 'archetypes': return [`${nice(x.keyAttribute)}`, ...x.keySkills.map(nice)];
    case 'weapons': return [`STRESS ${x.stats.damage}`, nice(x.stats.range), `Q${x.stats.quality}`];
    case 'armor': return [x.rating ? `SOAK ${x.rating}` : 'NO SOAK', `Q${x.quality}`];
    case 'gear': return [`Q${x.quality}`, x.cost ? `${x.cost} ◈` : 'NOT SOLD'];
    case 'threats': return [`EVADE D${x.stats.evade}`, `STRESS ${x.stats.stress}`, `THREAT ${x.stats.threat}`];
    case 'houses': return [x.seat.split(',')[0]];
    default: return [];
  }
}

const CSS = `
.dr-tabs{display:flex;flex-wrap:wrap;gap:.35rem;margin-bottom:.6rem}
.dr-tabs button,.dr-chips button{font-family:var(--font-mono);font-size:.72rem;letter-spacing:.12em;background:var(--bg-card);
  color:var(--text-dim);border:1px solid var(--border);padding:.42rem .7rem;cursor:pointer;border-radius:2px}
.dr-tabs button[aria-pressed=true]{color:var(--bg-dark);background:var(--accent);border-color:var(--accent-bright)}
.dr-tabs button:hover,.dr-chips button:hover{border-color:var(--border-bright);color:var(--text)}
.dr-tools{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin-bottom:1rem}
.dr-chips{display:flex;flex-wrap:wrap;gap:.3rem;flex:1}
.dr-chips button{font-size:.65rem;padding:.3rem .55rem}
.dr-chips button[aria-pressed=true]{color:var(--accent-bright);border-color:var(--accent);background:var(--accent-glow)}
.dr-search{background:var(--bg-input);border:1px solid var(--border);color:var(--text);padding:.4rem .6rem;font-family:var(--font-mono);
  font-size:.8rem;min-width:12rem;border-radius:2px}
.dr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(178px,1fr));gap:.8rem}
.dr-card{position:relative;display:flex;flex-direction:column;text-align:left;background:var(--bg-card);border:1px solid var(--border);
  border-radius:3px;overflow:hidden;cursor:pointer;padding:0;color:inherit;font:inherit;transition:border-color .25s,transform .25s}
.dr-card:hover,.dr-card:focus-visible{border-color:var(--accent);transform:translateY(-2px);outline:none}
.dr-art{position:relative;aspect-ratio:1/1;background:#000;overflow:hidden}
.dr-art img{width:100%;height:100%;object-fit:cover;display:block;opacity:.92;transition:opacity .3s,transform .6s}
.dr-card:hover .dr-art img{opacity:1;transform:scale(1.04)}
.dr-art::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%,rgba(8,5,2,.85))}
.dr-cat{position:absolute;left:.5rem;bottom:.45rem;z-index:1;font-size:.6rem;letter-spacing:.16em;color:var(--accent-bright)}
/* card body: not .dr-body, which is the GM run drawer body (run/Drawer.jsx) and would leak into every Dune drawer */
.dr-cardbody{padding:.55rem .65rem .7rem;display:flex;flex-direction:column;gap:.4rem;flex:1}
.dr-name{font-family:var(--font-display);font-size:.88rem;color:var(--text-bright);letter-spacing:.04em;line-height:1.25}
.dr-pills{display:flex;flex-wrap:wrap;gap:.25rem}
.dr-pill{font-size:.6rem;letter-spacing:.08em;padding:.12rem .4rem;border:1px solid var(--border-bright);color:var(--text-dim);border-radius:2px}
.dr-empty{color:var(--text-dim);padding:2rem;text-align:center}
.dr-backdrop{position:fixed;inset:0;background:rgba(5,3,1,.62);z-index:1100;animation:dr-fade .25s ease}
.dr-drawer{position:fixed;top:0;right:0;bottom:0;width:min(470px,100vw);background:var(--bg-panel);border-left:1px solid var(--border-bright);
  z-index:1101;overflow-y:auto;box-shadow:-20px 0 60px rgba(0,0,0,.6);animation:dr-slide .32s cubic-bezier(.2,.7,.2,1)}
.dr-drawer-art{position:relative;aspect-ratio:1/1;background:#000}
.dr-drawer-art img{width:100%;height:100%;object-fit:cover;display:block}
.dr-drawer-art::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 60%,var(--bg-panel))}
.dr-close{position:absolute;top:.6rem;right:.6rem;z-index:2;background:rgba(10,7,4,.75);color:var(--text-bright);border:1px solid var(--border-bright);
  width:2.2rem;height:2.2rem;font-size:1rem;cursor:pointer;border-radius:2px}
.dr-close:focus-visible{outline:2px solid var(--accent)}
.dr-content{padding:0 1.2rem 1.6rem;margin-top:-2.2rem;position:relative}
.dr-content h3{font-family:var(--font-display);font-size:1.35rem;color:var(--text-bright);letter-spacing:.05em;margin:0 0 .2rem}
.dr-kicker{font-size:.65rem;letter-spacing:.2em;color:var(--accent)}
.dr-sec{margin-top:1.05rem}
.dr-sec h4{font-size:.62rem;letter-spacing:.22em;color:var(--text-dim);margin:0 0 .4rem;border-bottom:1px solid var(--border);padding-bottom:.25rem}
.dr-p{font-size:.86rem;line-height:1.6;color:var(--text)}
.dr-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:.4rem}
.dr-stat{border:1px solid var(--border);padding:.35rem .5rem;background:var(--bg-card)}
.dr-stat b{display:block;font-size:1rem;color:var(--text-bright);font-weight:600}
.dr-stat span{font-size:.58rem;letter-spacing:.16em;color:var(--text-dim)}
.dr-fx{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:.35rem}
.dr-fx li{font-size:.8rem;line-height:1.45;padding:.35rem .55rem;border-left:3px solid var(--border-bright);background:var(--bg-card)}
.dr-fx li.buff{border-left-color:var(--success)}
.dr-fx li.debuff{border-left-color:var(--danger)}
.dr-fx li small{display:block;font-size:.6rem;letter-spacing:.14em;color:var(--text-dim)}
.dr-tags{display:flex;flex-wrap:wrap;gap:.3rem}
.dr-link{background:none;border:none;color:var(--accent-bright);cursor:pointer;font:inherit;padding:0;text-decoration:underline dotted}
.dr-table{width:100%;border-collapse:collapse;font-size:.8rem}
.dr-table th,.dr-table td{border-bottom:1px solid var(--border);padding:.45rem .5rem;text-align:left;vertical-align:top}
.dr-table th{color:var(--accent);font-weight:600;white-space:nowrap}
.dr-sev{font-size:.6rem;letter-spacing:.12em;padding:.1rem .35rem;border:1px solid var(--border-bright);white-space:nowrap}
.dr-sev.severe,.dr-sev.critical{color:var(--danger);border-color:var(--danger)}
.dr-sev.moderate{color:var(--warn);border-color:var(--warn-dim)}
@keyframes dr-slide{from{transform:translateX(100%)}to{transform:none}}
@keyframes dr-fade{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion: reduce){.dr-drawer,.dr-backdrop{animation:none}.dr-card,.dr-art img{transition:none}.dr-card:hover{transform:none}}
@media (max-width:520px){.dr-grid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr))}.dr-search{min-width:0;flex:1}}
`;

function Card({ tab, item, catLabel, onOpen }) {
  return (
    <button type="button" className="dr-card" onClick={() => onOpen(item)} aria-label={`${item.name} — details`}>
      <div className="dr-art">
        {item.art ? <img src={item.art} alt="" loading="lazy" /> : null}
        <span className="dr-cat">{nice(catLabel)}</span>
      </div>
      <div className="dr-cardbody">
        <div className="dr-name">{item.name}</div>
        <div className="dr-pills">{pills(tab, item).map((p, i) => <span key={i} className="dr-pill">{p}</span>)}</div>
      </div>
    </button>
  );
}

function Stat({ label, value }) {
  if (value === undefined || value === null || value === '') return null;
  return <div className="dr-stat"><b>{value}</b><span>{label}</span></div>;
}

function Effects({ effects }) {
  if (!effects?.length) return null;
  return (
    <div className="dr-sec">
      <h4>EFFECTS</h4>
      <ul className="dr-fx">
        {effects.map((e, i) => (
          <li key={i} className={e.kind}>
            <small>{e.kind === 'buff' ? '▲ BUFF' : '▼ DEBUFF'}{e.target && e.target !== 'other' ? ` · ${nice(e.target.replace(/^(skill|attr):/, ''))}` : ''}{e.when ? ` · ${e.when.toUpperCase()}` : ''}</small>
            {e.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ItemLink({ id, onOpen }) {
  const it = ITEMS.get(id);
  if (!it) return <span>{id}</span>;
  return <button type="button" className="dr-link" onClick={() => onOpen(it, it.stats?.damage !== undefined ? 'weapons' : it.rating !== undefined ? 'armor' : 'gear')}>{it.name}</button>;
}

function DrawerBody({ tab, x, onOpen }) {
  if (tab === 'archetypes') {
    const sg = x.startingGear || {};
    return (
      <>
        <p className="dr-p">{x.description}</p>
        <div className="dr-sec"><h4>KEY DRIVE & SKILLS</h4>
          <div className="dr-stats"><Stat label="KEY DRIVE" value={DRIVE[x.keyAttribute]} />{x.keySkills.map((s) => <Stat key={s} label="KEY SKILL" value={SKILL[s]} />)}</div>
        </div>
        <div className="dr-sec"><h4>TALENTS</h4>
          <ul className="dr-fx">{x.talents.map((id) => { const t = TALENTS.get(id); return t ? <li key={id} className="buff"><small>{t.name.toUpperCase()}</small>{t.text}</li> : null; })}</ul>
        </div>
        <div className="dr-sec"><h4>STARTING ASSETS</h4>
          <p className="dr-p">
            {(sg.fixed || []).map((id, i) => <React.Fragment key={id}>{i > 0 && ', '}<ItemLink id={id} onOpen={onOpen} /></React.Fragment>)}
          </p>
          {(sg.choices || []).map((line, i) => (
            <p key={i} className="dr-p" style={{ color: 'var(--text-dim)' }}>
              One of: {line.map((id, j) => <React.Fragment key={id}>{j > 0 && ' / '}<ItemLink id={id} onOpen={onOpen} /></React.Fragment>)}
            </p>
          ))}
        </div>
        <div className="dr-sec"><h4>APPEARANCE</h4><p className="dr-p">{x.appearanceHints.join(' · ')}</p></div>
        <div className="dr-sec"><h4>AGENDA IDEAS</h4><ul className="dr-fx">{x.agendaHints.map((a) => <li key={a}>{a}</li>)}</ul></div>
        {x.typicalNames && <div className="dr-sec"><h4>TYPICAL NAMES</h4><p className="dr-p">{x.typicalNames.join(' · ')}</p></div>}
      </>
    );
  }
  if (tab === 'weapons' || tab === 'armor' || tab === 'gear') {
    const s = x.stats || {};
    return (
      <>
        <p className="dr-p">{x.notes}</p>
        <div className="dr-sec"><h4>STATS</h4>
          <div className="dr-stats">
            {tab === 'weapons' && <><Stat label="STRESS" value={s.damage} /><Stat label="RANGE" value={nice(s.range)} /><Stat label="QUALITY" value={s.quality} /><Stat label="FREE d20" value={s.bonus ? `+${s.bonus}` : '—'} /><Stat label="WEIGHT" value={s.weight} /><Stat label="COST ◈" value={s.cost || 'NOT SOLD'} /></>}
            {tab === 'armor' && <><Stat label="SOAK" value={x.rating} /><Stat label="QUALITY" value={x.quality} /><Stat label="WEIGHT" value={x.weight} /><Stat label="COST ◈" value={x.cost || 'NOT SOLD'} /></>}
            {tab === 'gear' && <><Stat label="QUALITY" value={x.quality} /><Stat label="WEIGHT" value={x.weight} /><Stat label="COST ◈" value={x.cost || 'NOT SOLD'} /></>}
          </div>
        </div>
        <Effects effects={x.effects} />
        {x.tags?.length > 0 && <div className="dr-sec"><h4>TAGS</h4><div className="dr-tags">{x.tags.map((t) => <span key={t} className="dr-pill">{nice(t)}</span>)}</div></div>}
      </>
    );
  }
  if (tab === 'threats') {
    const s = x.stats;
    return (
      <>
        <p className="dr-p">{x.special}</p>
        <div className="dr-sec"><h4>IN PLAY</h4>
          <div className="dr-stats"><Stat label="EVADE" value={`D${s.evade}`} /><Stat label="STRESS" value={s.stress} /><Stat label="THREAT COST" value={s.threat} /><Stat label="SCALE" value={nice(s.scale)} /></div>
          <p className="dr-p" style={{ marginTop: '.5rem' }}><span className="dr-kicker">TEST </span>{s.test}</p>
        </div>
        {x.signatureAttacks?.length > 0 && (
          <div className="dr-sec"><h4>ACTIONS (ROLL D20)</h4>
            <table className="dr-table"><tbody>{x.signatureAttacks.map((a) => <tr key={a.roll}><th>{a.roll}</th><td><b>{a.name}.</b> {a.text}</td></tr>)}</tbody></table>
          </div>
        )}
        {x.tactics && <div className="dr-sec"><h4>TACTICS</h4><p className="dr-p">{x.tactics}</p></div>}
        <div className="dr-sec"><h4>NARRATOR NOTES</h4><p className="dr-p">{x.notes}</p></div>
        <Effects effects={x.effects} />
        <p className="dr-p" style={{ color: 'var(--text-dim)', fontSize: '.72rem', marginTop: '1rem' }}>Pack reference id: <code>{x.id}</code></p>
      </>
    );
  }
  if (tab === 'houses') {
    return (
      <>
        <div className="dr-stats"><Stat label="RANK" value={x.rank} /><Stat label="SEAT" value={x.seat} /></div>
        <p className="dr-p" style={{ marginTop: '.6rem', color: 'var(--text-dim)' }}>{x.colors}</p>
        <div className="dr-sec"><h4>THE HOUSE</h4><p className="dr-p">{x.summary}</p></div>
        <div className="dr-sec"><h4>HOOKS</h4><ul className="dr-fx">{x.hooks.map((h) => <li key={h}>{h}</li>)}</ul></div>
      </>
    );
  }
  return (
    <>
      <div className="dr-sec"><h4>WANTS</h4><p className="dr-p">{x.wants}</p></div>
      <div className="dr-sec"><h4>METHODS</h4><p className="dr-p">{x.methods}</p></div>
      <div className="dr-sec"><h4>AT THE TABLE</h4><p className="dr-p">{x.atTheTable}</p></div>
    </>
  );
}

function Drawer({ open, onClose, onOpen }) {
  const closeRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const { item: x, tab } = open;
  const kicker = tab === 'archetypes' ? 'ARCHETYPE' : tab === 'threats' ? `THREAT · ${nice(x.type)}` : tab === 'houses' ? 'HOUSE' : tab === 'factions' ? 'FACTION' : nice(x.category);
  return (
    <>
      <div className="dr-backdrop" onClick={onClose} />
      <aside className="dr-drawer" role="dialog" aria-modal="true" aria-label={x.name}>
        <div className="dr-drawer-art">
          {x.art && <img src={x.art} alt={x.name} />}
          <button ref={closeRef} type="button" className="dr-close" onClick={onClose} aria-label="Close details">✕</button>
        </div>
        <div className="dr-content">
          <div className="dr-kicker">{kicker}</div>
          <h3>{x.name}</h3>
          <DrawerBody tab={tab} x={x} onOpen={onOpen} />
        </div>
      </aside>
    </>
  );
}

function Consequences() {
  return (
    <div>
      <div className="panel">
        <h2>CONSEQUENCES (ROLL 1D20 WHEN TAKEN OUT)</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '.85rem', marginBottom: '.75rem' }}>
          Dune has no hit points. At maximum Stress a character is taken out and suffers one of these. Lethal results need help before the time runs out.
        </p>
        <table className="dr-table">
          <thead><tr><th>D20</th><th>CONSEQUENCE</th><th>EFFECT</th><th>RECOVERY</th></tr></thead>
          <tbody>
            {catalog.injuries.map((i) => (
              <tr key={i.id}>
                <th>{i.roll}</th>
                <td><b>{i.name}</b> <span className={`dr-sev ${i.severity}`}>{i.fatal ? 'LETHAL' : i.severity.toUpperCase()}</span><br /><span style={{ color: 'var(--text-dim)' }}>{nice(i.category)}</span></td>
                <td>{i.text} {i.effects.map((e) => e.text).join(' ')}{i.timeLimit ? ` (within ${i.timeLimit})` : ''}</td>
                <td>{i.healBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel">
        <h2>CONDITIONS</h2>
        <table className="dr-table">
          <thead><tr><th>CONDITION</th><th>EFFECT</th><th>CLEARED BY</th></tr></thead>
          <tbody>
            {catalog.conditions.map((c) => (
              <tr key={c.id}>
                <th>{c.name} <span className={`dr-sev ${c.severity}`}>{c.severity.toUpperCase()}</span></th>
                <td>{c.text} {c.effects.map((e) => e.text).join('; ')}</td>
                <td>{c.healBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DuneReference() {
  const [tabId, setTabId] = useState('archetypes');
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const tab = TABS.find((t) => t.id === tabId);

  const cats = useMemo(() => (tab.items ? [...new Set(tab.items.map(tab.cat))] : []), [tab]);
  const shown = useMemo(() => {
    if (!tab.items) return [];
    const needle = q.trim().toLowerCase();
    return tab.items.filter((x) => (cat === 'all' || tab.cat(x) === cat)
      && (!needle || JSON.stringify([x.name, x.notes, x.tags, x.description, x.summary, x.wants]).toLowerCase().includes(needle)));
  }, [tab, cat, q]);

  const switchTab = (id) => { setTabId(id); setCat('all'); setQ(''); };
  const openItem = (item, forceTab) => setOpen({ item, tab: forceTab || tabId });

  return (
    <div>
      <style>{CSS}</style>
      <div className="panel">
        <h2>THE IMPERIUM</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
          Archetypes, arms, assets and the powers that move the Imperium, as summarized by your House Mentat. Select any card for its full entry.
          Threat entries list the Difficulty to evade them, the Stress they inflict and the Threat the Narrator pays to bring them in.
        </p>
      </div>
      <div className="dr-tabs" role="toolbar" aria-label="Reference sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" aria-pressed={t.id === tabId} onClick={() => switchTab(t.id)}>
            {t.label}{t.items ? ` (${t.items.length})` : ''}
          </button>
        ))}
      </div>
      {tab.items ? (
        <>
          <div className="dr-tools">
            {cats.length > 1 && (
              <div className="dr-chips" role="toolbar" aria-label="Filter by category">
                <button type="button" aria-pressed={cat === 'all'} onClick={() => setCat('all')}>ALL</button>
                {cats.map((c) => <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)}>{nice(c)}</button>)}
              </div>
            )}
            <input className="dr-search" type="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search this section" />
          </div>
          {shown.length ? (
            <div className="dr-grid">{shown.map((x) => <Card key={x.id} tab={tabId} item={x} catLabel={tab.cat(x)} onOpen={openItem} />)}</div>
          ) : <div className="dr-empty">Nothing matches.</div>}
        </>
      ) : <Consequences />}
      <Drawer open={open} onClose={() => setOpen(null)} onOpen={openItem} />
    </div>
  );
}
