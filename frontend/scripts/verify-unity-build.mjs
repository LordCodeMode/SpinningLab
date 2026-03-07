#!/usr/bin/env node
/* eslint-env node */
import fs from 'node:fs/promises';
import path from 'node:path';

const cwd = process.cwd();
const runtimeManifestPath = path.resolve(cwd, 'public/unity/current.json');

const exists = async (filePath) => {
  const stat = await fs.stat(filePath).catch(() => null);
  return Boolean(stat);
};

const parseJson = async (filePath, label) => {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    throw new Error(`[unity:verify] Invalid ${label}: ${filePath}`);
  }
};

const assertFile = async (filePath, label) => {
  if (!(await exists(filePath))) {
    throw new Error(`[unity:verify] Missing ${label}: ${path.relative(cwd, filePath)}`);
  }
};

const main = async () => {
  await assertFile(runtimeManifestPath, 'runtime manifest');
  const runtimeManifest = await parseJson(runtimeManifestPath, 'runtime manifest');

  const version = String(runtimeManifest.version || '').trim();
  const buildBaseUrl = String(runtimeManifest.buildBaseUrl || '').trim();
  const loaderUrl = String(runtimeManifest.loaderUrl || '').trim();
  const frameworkUrl = String(runtimeManifest.frameworkUrl || '').trim();
  const codeUrl = String(runtimeManifest.codeUrl || '').trim();
  const dataUrl = String(runtimeManifest.dataUrl || '').trim();

  if (!version || !buildBaseUrl || !loaderUrl || !frameworkUrl || !codeUrl || !dataUrl) {
    throw new Error('[unity:verify] current.json is missing required fields');
  }

  const buildDir = path.resolve(cwd, `public${buildBaseUrl}`);
  await assertFile(buildDir, 'build directory');

  const loaderPath = path.join(buildDir, loaderUrl);
  const frameworkPath = path.join(buildDir, frameworkUrl);
  const codePath = path.join(buildDir, codeUrl);
  const dataPath = path.join(buildDir, dataUrl);

  await assertFile(loaderPath, 'loader artifact');
  await assertFile(frameworkPath, 'framework artifact');
  await assertFile(codePath, 'wasm artifact');
  await assertFile(dataPath, 'data artifact');

  const buildManifestPath = path.join(buildDir, 'build.json');
  await assertFile(buildManifestPath, 'build manifest');
  await parseJson(buildManifestPath, 'build manifest');

  const routeProfileUrl = String(runtimeManifest.routeProfileUrl || '').trim();
  let routeProfilePath = null;
  if (routeProfileUrl) {
    if (/^https?:\/\//i.test(routeProfileUrl)) {
      console.log(`  routeProfileUrl=${routeProfileUrl} (remote, local validation skipped)`);
      routeProfilePath = null;
    } else {
    routeProfilePath = routeProfileUrl.startsWith('/')
      ? path.resolve(cwd, `public${routeProfileUrl}`)
      : path.resolve(path.dirname(runtimeManifestPath), routeProfileUrl);
    await assertFile(routeProfilePath, 'route profile');
    const routeProfile = await parseJson(routeProfilePath, 'route profile');
    if (!Array.isArray(routeProfile?.routes) || routeProfile.routes.length === 0) {
      throw new Error('[unity:verify] Route profile has no routes[] entries');
    }
    }
  }

  const buildFiles = await fs.readdir(buildDir);
  const duplicates = buildFiles.filter((name) => name.includes(' 2.'));
  if (duplicates.length > 0) {
    throw new Error(`[unity:verify] Duplicate artifacts found: ${duplicates.join(', ')}`);
  }

  console.log('[unity:verify] OK');
  console.log(`  activeVersion=${version}`);
  console.log(`  runtimeManifest=${path.relative(cwd, runtimeManifestPath)}`);
  console.log(`  buildManifest=${path.relative(cwd, buildManifestPath)}`);
  if (routeProfilePath) {
    console.log(`  routeProfile=${path.relative(cwd, routeProfilePath)}`);
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
