import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const assets = {};
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.png': 'image/png' };
for (const name of await fs.readdir(path.join(root, 'public'))) {
  const ext = path.extname(name);
  if (!types[ext]) continue;
  const bytes = await fs.readFile(path.join(root, 'public', name));
  assets[`/${name}`] = { type: types[ext], body: bytes.toString(ext === '.png' ? 'base64' : 'utf8'), base64: ext === '.png' };
}
await fs.mkdir(path.join(root, 'dist/server'), { recursive: true });
await fs.mkdir(path.join(root, 'dist/.openai'), { recursive: true });
const source = await fs.readFile(path.join(root, 'worker.js'), 'utf8');
await fs.writeFile(path.join(root, 'dist/server/index.js'), `${source}\nexport default createWorker(${JSON.stringify(assets)});\n`);
await fs.copyFile(path.join(root, '.openai/hosting.json'), path.join(root, 'dist/.openai/hosting.json'));
console.log('Built hosted dashboard and live-state worker.');
