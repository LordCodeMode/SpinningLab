#!/usr/bin/env node
/* eslint-env node */
import fs from 'node:fs/promises';
import path from 'node:path';

const cwd = process.cwd();

const parseArgs = (argv) => {
  const out = {
    source: 'public/unity/v1',
    version: 'v1',
    targetRoot: 'public/unity',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--source') out.source = String(argv[i + 1] || out.source);
    if (arg === '--version') out.version = String(argv[i + 1] || out.version);
    if (arg === '--target-root') out.targetRoot = String(argv[i + 1] || out.targetRoot);
  }

  return out;
};

const firstMatch = (files, patterns) => {
  for (const pattern of patterns) {
    const found = files.find((file) => pattern.test(file));
    if (found) return found;
  }
  return null;
};

const rmDuplicates = async (dirPath) => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  let removed = 0;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.includes(' 2.')) continue;
    await fs.rm(path.join(dirPath, entry.name), { force: true });
    removed += 1;
  }

  return removed;
};

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const findFirstExistingFile = async (candidates) => {
  for (const candidate of candidates) {
    const stat = await fs.stat(candidate).catch(() => null);
    if (stat && stat.isFile()) return candidate;
  }
  return null;
};

const copyDir = async (sourceDir, targetDir) => {
  await ensureDir(targetDir);
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const src = path.join(sourceDir, entry.name);
    const dst = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await copyDir(src, dst);
      continue;
    }

    if (entry.isFile()) {
      await fs.copyFile(src, dst);
    }
  }
};

const writeJson = async (filePath, payload) => {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const main = async () => {
  const { source, version, targetRoot } = parseArgs(process.argv.slice(2));

  const sourceDir = path.resolve(cwd, source);
  const targetRootDir = path.resolve(cwd, targetRoot);
  const versionDir = path.join(targetRootDir, version);
  const targetBuildDir = path.join(versionDir, 'Build');
  const targetTemplateDir = path.join(versionDir, 'TemplateData');
  const targetRouteProfilePath = path.join(versionDir, 'route-profiles.json');

  const sourceBuildDir = path.join(sourceDir, 'Build');
  const sourceTemplateDir = path.join(sourceDir, 'TemplateData');
  const sourceRouteProfilePath = await findFirstExistingFile([
    path.join(sourceDir, 'route-profiles.json'),
    path.join(sourceDir, 'routeProfiles.json'),
    path.join(sourceBuildDir, 'route-profiles.json'),
  ]);

  const sourceBuildStat = await fs.stat(sourceBuildDir).catch(() => null);
  if (!sourceBuildStat || !sourceBuildStat.isDirectory()) {
    throw new Error(`Missing Build directory at ${sourceBuildDir}`);
  }

  const sourceTemplateStat = await fs.stat(sourceTemplateDir).catch(() => null);

  await ensureDir(versionDir);

  if (path.resolve(sourceBuildDir) !== path.resolve(targetBuildDir)) {
    await fs.rm(targetBuildDir, { recursive: true, force: true });
    await copyDir(sourceBuildDir, targetBuildDir);
    console.log(`Build copied: ${sourceBuildDir} -> ${targetBuildDir}`);
  } else {
    console.log('Unity Build source already points to target build folder, skipping copy.');
  }

  if (sourceTemplateStat && sourceTemplateStat.isDirectory()) {
    if (path.resolve(sourceTemplateDir) !== path.resolve(targetTemplateDir)) {
      await fs.rm(targetTemplateDir, { recursive: true, force: true });
      await copyDir(sourceTemplateDir, targetTemplateDir);
      console.log(`TemplateData copied: ${sourceTemplateDir} -> ${targetTemplateDir}`);
    } else {
      console.log('TemplateData source already points to target folder, skipping copy.');
    }
  }

  if (sourceRouteProfilePath) {
    if (path.resolve(sourceRouteProfilePath) !== path.resolve(targetRouteProfilePath)) {
      await fs.copyFile(sourceRouteProfilePath, targetRouteProfilePath);
      console.log(`Route profile copied: ${sourceRouteProfilePath} -> ${targetRouteProfilePath}`);
    } else {
      console.log('Route profile source already points to target file, skipping copy.');
    }
  } else {
    await fs.rm(targetRouteProfilePath, { force: true });
  }

  const removedDuplicates = await rmDuplicates(targetBuildDir);
  if (removedDuplicates > 0) {
    console.log(`Removed duplicate Build artifacts: ${removedDuplicates}`);
  }

  const buildFiles = await fs.readdir(targetBuildDir);
  const loader = firstMatch(buildFiles, [/\.loader\.js(\.unityweb)?$/i]);
  const framework = firstMatch(buildFiles, [/\.framework\.js(\.unityweb)?$/i]);
  const code = firstMatch(buildFiles, [/\.wasm(\.unityweb)?$/i]);
  const data = firstMatch(buildFiles, [/\.data(\.unityweb)?$/i]);

  if (!loader || !framework || !code || !data) {
    throw new Error(`Build artifacts missing in ${targetBuildDir}`);
  }

  const artifactStats = await Promise.all(
    [loader, framework, code, data].map((artifact) => fs.stat(path.join(targetBuildDir, artifact)))
  );
  const routeProfileStat = sourceRouteProfilePath
    ? await fs.stat(targetRouteProfilePath).catch(() => null)
    : null;
  const latestArtifactMtimeMs = Math.max(
    ...artifactStats.map((stat) => stat.mtimeMs),
    routeProfileStat?.mtimeMs || 0
  );
  const cacheToken = `${version}-${Math.floor(latestArtifactMtimeMs)}`;

  const runtimeManifestPath = path.join(targetRootDir, 'current.json');
  const runtimeManifest = {
    version,
    cacheToken,
    buildBaseUrl: `/unity/${version}/Build`,
    loaderUrl: loader,
    frameworkUrl: framework,
    dataUrl: data,
    codeUrl: code,
    streamingAssetsUrl: 'StreamingAssets',
    bridgeProtocolVersion: 1,
    ...(sourceRouteProfilePath ? { routeProfileUrl: `/unity/${version}/route-profiles.json` } : {})
  };

  await writeJson(runtimeManifestPath, runtimeManifest);

  const buildManifestPath = path.join(targetBuildDir, 'build.json');
  const buildManifest = {
    companyName: 'Training Dashboard',
    productName: 'Virtual Ride',
    productVersion: version,
    dataUrl: data,
    frameworkUrl: framework,
    codeUrl: code,
    streamingAssetsUrl: 'StreamingAssets',
  };
  await writeJson(buildManifestPath, buildManifest);

  console.log(`Unity manifests updated for ${version}:`);
  console.log(`  Build manifest: ${path.relative(cwd, buildManifestPath)}`);
  console.log(`  Runtime manifest: ${path.relative(cwd, runtimeManifestPath)}`);
  console.log(`  loader=${loader}`);
  console.log(`  framework=${framework}`);
  console.log(`  code=${code}`);
  console.log(`  data=${data}`);
  if (sourceRouteProfilePath) {
    console.log('  routeProfile=route-profiles.json');
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
