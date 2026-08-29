// This monorepo mixes React majors on purpose: apps/mobile needs React 19
// (Expo SDK 54 / RN 0.81), apps/web is pinned to React 18.2.0 (matching
// styled-jsx's peer range, which explicitly excludes 19.x). npm hoists
// React 19 to the repo root since nothing forces it not to, and it hoists
// styled-jsx (a *peer-only* dependency on react, which `overrides` can't
// force to nest — verified empirically, not just by reputation) to the root
// too. Left alone, styled-jsx's `require('react')` finds the hoisted
// React 19 instead of apps/web's React 18.2.0, and two different React
// instances in one render tree breaks context — `Cannot read properties of
// null (reading 'useContext')` inside styled-jsx's StyleRegistry, which
// fails static export of /404 and /500 during `next build`.
//
// Two things that look like fixes but AREN'T, both verified by actually
// hitting the failure they cause — don't reintroduce either:
//   1. A Next.js webpack alias on the bare 'react' specifier. This also
//      redirects Next's own internal server-side React usage (which needs
//      a newer React than 18.2.0 exports, for its request-memoization
//      `cache()` primitive) away from the copy it actually needs, trading
//      this crash for a different one (`n.cache is not a function`
//      collecting page data for dynamic API routes).
//   2. Physically *copying* apps/web's react/ into styled-jsx's own
//      node_modules. Same version number ≠ same module instance — React's
//      Context relies on singleton identity via a stable resolved file
//      path, and two files with identical content at two different real
//      paths are still two separate require()-cache entries, so this
//      fails with the exact same useContext-is-null error, just now
//      pointing at the copy instead of the root-hoisted original.
//
// The actual fix: a real symlink (Windows: a directory junction, which —
// unlike a plain symlink — doesn't need elevated privileges), so both
// paths resolve to the literal same file on disk. Node's require cache
// keys by resolved real path, so this makes it a true singleton. Runs via
// the root "postinstall" script, so it's automatic and reproducible after
// every `npm install` (including on Vercel).

const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const source = path.join(repoRoot, 'apps/web/node_modules/react');
const target = path.join(repoRoot, 'node_modules/styled-jsx/node_modules/react');

if (!fs.existsSync(source)) {
  // apps/web's own node_modules isn't installed (partial/CI-cache install
  // of a single workspace, etc.) — nothing to link yet, nothing to fix.
  process.exit(0);
}

// Already a symlink/junction pointing at the right place? Nothing to do —
// avoids needless filesystem churn (and a spurious log line) on every
// install once this has already been set up once.
try {
  const existing = fs.lstatSync(target);
  if (existing.isSymbolicLink() && fs.realpathSync(target) === fs.realpathSync(source)) {
    process.exit(0);
  }
} catch {
  // target doesn't exist yet — fall through to create it.
}

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.symlinkSync(source, target, process.platform === 'win32' ? 'junction' : 'dir');
console.log(`[fix-styled-jsx-react] linked styled-jsx's react to apps/web's own copy (${source} -> ${target}).`);
