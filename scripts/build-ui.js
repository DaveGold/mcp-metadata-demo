#!/usr/bin/env node

/**
 * Build MCP App UIs — incrementally.
 *
 * viteSingleFile requires inlineDynamicImports=true, which Rollup only supports
 * with a single input. This script discovers all apps and builds each one
 * separately by setting VITE_APP=<key> before each vite build.
 *
 * Incremental: each app's source hash (its own files + shared UI code + global
 * config) is stored in build/ui/.manifest.json. Apps whose hash is unchanged
 * and whose output HTML still exists are skipped.
 *
 * Env flags:
 * - UI_APP=<key>   — build only the named app (clears no other outputs).
 * - UI_FORCE=1     — ignore the manifest and rebuild every (selected) app.
 *
 * Discovery mirrors vite.config.ts discoverEntries():
 * - Flat:   ui/apps/<name>/index.html          → key: <name>
 * - Nested: ui/apps/<server>/<name>/index.html  → key: <server>-<name>
 */

import { readdirSync, existsSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

const projectRoot = resolve('.');
const appsDir = resolve('ui/apps');
const sharedDir = resolve('ui/shared');
const outDir = resolve('build/ui');
const manifestPath = resolve(outDir, '.manifest.json');

const filter = process.env.UI_APP?.trim() || null;
const force = process.env.UI_FORCE === '1' || process.env.UI_FORCE === 'true';

// Files whose changes invalidate every app's cache.
const globalConfigFiles = [
  'vite.config.ts',
  'ui/tsconfig.json',
  'ui/styles.css',
  'package-lock.json',
].map((p) => resolve(projectRoot, p));

// Discover all app entries
const apps = [];
for (const d1 of readdirSync(appsDir, { withFileTypes: true })) {
  if (!d1.isDirectory()) continue;

  const flatEntry = resolve(appsDir, d1.name, 'index.html');
  if (existsSync(flatEntry)) {
    apps.push({ key: d1.name, dir: resolve(appsDir, d1.name) });
    continue;
  }

  const serverDir = resolve(appsDir, d1.name);
  for (const d2 of readdirSync(serverDir, { withFileTypes: true })) {
    if (!d2.isDirectory()) continue;
    if (existsSync(resolve(serverDir, d2.name, 'index.html'))) {
      apps.push({ key: `${d1.name}-${d2.name}`, dir: resolve(serverDir, d2.name) });
    }
  }
}

if (apps.length === 0) {
  console.log('No MCP Apps found in ui/apps/');
  process.exit(0);
}

let targetApps = apps;
if (filter) {
  targetApps = apps.filter((app) => app.key === filter);
  if (targetApps.length === 0) {
    const available = apps.map((a) => a.key).join(', ');
    console.error(`UI_APP="${filter}" not found. Available: ${available}`);
    process.exit(1);
  }
}

// --- Hashing ----------------------------------------------------------------

/** Recursively collect absolute file paths under a directory. */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.isFile()) out.push(p);
  }
  return out;
}

/** Hash a set of files: sha256 over (relativePath + NUL + content + NUL) pairs. */
function hashFiles(files) {
  const hash = createHash('sha256');
  const sorted = [...files].sort();
  for (const file of sorted) {
    if (!existsSync(file)) continue;
    const rel = relative(projectRoot, file);
    const stat = statSync(file);
    if (!stat.isFile()) continue;
    hash.update(rel);
    hash.update('\0');
    hash.update(readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

const sharedFiles = existsSync(sharedDir) ? walk(sharedDir) : [];
const globalFiles = globalConfigFiles.filter((p) => existsSync(p));
const sharedHashInput = [...sharedFiles, ...globalFiles];
const sharedHash = hashFiles(sharedHashInput);

function computeAppHash(app) {
  const appHash = hashFiles(walk(app.dir));
  return createHash('sha256').update(appHash).update('\0').update(sharedHash).digest('hex');
}

// --- Manifest ---------------------------------------------------------------

let manifest = {};
if (existsSync(manifestPath) && !force) {
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    manifest = {};
  }
}

// --- Build loop -------------------------------------------------------------

const built = [];
const skipped = [];

for (const app of targetApps) {
  const hash = computeAppHash(app);
  const outFile = resolve(outDir, `${app.key}.html`);
  const cached = manifest[app.key];

  if (!force && cached === hash && existsSync(outFile)) {
    skipped.push(app.key);
    continue;
  }

  console.log(`\n── Building: ${app.key} ──`);
  execSync('vite build', {
    stdio: 'inherit',
    env: { ...process.env, VITE_APP: app.key },
  });
  manifest[app.key] = hash;
  built.push(app.key);
}

// Persist manifest (only after successful builds). Restrict keys to apps that
// still exist so orphaned entries get pruned over time.
const liveKeys = new Set(apps.map((a) => a.key));
const prunedManifest = {};
for (const [k, v] of Object.entries(manifest)) {
  if (liveKeys.has(k)) prunedManifest[k] = v;
}
if (existsSync(outDir)) {
  writeFileSync(manifestPath, JSON.stringify(prunedManifest, null, 2));
}

if (skipped.length) {
  console.log(`\n↷ Skipped (unchanged): ${skipped.join(', ')}`);
}
if (built.length) {
  console.log(`\n✓ Built ${built.length} app(s): ${built.join(', ')}`);
} else {
  console.log('\n✓ All apps up to date.');
}
