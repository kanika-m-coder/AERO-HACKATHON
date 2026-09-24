#!/usr/bin/env node
/* Bundles the ES-module source tree into a single self-contained HTML file
   in dist/. No external tooling: modules are concatenated in dependency
   order, import statements dropped and the `export` keyword stripped. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ORDER = [
  'src/core/util.js',
  'src/core/EventBus.js',
  'src/core/auth.js',
  'src/backend/limits.js',
  'src/backend/faults.js',
  'src/backend/profiles.js',
  'src/backend/EngineModel.js',
  'src/backend/SensorLayer.js',
  'src/backend/DigitalTwin.js',
  'src/backend/Diagnostics.js',
  'src/backend/MLService.js',
  'src/backend/Recorder.js',
  'src/backend/HealthMonitor.js',
  'src/backend/Reporting.js',
  'src/core/store.js',
  'src/ui/components/style.js',
  'src/ui/components/panel.js',
  'src/ui/components/tape.js',
  'src/ui/components/TimeChart.js',
  'src/ui/components/toast.js',
  'src/ui/components/log.js',
  'src/ui/components/LoginModal.js',
  'src/ui/views/registry.js',
  'src/ui/views/overview.js',
  'src/ui/views/twin.js',
  'src/ui/views/telemetry.js',
  'src/ui/views/health.js',
  'src/ui/views/faults.js',
  'src/ui/views/predictive.js',
  'src/ui/views/rul.js',
  'src/ui/views/simulation.js',
  'src/ui/views/replay.js',
  'src/ui/views/reports.js',
  'src/ui/views/architecture.js',
  'src/ui/Router.js',
  'src/ui/StatusStrip.js',
  'src/ui/Shell.js'
];
const STYLES = ['src/styles/tokens.css', 'src/styles/app.css'];

const root = path.dirname(fileURLToPath(import.meta.url));
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const strip = src => src
  .split('\n')
  .filter(l => !/^\s*import\s.*;\s*$/.test(l))
  .map(l => l.replace(/^export\s+(?=(const|let|var|function|class)\b)/, ''))
  .join('\n');

const js = ORDER.map(f => `\n/* ===== ${f} ===== */\n` + strip(read(f)).trim()).join('\n');
const css = STYLES.map(f => `/* ===== ${f} ===== */\n` + read(f).trim()).join('\n\n');

let html = read('index.html');
const logoPath = path.join(root, 'assets', 'logo.jpg');
if (fs.existsSync(logoPath)) {
  const logoB64 = fs.readFileSync(logoPath).toString('base64');
  const logoDataUri = `data:image/jpeg;base64,${logoB64}`;
  html = html.replace(/src="\.\/assets\/logo\.jpg"/g, `src="${logoDataUri}"`);
  html = html.replace(/href="\.\/assets\/logo\.jpg"/g, `href="${logoDataUri}"`);
}
html = html.replace(/\n<link rel="stylesheet" href="\.\/src\/styles\/[^"]+">/g, '');
html = html.replace('</head>', `<style>\n${css}\n</style>\n</head>`);
html = html.replace(
  '<script type="module" src="./src/main.js"></script>',
  `<script>\n${js}\n\ndocument.addEventListener('DOMContentLoaded', boot);\n</script>`
);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'uav-engine-digital-twin.html');
fs.writeFileSync(out, html);
console.log(`built ${path.relative(root, out)}  (${(html.length / 1024).toFixed(1)} kB, ${ORDER.length} modules)`);
