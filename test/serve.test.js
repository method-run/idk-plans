import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { serveSite } from '../src/serve.js';

const CONFIG = JSON.stringify({ root: { file: 'README.md', id: 'demo' } });
const README = (text) => `# Demo\n\n${text}\n`;

/** Read server-sent events until one has the given name. */
async function nextEvent(res, name) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) throw new Error('event stream ended');
    buffer += decoder.decode(value, { stream: true });
    for (const message of buffer.split('\n\n').slice(0, -1)) {
      const event = message.match(/^event: (.*)$/m)?.[1];
      if (event === name) { reader.cancel(); return JSON.parse(message.match(/^data: (.*)$/m)[1]); }
    }
    buffer = buffer.slice(buffer.lastIndexOf('\n\n') + 2);
  }
}

test('serve: serves the site with live reload, and rebuilds when a file changes', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'idk-serve-'));
  await writeFile(path.join(dir, 'idk-plans.config.json'), CONFIG);
  await writeFile(path.join(dir, 'README.md'), README('First version.'));
  const server = await serveSite(dir, { port: 0 });
  try {
    let page = await (await fetch(server.url)).text();
    assert.match(page, /First version\./);
    assert.match(page, /new EventSource\("\/__idk-plans\/events"\)/);
    assert.equal((await fetch(`${server.url}assets/site.css`)).headers.get('content-type'), 'text/css; charset=utf-8');
    assert.equal((await fetch(`${server.url}nope.html`)).status, 404);
    assert.equal((await fetch(`${server.url}..%2f..%2fetc/passwd`)).status, 404);

    const events = await fetch(`${server.url}__idk-plans/events`);
    const reloaded = nextEvent(events, 'reload');
    await writeFile(path.join(dir, 'README.md'), README('Second version.'));
    await reloaded;
    page = await (await fetch(server.url)).text();
    assert.match(page, /Second version\./);

    const failed = nextEvent(await fetch(`${server.url}__idk-plans/events`), 'build-error');
    await writeFile(path.join(dir, 'idk-plans.config.json'), '{ not json');
    assert.match(await failed, /idk-plans\.config\.json/);
    // The last good site is still served.
    assert.match(await (await fetch(server.url)).text(), /Second version\./);
  } finally {
    await server.close();
    await rm(dir, { recursive: true });
  }
});
