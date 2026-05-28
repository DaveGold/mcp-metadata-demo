import { defineConfig, type Plugin } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readdirSync, renameSync, rmSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

/**
 * Auto-discover MCP App entries: ui/apps/ (recursive)
 *
 * Supports two layouts:
 * - Flat:   ui/apps/<name>/index.html          → entry key: <name>
 * - Nested: ui/apps/<server>/<name>/index.html  → entry key: <server>-<name>
 *
 * Each discovered index.html becomes a Vite entry point producing a
 * self-contained HTML file in build/ui/<key>.html.
 *
 * @see ui/ARCHITECTURE.md for naming conventions
 */
function discoverEntries(): Record<string, string> {
  const appsDir = resolve(__dirname, 'ui/apps');
  const entries: Record<string, string> = {};

  for (const d1 of readdirSync(appsDir, { withFileTypes: true })) {
    if (!d1.isDirectory()) continue;

    // Flat layout: ui/apps/<name>/index.html
    const flatEntry = resolve(appsDir, d1.name, 'index.html');
    if (existsSync(flatEntry)) {
      entries[d1.name] = flatEntry;
      continue; // Don't scan subdirs if this level has an index.html
    }

    // Nested layout: ui/apps/<server>/<name>/index.html
    const serverDir = resolve(appsDir, d1.name);
    for (const d2 of readdirSync(serverDir, { withFileTypes: true })) {
      if (!d2.isDirectory()) continue;
      const nestedEntry = resolve(serverDir, d2.name, 'index.html');
      if (existsSync(nestedEntry)) {
        entries[`${d1.name}-${d2.name}`] = nestedEntry;
      }
    }
  }

  return entries;
}

/**
 * Inject a branded boot splash into every app's index.html.
 *
 * The splash sits inside the root custom element (e.g. `<app-table>...</app-table>`);
 * Angular wipes it when the root component's view renders. This covers the window
 * between HTML load and Angular bootstrap, so apps never show a blank white box.
 *
 * Kept inline (no Tailwind dependency) so it paints before any stylesheet parses.
 */
function injectBootSplash(): Plugin {
  const splashStyle = `<style>
    .mcp-boot-splash{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;min-height:220px;padding:40px 16px;background:#0f172a;color:#94a3b8;font-family:system-ui,-apple-system,sans-serif;animation:mcp-boot-fade 400ms ease-out}
    .mcp-boot-splash__logo{width:44px;height:44px;border-radius:8px;background:rgba(148,163,184,.15);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;letter-spacing:-.5px;animation:mcp-boot-pulse 1.6s ease-in-out infinite}
    .mcp-boot-splash__name{font-weight:700;font-size:12px;line-height:1;letter-spacing:6px;opacity:.85}
    @keyframes mcp-boot-pulse{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.04)}}
    @keyframes mcp-boot-fade{from{opacity:0}to{opacity:1}}
  </style>`;
  const splashMarkup = `<div class="mcp-boot-splash" aria-hidden="true"><div class="mcp-boot-splash__logo">mcp</div><div class="mcp-boot-splash__name">METADATA DEMO</div></div>`;
  return {
    name: 'inject-boot-splash',
    transformIndexHtml(html) {
      return html
        .replace('</head>', `${splashStyle}</head>`)
        .replace(/<app-([a-z-]+)><\/app-\1>/, (_m, name) => `<app-${name}>${splashMarkup}</app-${name}>`);
    },
  };
}

/**
 * Post-build plugin: flatten Vite output to build/ui/<key>.html
 *
 * Vite preserves the input directory structure in output. This plugin
 * recursively finds all index.html files under the nested output dirs
 * and moves them to the outDir root using the entry key as filename.
 *
 * Flat:   build/ui/ui/apps/<name>/index.html          → build/ui/<name>.html
 * Nested: build/ui/ui/apps/<server>/<name>/index.html  → build/ui/<server>-<name>.html
 */
function flattenOutput(): Plugin {
  return {
    name: 'flatten-output',
    closeBundle() {
      const outDir = resolve(__dirname, 'build/ui');
      const nestedDir = join(outDir, 'ui', 'apps');
      if (!existsSync(nestedDir)) return;

      // Walk up to 2 levels: <name>/index.html or <server>/<name>/index.html
      for (const d1 of readdirSync(nestedDir, { withFileTypes: true })) {
        if (!d1.isDirectory()) continue;

        // Flat: <name>/index.html
        const flatSrc = join(nestedDir, d1.name, 'index.html');
        if (existsSync(flatSrc)) {
          renameSync(flatSrc, join(outDir, `${d1.name}.html`));
          continue;
        }

        // Nested: <server>/<name>/index.html
        const serverDir = join(nestedDir, d1.name);
        for (const d2 of readdirSync(serverDir, { withFileTypes: true })) {
          if (!d2.isDirectory()) continue;
          const nestedSrc = join(serverDir, d2.name, 'index.html');
          if (existsSync(nestedSrc)) {
            renameSync(nestedSrc, join(outDir, `${d1.name}-${d2.name}.html`));
          }
        }
      }

      // Clean up empty nested dirs
      rmSync(join(outDir, 'ui'), { recursive: true, force: true });
    },
  };
}

/**
 * Build configuration for MCP App UIs.
 *
 * viteSingleFile requires inlineDynamicImports=true, which Rollup only supports
 * with a single input. When multiple apps exist, we build them sequentially:
 * the build:ui script calls `vite build -- --app=<key>` for each discovered entry.
 *
 * If no --app flag is provided (or set via VITE_APP env var), falls back to the
 * first discovered entry for backwards compatibility.
 */
const allEntries = discoverEntries();
const targetApp = process.env.VITE_APP ?? Object.keys(allEntries)[0];
const targetEntry = allEntries[targetApp];

if (!targetEntry) {
  throw new Error(`Unknown app "${targetApp}". Available: ${Object.keys(allEntries).join(', ')}`);
}

export default defineConfig({
  root: '.',
  plugins: [
    tailwindcss(),
    angular({ tsconfig: 'ui/tsconfig.json' }),
    injectBootSplash(),
    viteSingleFile(),
    flattenOutput(),
  ],
  resolve: {
    mainFields: ['module'],
  },
  define: {
    // Angular dev-mode globals — must be defined for production builds
    // loaded in sandboxed iframes (srcdoc), where the global scope is clean.
    'ngDevMode': 'false',
    'ngI18nClosureMode': 'false',
    'ngJitMode': 'false',
  },
  build: {
    outDir: 'build/ui',
    emptyOutDir: false, // Don't wipe between per-app builds
    target: 'es2022',
    rollupOptions: {
      input: { [targetApp]: targetEntry },
    },
  },
});

/** Export discovered entries for use by the build:ui script */
export { allEntries };
