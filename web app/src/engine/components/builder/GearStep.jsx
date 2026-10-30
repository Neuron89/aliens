import React, { useMemo, useState } from 'react';
import { startingGearFor, requiredPicks, encumbrance, armorRating, slug } from '../../catalogUtils';
import { cartToGear } from './builderState';
import { ItemArt, WeightBar, StatsRow } from '../sheet/parts';

const TABS = [
  { id: 'weapon', label: 'WEAPONS' },
  { id: 'armor', label: 'ARMOR' },
  { id: 'gear', label: 'GEAR' },
];

/* Hidden unless "SHOW ALL": vehicle-scale weapons and million-credit installations. */
const isCarryable = (it) => !it.tags.includes('vehicle-mounted') && !it.tags.includes('vehicle-scale') && !(it.cost >= 1000000);

let keySeq = 0;
const cartKey = (s) => `${slug(s)}-${Date.now().toString(36)}${(keySeq++).toString(36)}`;

/* Step 5: catalog browser + cart + starting kit + custom items. */
export default function GearStep({ universe, catalog, career, char, cart, setCart, T }) {
  const [tab, setTab] = useState('weapon');
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [kitOpen, setKitOpen] = useState(false);
  const [custom, setCustom] = useState('');

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return catalog.items.filter((it) => it.type === tab
      && (showAll || isCarryable(it))
      && (!s || it.name.toLowerCase().includes(s) || it.tags.some((t) => t.includes(s)) || String(it.category || '').includes(s)));
  }, [catalog, tab, q, showAll]);

  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.id, catalog.items.filter((i) => i.type === t.id).length])), [catalog]);
  const preview = { ...char, gear: cartToGear(cart) };
  const enc = encumbrance(preview, universe, catalog);
  const armor = armorRating(preview, catalog);

  const add = (item, qty = 1) => setCart((prev) => {
    const i = prev.findIndex((c) => c.id && c.id === item.id);
    if (i >= 0) return prev.map((c, j) => (j === i ? { ...c, qty: c.qty + qty } : c));
    return [...prev, { key: cartKey(item.name), id: item.id, name: item.name, qty, custom: false }];
  });
  const setQty = (key, qty) => setCart((prev) => (qty <= 0 ? prev.filter((c) => c.key !== key) : prev.map((c) => (c.key === key ? { ...c, qty } : c))));
  const addCustom = () => {
    const name = custom.trim();
    if (!name) return;
    setCart((prev) => [...prev, { key: cartKey(name), id: null, name, qty: 1, custom: true }]);
    setCustom('');
  };
  const inCart = (it) => cart.find((c) => c.id === it.id)?.qty || 0;

  return (
    <>
      <div className="panel cb-cart">
        <div className="cb-cart-head">
          <h3 className="cb-section-title">CARRIED ({cart.reduce((n, c) => n + c.qty, 0)})</h3>
          {armor !== null && <span className="cb-pill">ARMOR {armor}</span>}
        </div>
        <WeightBar used={enc.used} max={enc.max} label="LOAD" />
        {enc.over && <p className="cb-warn">Over capacity — you can carry up to double this briefly, but must pass a MOBILITY test to run.</p>}
        {cart.length === 0 && <p className="cs-empty">Nothing yet. Apply your starting kit or add items below.</p>}
        <ul className="cb-cart-list">
          {cart.map((c) => {
            const it = c.id ? catalog.items.find((x) => x.id === c.id) : null;
            return (
              <li key={c.key}>
                <span className="cb-cart-name">{c.name}{c.custom && <small> CUSTOM</small>}</span>
                <span className="cb-cart-wt">{it ? (it.weight === null ? '—' : it.weight * c.qty) : '?'}</span>
                <div className="cb-counter sm">
                  <button type="button" onClick={() => setQty(c.key, c.qty - 1)} aria-label={`Remove one ${c.name}`}>−</button>
                  <span className="cb-counter-val">{c.qty}</span>
                  <button type="button" onClick={() => setQty(c.key, c.qty + 1)} aria-label={`Add one ${c.name}`}>+</button>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="cb-cart-actions">
          {career && <button type="button" className="cb-btn primary" onClick={() => setKitOpen((o) => !o)}>{kitOpen ? 'CLOSE KIT' : 'STARTING KIT'}</button>}
          {cart.length > 0 && <button type="button" className="cb-btn" onClick={() => setCart([])}>CLEAR</button>}
        </div>
        {kitOpen && career && <KitPicker career={career} catalog={catalog} onApply={(items, qtys) => { items.forEach((it) => add(it, qtys[it.id] || 1)); setKitOpen(false); }} />}
        <div className="cb-custom">
          <input className="cb-input" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCustom()} placeholder="Custom item…" aria-label="Custom item name" />
          <button type="button" className="cb-btn" onClick={addCustom} disabled={!custom.trim()}>ADD</button>
        </div>
      </div>

      <div className="panel cb-browser">
        <div className="cb-tabs" role="tablist">
          {TABS.filter((t) => counts[t.id] > 0).map((t) => (
            <button type="button" role="tab" key={t.id} aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.id === 'gear' ? T.gear.toUpperCase() : t.label} <small>{counts[t.id]}</small>
            </button>
          ))}
        </div>
        <div className="cb-search">
          <input className="cb-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, tag, category…" aria-label="Search catalog" />
          <label className="cb-check"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> SHOW ALL</label>
        </div>
        <div className="cb-items">
          {list.map((it) => {
            const n = inCart(it);
            return (
              <div key={it.id} className={`cb-item${n ? ' in-cart' : ''}`}>
                <ItemArt item={it} size={56} />
                <div className="cb-item-body">
                  <div className="cb-item-name">{it.name}{it.source && <small>{it.source}</small>}</div>
                  <StatsRow item={it} />
                  {it.tags.length > 0 && <div className="cb-tags">{it.tags.slice(0, 5).map((t) => <span key={t}>{t}</span>)}</div>}
                  {it.notes && <p className="cb-item-notes">{it.notes}</p>}
                </div>
                <button type="button" className="cb-btn add" onClick={() => add(it)} aria-label={`Add ${it.name}`}>{n ? `+1 (${n})` : 'ADD'}</button>
              </div>
            );
          })}
          {list.length === 0 && <p className="cs-empty">No items match.</p>}
        </div>
      </div>
    </>
  );
}

/* Starting kit: fixed items + one radio group per choice line.
   pick = number → choose that many lines (one item each); 'all' → one item from every line. */
function KitPicker({ career, catalog, onApply }) {
  const sg = startingGearFor(career, catalog);
  const need = requiredPicks(sg);
  const [sel, setSel] = useState(() => sg.choices.map((_, i) => (sg.pick === 'all' || i < need ? 0 : null)));
  const picked = sel.filter((x) => x !== null).length;
  const valid = picked === need;
  const res = startingGearFor(career, catalog, sel);
  return (
    <div className="cb-kit">
      {sg.rule && <p className="cb-hint">{sg.rule}</p>}
      {sg.fixed.length > 0 && (
        <div className="cb-kit-fixed"><i>INCLUDED</i>{sg.fixed.map((f) => f.name).join(' · ')}</div>
      )}
      {sg.choices.map((group, gi) => (
        <fieldset key={gi} className="cb-kit-group">
          <legend>{sg.pick === 'all' ? `CHOOSE ONE (${gi + 1})` : `LINE ${gi + 1}`}</legend>
          {sg.pick !== 'all' && (
            <label className="cb-radio-opt">
              <input type="radio" name={`kit-${gi}`} checked={sel[gi] === null} onChange={() => setSel((s) => s.map((v, j) => (j === gi ? null : v)))} />
              <span>— skip this line —</span>
            </label>
          )}
          {group.map((it, ii) => (
            <label key={it.id + ii} className="cb-radio-opt">
              <input type="radio" name={`kit-${gi}`} checked={sel[gi] === ii} onChange={() => setSel((s) => s.map((v, j) => (j === gi ? ii : v)))} />
              <span>{it.name}{sg.quantities?.[it.id] ? ` ×${sg.quantities[it.id]}` : ''}</span>
            </label>
          ))}
        </fieldset>
      ))}
      {sg.choices.length > 0 && (
        <p className={`cb-hint${valid ? '' : ' warn'}`}>{sg.pick === 'all' ? 'One item from every line.' : `Lines chosen: ${picked} / ${need}`}</p>
      )}
      {sg.cash && <p className="cb-hint">Starting cash: {sg.cash}</p>}
      <button type="button" className="cb-btn primary" disabled={!valid} onClick={() => onApply(res.items, sg.quantities || {})}>APPLY KIT</button>
    </div>
  );
}
