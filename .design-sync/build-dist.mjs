// Builds the library that design-sync converts for Claude Design:
//   .design-sync/.cache/dist/index.mjs   the real components (src/components),
//                                        Firebase/auth swapped for sample data
//   .design-sync/.cache/dist/allania.css the app's Tailwind CSS + safelist
// Run from the repo root: node .design-sync/build-dist.mjs
// (esbuild comes from .ds-sync/; Tailwind/postcss/react from the repo.)
import { createRequire } from 'module';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const out = join(here, '.cache', 'dist');
const requireSync = createRequire(join(root, '.ds-sync', 'package.json'));
const requireRepo = createRequire(join(root, 'package.json'));
const esbuild = requireSync('esbuild');

// Module swaps: the data/auth layer only - every component is the app's own
const stub = (f) => join(here, 'stubs', f);
const SWAPS = {
  '@/context/GameContext': stub('GameContext.js'),
  '@/lib/firebase': stub('firebase-misc.js'),
  '@/lib/constants': stub('constants.js'),
  '@/lib/artAssets': stub('artAssets.js'),
  'firebase/firestore': stub('firestore.js'),
  'firebase/storage': stub('firebase-misc.js'),
  'firebase/functions': stub('firebase-misc.js'),
  'next/link': stub('next-link.js')
};

const resolveSrc = (spec) => {
  const base = join(root, 'src', spec.slice(2));
  for (const cand of [base, `${base}.js`, join(base, 'index.js')]) {
    try { readFileSync(cand); return cand; } catch { /* next */ }
  }
  return null;
};

const aliases = {
  name: 'allania-aliases',
  setup(build) {
    build.onResolve({ filter: /^(@\/|firebase\/|next\/link$)/ }, (args) => {
      if (SWAPS[args.path]) return { path: SWAPS[args.path] };
      if (args.path.startsWith('@/')) {
        const p = resolveSrc(args.path);
        if (p) return { path: p };
      }
      if (args.path.startsWith('firebase/')) {
        return { errors: [{ text: `${args.path} has no design-sync stand-in - add one to SWAPS` }] };
      }
      return undefined;
    });
  }
};

mkdirSync(out, { recursive: true });

await esbuild.build({
  entryPoints: [join(here, 'entry.js')],
  outfile: join(out, 'index.mjs'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  loader: { '.js': 'jsx', '.webp': 'dataurl', '.svg': 'dataurl' },
  // Resolved by the converter's own bundle pass (react is provided by Claude Design)
  external: ['react', 'react-dom', 'react/*', 'react-dom/*', 'lucide-react'],
  plugins: [aliases],
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET': '""',
    'process.env.NEXT_PUBLIC_KOFI_URL': '""',
    // Shows the footer's Patreon button in designs (the real URL is still to come)
    'process.env.NEXT_PUBLIC_PATREON_URL': '"https://www.patreon.com/"',
    'process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY': '""'
  },
  logLevel: 'warning'
});

const postcss = requireRepo('postcss');
const tailwind = requireRepo('@tailwindcss/postcss');
const cssFrom = join(here, 'tailwind.css');
const { css } = await postcss([tailwind({ base: root })]).process(readFileSync(cssFrom, 'utf8'), { from: cssFrom });
writeFileSync(join(out, 'allania.css'), css);

console.log(`built ${join(out, 'index.mjs')} and allania.css (${Math.round(css.length / 1024)} KB)`);
