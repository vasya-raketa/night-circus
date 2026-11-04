// Generates art assets with Google's Gemini image models (official @google/genai SDK).
// Every request gets the art bible text + the style reference image, so all assets match.
// Each asset has a type: character, prop, hazard, ui, fx or background. All but backgrounds get
// art_drop/ref/OUTPUT_RULES.md (single object on green) at the end of the prompt.
//
//   node tools/gen_image.js                  all assets in tools/assets.json (skips existing files)
//   node tools/gen_image.js bg_tent_wide     only the named assets
//   node tools/gen_image.js --force          regenerate even if the file exists
//   node tools/gen_image.js --model gemini-3-pro-image --list other.json
//
// The key is read from key.env (gemini_api_key=...) or the GEMINI_API_KEY env variable.
// Images are saved to art_drop/<name>.png. Nothing else is written or sent anywhere.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'art_drop');
const REF_DIR = path.join(OUT_DIR, 'ref');
const DEFAULT_MODEL = 'gemini-3.1-flash-image';
const TYPES = ['character', 'prop', 'hazard', 'ui', 'fx', 'background'];

function parseArgs(argv) {
  const args = { names: [], force: false, model: DEFAULT_MODEL, list: path.join(ROOT, 'tools', 'assets.json') };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force') args.force = true;
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--list') args.list = path.resolve(argv[++i]);
    else args.names.push(a);
  }
  return args;
}

function readKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  const file = path.join(ROOT, 'key.env');
  if (!fs.existsSync(file)) throw new Error('No key: create key.env with gemini_api_key=... or set GEMINI_API_KEY');
  const m = fs.readFileSync(file, 'utf8').match(/^\s*(?:gemini_api_key|GEMINI_API_KEY)\s*=\s*['"]?([^'"\s]+)/m);
  if (!m) throw new Error('key.env has no gemini_api_key=... line');
  return m[1];
}

// Art bible + style reference, sent with every asset; output rules for non-background assets.
function loadReference() {
  const bible = fs.readFileSync(path.join(REF_DIR, 'ART_BIBLE.md'), 'utf8');
  const image = fs.readFileSync(path.join(REF_DIR, 'style_ref.jpg')).toString('base64');
  const outputRules = fs.readFileSync(path.join(REF_DIR, 'OUTPUT_RULES.md'), 'utf8');
  return { bible, image, outputRules };
}

async function generate(ai, model, ref, asset) {
  const prompt = [
    ref.bible.trim(),
    '',
    `ASSET: ${asset.name}`,
    asset.prompt.trim(),
    'Match the attached style reference for line weight, shading and colors. Output one image only, no text, no watermark.',
    ...(asset.type === 'background' ? [] : ['', ref.outputRules.trim()])
  ].join('\n');
  const res = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: ref.image } }, { text: prompt }] }],
    config: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: asset.aspectRatio ?? '16:9', ...(asset.imageSize ? { imageSize: asset.imageSize } : {}) }
    }
  });
  const parts = res.candidates?.[0]?.content?.parts ?? [];
  const img = parts.find((p) => p.inlineData?.data);
  if (!img) {
    const why = res.candidates?.[0]?.finishReason ?? res.promptFeedback?.blockReason ?? 'no image in response';
    throw new Error(`${why} ${parts.map((p) => p.text).filter(Boolean).join(' ')}`.trim());
  }
  return Buffer.from(img.inlineData.data, 'base64');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const assets = JSON.parse(fs.readFileSync(args.list, 'utf8'));
  const untyped = assets.filter((a) => !TYPES.includes(a.type));
  if (untyped.length) throw new Error(`Set "type" (${TYPES.join(', ')}) for: ${untyped.map((a) => a.name).join(', ')}`);
  const unknown = args.names.filter((n) => !assets.some((a) => a.name === n));
  if (unknown.length) throw new Error(`Not in ${path.basename(args.list)}: ${unknown.join(', ')}`);
  const todo = assets.filter((a) => !args.names.length || args.names.includes(a.name));

  const ai = new GoogleGenAI({ apiKey: readKey() });
  const ref = loadReference();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let failed = 0;
  for (const asset of todo) {
    const out = path.join(OUT_DIR, `${asset.name}.png`);
    if (fs.existsSync(out) && !args.force) {
      console.log(`skip  ${asset.name} (exists, use --force)`);
      continue;
    }
    process.stdout.write(`gen   ${asset.name} (${args.model}, ${asset.aspectRatio ?? '16:9'}) ... `);
    try {
      const png = await generate(ai, args.model, ref, asset);
      fs.writeFileSync(out, png);
      console.log(`saved art_drop/${asset.name}.png (${Math.round(png.length / 1024)} KB)`);
    } catch (e) {
      failed++;
      console.log(`FAILED: ${e.message}`);
      // Billing / key problems fail every asset the same way: stop instead of retrying them all.
      if (/"code":\s*(401|402|403)/.test(e.message)) {
        console.log('Stopping: fix the API key or billing at https://ai.studio/projects, then run again.');
        break;
      }
    }
  }
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
