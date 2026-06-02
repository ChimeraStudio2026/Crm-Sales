import { mkdir, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = join(rootDir, 'public', 'icons');
const logoPath = join(rootDir, 'public', 'logo.png');
const logoBuffer = readFileSync(logoPath);
const backgroundColor = '#f4f5f6';

mkdir(iconsDir, { recursive: true }, () => undefined);

const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon.png', size: 32 },
];

async function createIcon(name, size) {
  const padding = Math.round(size * 0.12);
  const innerSize = size - padding * 2;
  const resizedLogo = await sharp(logoBuffer)
    .resize(innerSize, innerSize, { fit: 'contain', background: backgroundColor })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: backgroundColor,
    },
  })
    .composite([{ input: resizedLogo, gravity: 'center' }])
    .png()
    .toFile(join(iconsDir, name));
}

await Promise.all(sizes.map(({ name, size }) => createIcon(name, size)));

console.log('PWA icons generated from public/logo.png in public/icons/');
