import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const paths = [
  join(root, 'node_modules', '.vite'),
  join(root, 'node_modules', '.cache'),
  join(root, '.vite'),
  join(root, 'dist'),
];

for (const p of paths) {
  if (!existsSync(p)) continue;
  rmSync(p, { recursive: true, force: true });
  console.log('Removed', p);
}
console.log('Vite caches cleared.');
