import { mkdir, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = join(rootDir, 'public', 'icons');
const svgBuffer = readFileSync(join(iconsDir, 'icon.svg'));

mkdir(iconsDir, { recursive: true }, () => undefined);

const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

await Promise.all(
  sizes.map(({ name, size }) =>
    sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(join(iconsDir, name)),
  ),
);

console.log('PWA icons generated in public/icons/');
