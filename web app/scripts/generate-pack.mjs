#!/usr/bin/env node
/* Generate a content pack with Claude from the command line.

   node scripts/generate-pack.mjs --universe alien --players 4 \
     --names "Hayden,Sam,Jo,Alex" --playtime session --tone dread,betrayal \
     --setting "derelict mining station near Anchorpoint" --out content/alien/

   Options:
     --universe <id>        registry id (default alien)
     --players <n>          1–8 (default: number of --names, else 4)
     --names "A,B,C"        player names (characters get assignment hints)
     --playtime <p>         one-shot | session | long (or the full values)
     --type <t>             Cinematic | One-Shot | Campaign
     --tone a,b,c           tone keywords
     --setting "..."  --threat "..."  --themes "..."  --avoid "..."
     --difficulty <d>       Introductory | Standard | Brutal
     --lethality <l>        low | medium | high
     --title "..."          seed title
     --no-maps              skip ASCII maps
     --out <dir|file.json>  output (default content/<universe>/)
     --dry-run              print the full prompt + token estimate, no generation
     --json                 with --dry-run: print the full request JSON (incl. output schema)

   Uses ANTHROPIC_API_KEY / GENERATOR_MODEL / GENERATOR_EFFORT from env or web app/.env.
   GENERATOR_MOCK=1 generates a mock pack without calling the API. */
import { writeFileSync, mkdirSync, existsSync, statSync } from 'fs';
import { join, resolve, extname, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generatePack, dryRun } from '../server/generator/core.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const [k, inline] = a.slice(2).split(/=(.*)/s);
    if (['dry-run', 'no-maps', 'json', 'help', 'maps'].includes(k)) { out[k] = true; continue; }
    out[k] = inline !== undefined ? inline : argv[++i];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(readUsage());
  process.exit(0);
}

function readUsage() {
  return 'Usage: node scripts/generate-pack.mjs --universe alien --players 4 --playtime session [--dry-run] (see header of this file for all options)';
}

const universeId = args.universe || 'alien';
const names = args.names ? String(args.names).split(',').map((s) => s.trim()).filter(Boolean) : undefined;
const params = {
  players: args.players ? Number(args.players) : (names?.length || 4),
  playtime: args.playtime || 'session',
  ...(names ? { playerNames: names } : {}),
  ...(args.type ? { type: args.type } : {}),
  ...(args.tone ? { tone: String(args.tone).split(',').map((s) => s.trim()).filter(Boolean) } : {}),
  ...(args.setting ? { setting: args.setting } : {}),
  ...(args.threat ? { threat: args.threat } : {}),
  ...(args.themes ? { themes: args.themes } : {}),
  ...(args.avoid ? { avoid: args.avoid } : {}),
  ...(args.difficulty ? { difficulty: args.difficulty } : {}),
  ...(args.lethality ? { lethality: args.lethality } : {}),
  ...(args.title ? { seedTitle: args.title } : {}),
  includeMaps: !args['no-maps'],
};

const ts = () => new Date().toISOString().slice(11, 19);

async function main() {
  if (args['dry-run']) {
    const { request, estimatedInputTokens, roughInputTokens } = await dryRun({ universeId, params });
    if (args.json) {
      console.log(JSON.stringify(request, null, 2));
    } else {
      console.log('════════ REQUEST ════════');
      console.log(`model: ${request.model}   max_tokens: ${request.max_tokens}   effort: ${request.output_config.effort}`);
      console.log(`betas: ${request.betas ? request.betas.join(', ') : '(none)'}   fallbacks: ${request.fallbacks ?? '(off)'}`);
      request.system.forEach((b, i) => {
        console.log(`\n════════ SYSTEM BLOCK ${i + 1}${b.cache_control ? ' [cache_control: ephemeral]' : ''} ════════`);
        console.log(b.text);
      });
      console.log('\n════════ USER MESSAGE ════════');
      console.log(request.messages[0].content);
      const schemaLen = JSON.stringify(request.output_config.format.schema).length;
      console.log(`\n════════ OUTPUT SCHEMA ════════\njson_schema, ${schemaLen} chars (use --json to print it)`);
    }
    (args.json ? console.error : console.log)(estimatedInputTokens != null
      ? `\nEstimated input tokens (count_tokens): ${estimatedInputTokens}`
      : `\nEstimated input tokens (rough, ~4 chars/token; set ANTHROPIC_API_KEY for an exact count): ~${roughInputTokens}`);
    return;
  }

  let lastDelta = 0;
  const { pack, repaired } = await generatePack({
    universeId,
    params,
    onStatus: (message, extra) => {
      const bits = [];
      if (extra?.estimatedInputTokens != null) bits.push(`~${extra.estimatedInputTokens} input tokens`);
      if (extra?.model) bits.push(`model ${extra.model}`);
      console.log(`[${ts()}] ${message}${bits.length ? ` (${bits.join(', ')})` : ''}`);
      if (extra?.errors) extra.errors.forEach((e) => console.log(`           - ${e}`));
    },
    onDelta: (chars) => {
      if (chars - lastDelta >= 5000) { lastDelta = chars; console.log(`[${ts()}] … ${chars} chars received`); }
    },
  });

  let outPath = resolve(ROOT, args.out || join('content', universeId));
  const isFile = extname(outPath).toLowerCase() === '.json' && !(existsSync(outPath) && statSync(outPath).isDirectory());
  if (!isFile) { mkdirSync(outPath, { recursive: true }); outPath = join(outPath, `${pack.id}.json`); } else mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(pack, null, 2) + '\n', 'utf8');
  console.log(`[${ts()}] ${repaired ? 'Pack repaired and validated.' : 'Pack validated.'} "${pack.meta.title}" (${pack.acts?.length || 0} acts, ${pack.characters?.length || 0} characters)`);
  console.log(outPath);
}

main().catch((e) => {
  console.error(`ERROR [${e.code || 'error'}]: ${e.message}`);
  if (e.hint) console.error(`hint: ${e.hint}`);
  if (e.errors) e.errors.slice(0, 40).forEach((x) => console.error(`  - ${x}`));
  process.exit(1);
});
