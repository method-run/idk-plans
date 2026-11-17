import { watch } from 'node:fs';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProject, checkBuild } from './index.js';
import { buildSite, ASSETS } from './site.js';
import { CONFIG_FILE } from './config.js';
import { LABELS, problemText, countText } from './problems.js';

const EVENTS = '/__idk-plans/events';
// idk-plans' own code. A running process can not load new code, so a change to it needs a
// restart: `node --watch` does that, and tells the process so with this variable.
const OWN_CODE = path.dirname(fileURLToPath(import.meta.url));
const RESTARTS_ITSELF = process.env.WATCH_REPORT_DEPENDENCIES === '1';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

// Reloads the page after each build. Shows errors at the top of the page, and
// warnings in a closed box at the bottom, in the same words as `check`.
const client = (problems) => `<script>
(() => {
  const show = (problems) => {
    document.getElementById('idk-problems')?.remove();
    if (!problems.length) return;
    const errors = problems.some((p) => p.severity === 'error');
    const box = document.createElement(errors ? 'div' : 'details');
    box.id = 'idk-problems';
    box.style.cssText = 'position:fixed;z-index:9999;margin:0;padding:.75em 1em;font:13px/1.4 ui-monospace,monospace;white-space:pre-wrap;overflow:auto;max-height:50vh;'
      + (errors ? 'inset:0 0 auto;background:#b00020;color:#fff' : 'right:1em;bottom:1em;max-width:min(60em,calc(100vw - 2em));background:#fff4cc;color:#4d3b00;border:1px solid #d9b500;border-radius:6px');
    const head = document.createElement(errors ? 'strong' : 'summary');
    head.textContent = errors ? 'idk-plans: the site was not built. Fix these errors:' : 'idk-plans: ' + problems[0].count;
    head.style.cursor = 'pointer';
    box.append(head, '\\n' + problems.map((p) => p.text).join('\\n'));
    document.body.append(box);
  };
  show(${JSON.stringify(problems).replace(/</g, '\\u003c')});
  const events = new EventSource(${JSON.stringify(EVENTS)});
  events.addEventListener('reload', () => location.reload());
  let server = null;
  events.addEventListener('hello', (e) => {
    if (server && server !== e.data) location.reload();
    server = e.data;
  });
  events.addEventListener('problems', (e) => show(JSON.parse(e.data)));
})();
</script>`;

/** Problems for the page: one line of text each, as `check` prints them. */
function forPage(problems) {
  const count = countText(problems);
  return problems.map((p) => ({ severity: p.severity, text: `${LABELS[p.severity]}  ${problemText(p)}`, count }));
}

// Before the first good build, every page is this one.
const WAITING = '<!doctype html>\n<meta charset="utf-8">\n<title>idk-plans</title>\n<body>\n</body>\n';

/** True for a changed file that can change the site: a Markdown file or the configuration. */
function isWatched(file) {
  const parts = file.split(/[\\/]/);
  if (parts.some((p) => p === 'node_modules' || p === '.git')) return false;
  return file.endsWith('.md') || file === CONFIG_FILE;
}

/**
 * Build the site, serve it, and rebuild it when a Markdown file or the configuration changes.
 * Open pages reload after each build. The site is built in a temporary folder; the project is not changed.
 * Returns { url, close }.
 */
