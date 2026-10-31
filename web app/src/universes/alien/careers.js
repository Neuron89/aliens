/* ALIEN RPG careers and the gear pick-list, as used by the scenario generator
   (server/generator/prompt.js) and as the legacy fallback when no catalog is loaded.

   Derived from the catalog (catalog/careers.json + talents.json) so the generator
   is told exactly the careers, key skills and talents the character builder and
   sheet resolve. Only the nine CRB careers are listed; the ACM Marine MOS stay
   builder-only (they use their own creation caps, see rules.js careerKinds). */
import careersCatalog from './catalog/careers.json' with { type: 'json' };
import talentsCatalog from './catalog/talents.json' with { type: 'json' };

const talentText = (id) => {
  const t = talentsCatalog.find((x) => x.id === id);
  return t ? `${t.name} — ${t.text}` : id;
};

export const careers = careersCatalog
  .filter((c) => c.kind !== 'mos')
  .map((c) => ({
    name: c.name,
    keyAttribute: c.keyAttribute,
    keySkills: [...c.keySkills],
    talents: c.talents.map(talentText),
  }));

/* Common carried items, spelled exactly as catalog item names so they resolve on the sheet. */
export const gear = [
  'M4A3 Service Pistol', '.357 Magnum Revolver', 'Rexim RXF-M5 EVA Pistol', 'Watatsumi DV-303 Bolt Gun',
  'Armat M41A Pulse Rifle', 'M42A Scope Rifle', 'Armat Model 37A2 12 Gauge Pump Action', 'Norcomm AK-4047 Pulse Assault Rifle',
  'M240 Incinerator Unit', 'M56A2 Smart Gun', 'Armat U1 Grenade Launcher', 'G2 Electroshock Grenade', 'Armat M40 HEDP Grenade',
  'Knife', 'Stun Baton', 'Mechanical Cutting Torch', 'Maintenance Jack',
  'M3 Personnel Armor', 'IRC Mk.50 Compression Suit', 'IRC Mk.35 Pressure Suit', 'Weyland-Yutani APEsuit',
  'Seegson P-DAT', 'M314 Motion Tracker', 'Personal Medkit', 'Electronic Tools', 'Hand Radio',
  'Hi-beam Flashlight', 'Binoculars', 'Signal Flare', 'Prefab Meal', 'Water Bottle', 'Samani E-Series Watch',
  'Personal Locator Beacon', 'Survival Kit',
];
