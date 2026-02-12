import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { execFileSync } from 'node:child_process';

const PACK_URL = 'https://opengameart.org/sites/default/files/stylized_nature_megakitstandard.zip';
const ROOT = process.cwd();
const ARCHIVE_DIR = resolve(ROOT, 'third_party_assets', 'quaternius');
const ARCHIVE_PATH = resolve(ARCHIVE_DIR, basename(PACK_URL));
const TARGET_DIR = resolve(ROOT, 'public', 'models', 'environment', 'quaternius');

async function downloadPack() {
  if (existsSync(ARCHIVE_PATH)) {
    console.log(`Using cached archive: ${ARCHIVE_PATH}`);
    return;
  }

  mkdirSync(ARCHIVE_DIR, { recursive: true });
  console.log(`Downloading Quaternius pack from ${PACK_URL}`);

  const response = await fetch(PACK_URL);
  if (!response.ok || !response.body) {
    throw new Error(`Failed download: HTTP ${response.status}`);
  }

  await pipeline(response.body, createWriteStream(ARCHIVE_PATH));
  console.log(`Saved archive: ${ARCHIVE_PATH}`);
}

function unzipPack() {
  mkdirSync(TARGET_DIR, { recursive: true });
  execFileSync(
    'unzip',
    [
      '-o',
      ARCHIVE_PATH,
      'glTF/*',
      'License_Standard.txt',
      '-d',
      TARGET_DIR
    ],
    { stdio: 'inherit' }
  );
  console.log(`Extracted glTF assets to: ${TARGET_DIR}`);
}

async function main() {
  await downloadPack();
  unzipPack();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