export async function serveSite(cwd, options = {}) {
  const { port = 4747, host = '127.0.0.1', siteOptions = {}, log = () => {} } = options;
  // The folders of idk-plans itself, which tests can replace.
  const own = { assets: ASSETS, code: OWN_CODE, restartsItself: RESTARTS_ITSELF, ...options.own };
  // Each server process has its own id. A page that reconnects to a new process (after a
  // restart) reloads, so it gets the new process's pages.
  const serverId = `${process.pid}-${Date.now()}`;
  // Set when idk-plans' own code changed and this process can not use it.
  let stale = null;
  const clients = new Set();
  let outDir = null;
  // Errors and warnings of the last build, shown on every page.
  let shown = [];

  // A change starts a build 100 ms later, so a save that writes several files builds once.
  let timer = null;
  const changed = () => {
    clearTimeout(timer);
    timer = setTimeout(rebuild, 100);
  };

  // The theme file (site.theme, or --theme) can be outside the project, so it has its own
  // watcher, on its folder: editors often save a file by replacing it.
  let theme = { file: null, watcher: null };
  const watchTheme = (file) => {
    if (file === theme.file) return;
    theme.watcher?.close();
    theme = { file, watcher: null };
    if (!file) return;
    try {
      theme.watcher = watch(path.dirname(file), (_, name) => {
        if (name && path.join(path.dirname(file), name.toString()) === file) changed();
      });
    } catch { /* a missing folder: the build reports the missing file */ }
  };

  const send = (event, data) => {
    for (const res of clients) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Each build goes into a new folder, so the server never serves a half-built site.
  // When there is an error, the last good site stays up, with the errors on top.
  // A configuration that is not valid stops every command, so it shows as an error too.
  const build = async () => {
    let next = null;
    try {
      const project = await loadProject(cwd);
      const themeFile = siteOptions.theme ?? project.config.site.theme;
      watchTheme(themeFile ? path.resolve(cwd, themeFile) : null);
      const { errors, warnings } = checkBuild(project);
      if (errors.length) return { errors, warnings };
      next = await mkdtemp(path.join(tmpdir(), 'idk-plans-serve-'));
      const pages = await buildSite(project, next, siteOptions);
      const old = outDir;
      outDir = next;
      if (old) await rm(old, { recursive: true, force: true });
      return { pages, errors, warnings };
    } catch (err) {
      if (next && next !== outDir) await rm(next, { recursive: true, force: true });
      return { errors: [{ rule: 'idk-plans', severity: 'error', file: null, line: null, message: err.message }], warnings: [] };
    }
  };

  const staleNote = () => ({
    severity: 'warn',
    text: `warning  idk-plans changed (${stale}); restart serve to use the new code, or run it with node --watch`,
    count: 'idk-plans changed: restart serve',
  });
  const report = ({ pages, errors, warnings }) => {
    shown = [...(stale ? [staleNote()] : []), ...forPage([...errors, ...warnings])];
    if (errors.length) {
      log(`not built: ${countText(errors)}`);
      for (const p of errors) log(`  ${LABELS.error}  ${problemText(p)}`);
    } else {
      log(`built ${pages.length} pages${warnings.length ? `; ${countText(warnings)}` : ''}`);
    }
  };

  // One build at a time. A change during a build starts one more build after it.
  let running = null;
  let again = false;
  const rebuild = async () => {
    if (running) { again = true; return running; }
    running = (async () => {
      do {
        again = false;
        const result = await build();
        report(result);
        // A good build reloads the page. Errors show on the page that is open.
        if (result.errors.length) send('problems', shown);
        else send('reload', '');
      } while (again);
      running = null;
    })();
    return running;
  };

  report(await build());

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === EVENTS) {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write(`event: hello\ndata: ${serverId}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (!outDir) {
      const page = url.pathname.endsWith('/') || url.pathname.endsWith('.html');
      res.writeHead(page ? 200 : 404, { 'content-type': page ? TYPES['.html'] : 'text/plain', 'cache-control': 'no-store' })
        .end(page ? WAITING.replace('</body>', () => `${client(shown)}\n</body>`) : 'Not found');
      return;
    }
    let rel;
    try { rel = decodeURIComponent(url.pathname); } catch { rel = url.pathname; }
    let file = path.join(outDir, path.normalize(rel));
    if (file !== outDir && !file.startsWith(outDir + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      if ((await stat(file)).isDirectory()) {
        if (!url.pathname.endsWith('/')) {
          res.writeHead(301, { location: `${url.pathname}/${url.search}` }).end();
          return;
        }
        file = path.join(file, 'index.html');
      }
      let body = await readFile(file);
      const type = TYPES[path.extname(file)] ?? 'application/octet-stream';
      if (type.startsWith('text/html')) body = body.toString('utf8').replace(/<\/body>/i, () => `${client(shown)}\n</body>`);
      res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }).end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });

  const watcher = watch(cwd, { recursive: true }, (_, filename) => {
    if (filename && isWatched(filename.toString())) changed();
  });
  // The site's stylesheet and script are copied at each build, so a change to them only needs
  // a build. A change to idk-plans' code needs a restart: say so, unless node --watch does it.
  const assetWatcher = watch(own.assets, { recursive: true }, changed);
  const codeWatcher = own.restartsItself ? null : watch(own.code, { recursive: true }, (_, filename) => {
    if (!filename || !filename.toString().endsWith('.js')) return;
    stale = path.relative(path.dirname(own.code), path.join(own.code, filename.toString()));
    log(`idk-plans changed (${stale}); restart serve to use the new code, or run it with node --watch`);
    shown = [staleNote(), ...shown.filter((p) => !p.text.includes('idk-plans changed'))];
    send('problems', shown);
  });

  const { port: actualPort } = server.address();
  return {
    url: `http://${host.includes(':') ? `[${host}]` : host}:${actualPort}/`,
    rebuild,
    async close() {
      clearTimeout(timer);
      watcher.close();
      theme.watcher?.close();
      assetWatcher.close();
      codeWatcher?.close();
      for (const res of clients) res.end();
      await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
      await running;
      if (outDir) await rm(outDir, { recursive: true, force: true });
    },
  };
}
