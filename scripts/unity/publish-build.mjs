#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const args = process.argv.slice(2);
const targetIndex = args.indexOf('--target');
const target = targetIndex >= 0 ? String(args[targetIndex + 1] || '').trim() : 'local';

const unityProjectPath = process.env.UNITY_PROJECT_PATH || path.join(process.env.HOME || '', 'Developer/Unity/training-world');
const unityBuildRoot = process.env.UNITY_BUILD_ROOT || path.join(process.env.HOME || '', 'Developer/UnityBuilds/training-dashboard');
const localManifestPath = process.env.UNITY_LOCAL_MANIFEST_PATH || path.join(repoRoot, 'frontend/public/unity/current.json');
const localBaseUrl = process.env.UNITY_DEV_BASE_URL || '/unity-builds/training-dashboard';

const runPreflight = () => {
  execFileSync('bash', [path.join(repoRoot, 'scripts/unity/preflight-path-check.sh')], {
    stdio: 'inherit',
    env: {
      ...process.env,
      UNITY_PROJECT_PATH: unityProjectPath,
      UNITY_BUILD_ROOT: unityBuildRoot,
    },
  });
};

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const listDirs = async (dirPath) => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
};

const latestBuildVersion = async () => {
  const versions = await listDirs(unityBuildRoot);
  if (!versions.length) {
    throw new Error(`No build versions found under ${unityBuildRoot}`);
  }

  versions.sort((a, b) => b.localeCompare(a));
  return versions[0];
};

const firstMatch = (files, regexes) => {
  for (const regex of regexes) {
    const found = files.find((file) => regex.test(file));
    if (found) return found;
  }
  return null;
};

const readBuildManifest = async (version) => {
  const versionDir = path.join(unityBuildRoot, version);
  const buildDir = path.join(versionDir, 'Build');
  const stat = await fs.stat(buildDir).catch(() => null);

  if (!stat || !stat.isDirectory()) {
    throw new Error(`Missing Build directory: ${buildDir}`);
  }

  const files = await fs.readdir(buildDir);

  const loaderUrl = firstMatch(files, [/\.loader\.js(\.unityweb)?$/i]);
  const frameworkUrl = firstMatch(files, [/\.framework\.js(\.unityweb)?$/i]);
  const dataUrl = firstMatch(files, [/\.data(\.unityweb)?$/i]);
  const codeUrl = firstMatch(files, [/\.wasm(\.unityweb)?$/i]);

  if (!loaderUrl || !frameworkUrl || !dataUrl || !codeUrl) {
    throw new Error(`Build directory is missing required files in ${buildDir}`);
  }

  return {
    versionDir,
    buildDir,
    files,
    loaderUrl,
    frameworkUrl,
    dataUrl,
    codeUrl,
  };
};

const buildManifest = ({ version, buildBaseUrl, artifacts }) => ({
  version,
  buildBaseUrl,
  loaderUrl: artifacts.loaderUrl,
  frameworkUrl: artifacts.frameworkUrl,
  dataUrl: artifacts.dataUrl,
  codeUrl: artifacts.codeUrl,
  streamingAssetsUrl: 'StreamingAssets',
  bridgeProtocolVersion: 1,
});

const writeJson = async (filePath, payload) => {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const publishLocal = async (version, artifacts) => {
  const buildBaseUrl = `${localBaseUrl.replace(/\/+$/, '')}/${encodeURIComponent(version)}/Build`;
  const manifest = buildManifest({ version, buildBaseUrl, artifacts });
  await writeJson(localManifestPath, manifest);
  console.log(`[OK] Local manifest updated: ${localManifestPath}`);
  console.log(`     Build base URL: ${buildBaseUrl}`);
};

const publishS3 = async (version, artifacts) => {
  const bucket = process.env.UNITY_S3_BUCKET;
  const prefix = (process.env.UNITY_S3_PREFIX || 'training-dashboard-unity').replace(/^\/+|\/+$/g, '');
  const cdnBase = process.env.UNITY_CDN_BASE_URL;

  if (!bucket || !cdnBase) {
    throw new Error('UNITY_S3_BUCKET and UNITY_CDN_BASE_URL are required for --target s3');
  }

  const remoteVersionPath = `s3://${bucket}/${prefix}/${version}`;
  const remoteManifestPath = `s3://${bucket}/${prefix}/current.json`;
  const cacheControlAssets = 'public, max-age=31536000, immutable';
  const cacheControlManifest = 'no-store, max-age=0';

  execFileSync('aws', [
    's3',
    'sync',
    artifacts.versionDir,
    remoteVersionPath,
    '--delete',
    '--cache-control',
    cacheControlAssets,
  ], { stdio: 'inherit' });

  const buildBaseUrl = `${cdnBase.replace(/\/+$/, '')}/${prefix}/${encodeURIComponent(version)}/Build`;
  const manifest = buildManifest({ version, buildBaseUrl, artifacts });

  const tempManifestPath = path.join(repoRoot, '.tmp-unity-current.json');
  await writeJson(tempManifestPath, manifest);

  execFileSync('aws', [
    's3',
    'cp',
    tempManifestPath,
    remoteManifestPath,
    '--cache-control',
    cacheControlManifest,
    '--content-type',
    'application/json',
  ], { stdio: 'inherit' });

  await fs.rm(tempManifestPath, { force: true });

  if (process.env.UNITY_LOCAL_MANIFEST_MIRROR === '1') {
    await writeJson(localManifestPath, manifest);
    console.log(`[OK] Local manifest mirror updated: ${localManifestPath}`);
  }

  console.log('[OK] S3 publish completed');
  console.log(`     Manifest URL: ${cdnBase.replace(/\/+$/, '')}/${prefix}/current.json`);
};

const main = async () => {
  if (!['local', 's3'].includes(target)) {
    throw new Error(`Unsupported target: ${target}. Use --target local|s3`);
  }

  runPreflight();

  const version = process.env.UNITY_BUILD_VERSION || await latestBuildVersion();
  const artifacts = await readBuildManifest(version);

  if (target === 'local') {
    await publishLocal(version, artifacts);
  } else {
    await publishS3(version, artifacts);
  }
};

main().catch((error) => {
  console.error(`[ERROR] ${error.message}`);
  process.exit(1);
});
