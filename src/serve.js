import { watch } from 'node:fs';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadProject } from './index.js';
import { buildSite } from './site.js';
import { CONFIG_FILE } from './config.js';

const EVENTS = '/__idk-plans/events';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

// Reloads the page after each build, and shows a build error at the top of the page.
const CLIENT = `<script>
(() => {
  const events = new EventSource(${JSON.stringify(EVENTS)});
  events.addEventListener('reload', () => location.reload());
  events.addEventListener('build-error', (e) => {
    let box = document.getElementById('idk-build-error');
    if (!box) {
      box = document.createElement('pre');
      box.id = 'idk-build-error';
      box.style.cssText = 'position:fixed;inset:0 0 auto;z-index:9999;margin:0;padding:1em;background:#b00020;color:#fff;white-space:pre-wrap';
      document.body.prepend(box);
    }
    box.textContent = 'idk-plans: ' + JSON.parse(e.data);
  });
})();
</script>`;

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
  const clients = new Set();
  let outDir = null;

  const send = (event, data) => {
    for (const res of clients) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Each build goes into a new folder, so the server never serves a half-built site.
  const build = async () => {
    const next = await mkdtemp(path.join(tmpdir(), 'idk-plans-serve-'));
    try {
      const pages = await buildSite(await loadProject(cwd), next, siteOptions);
      const old = outDir;
      outDir = next;
      if (old) await rm(old, { recursive: true, force: true });
      return pages;
    } catch (err) {
      await rm(next, { recursive: true, force: true });
      throw err;
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
        try {
          const pages = await build();
          log(`rebuilt ${pages.length} pages`);
          send('reload', '');
        } catch (err) {
          log(`build failed: ${err.message}`);
          send('build-error', err.message);
        }
      } while (again);
      running = null;
    })();
    return running;
  };

  await build();

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === EVENTS) {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write(': connected\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
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
      if (type.startsWith('text/html')) body = body.toString('utf8').replace(/<\/body>/i, () => `${CLIENT}\n</body>`);
      res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }).end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });

  let timer = null;
  const watcher = watch(cwd, { recursive: true }, (_, filename) => {
    if (!filename || !isWatched(filename.toString())) return;
    clearTimeout(timer);
    timer = setTimeout(rebuild, 100);
  });

  const { port: actualPort } = server.address();
  return {
    url: `http://${host.includes(':') ? `[${host}]` : host}:${actualPort}/`,
    rebuild,
    async close() {
      clearTimeout(timer);
      watcher.close();
      for (const res of clients) res.end();
      await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
      await running;
      if (outDir) await rm(outDir, { recursive: true, force: true });
    },
  };
}
