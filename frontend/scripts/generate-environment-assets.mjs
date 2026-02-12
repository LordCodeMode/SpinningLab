import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

class NodeFileReader {
  constructor() {
    this.result = null;
    this.onloadend = null;
    this.onerror = null;
  }

  async readAsArrayBuffer(blob) {
    try {
      this.result = await blob.arrayBuffer();
      this.onloadend?.();
    } catch (error) {
      this.onerror?.(error);
    }
  }
}

globalThis.FileReader = NodeFileReader;

const OUT_DIR = resolve(process.cwd(), 'public/models/environment');
mkdirSync(OUT_DIR, { recursive: true });

function exportBinaryGLB(root, fileName) {
  root.updateMatrixWorld(true);
  const exporter = new GLTFExporter();

  return new Promise((resolvePromise, rejectPromise) => {
    exporter.parse(
      root,
      (result) => {
        if (!(result instanceof ArrayBuffer)) {
          rejectPromise(new Error(`Expected binary GLB for ${fileName}`));
          return;
        }
        const outputPath = resolve(OUT_DIR, fileName);
        writeFileSync(outputPath, Buffer.from(result));
        resolvePromise(outputPath);
      },
      (error) => rejectPromise(error),
      {
        binary: true,
        onlyVisible: true,
        trs: false
      }
    );
  });
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function hashString(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seedString) {
  let t = hashString(seedString);
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function randRange(rng, min, max) {
  return min + (max - min) * rng();
}

function addCylinderSegment(group, start, end, radiusStart, radiusEnd, radialSegments, material) {
  const axis = end.clone().sub(start);
  const length = axis.length();
  if (length <= 1e-4) return;

  const geometry = new THREE.CylinderGeometry(radiusEnd, radiusStart, length, radialSegments, 1, false);
  const mesh = new THREE.Mesh(geometry, material);
  const mid = start.clone().add(end).multiplyScalar(0.5);
  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
  group.add(mesh);
}

function createLeafCluster(group, center, radius, count, detail, materials, rng, stretchY = 0.78) {
  const lodDetail = detail === 'high' ? 2 : detail === 'mid' ? 1 : 0;
  for (let i = 0; i < count; i += 1) {
    const shell = Math.pow(rng(), 0.65);
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(1 - 2 * rng());
    const localR = radius * shell;
    const px = Math.sin(phi) * Math.cos(theta) * localR;
    const py = Math.cos(phi) * localR * stretchY;
    const pz = Math.sin(phi) * Math.sin(theta) * localR;

    const geo = new THREE.IcosahedronGeometry(randRange(rng, radius * 0.22, radius * 0.42), lodDetail);
    const mat = materials[Math.floor(rng() * materials.length)];
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(center.x + px, center.y + py, center.z + pz);
    mesh.scale.set(1 + randRange(rng, -0.16, 0.2), 1 + randRange(rng, -0.24, 0.14), 1 + randRange(rng, -0.16, 0.2));
    group.add(mesh);
  }
}

function createConiferTreeModel(tier = 'high') {
  const group = new THREE.Group();
  const rng = createSeededRandom(`tree:conifer:${tier}`);
  const detail = tier === 'high' ? 12 : tier === 'mid' ? 9 : 7;
  const trunkHeight = tier === 'high' ? 8.6 : tier === 'mid' ? 7.3 : 6.0;
  const trunkBase = tier === 'high' ? 0.42 : tier === 'mid' ? 0.36 : 0.3;
  const trunkTop = tier === 'high' ? 0.16 : tier === 'mid' ? 0.14 : 0.12;

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4f3827, roughness: 0.92, metalness: 0.02 });
  const branchMat = new THREE.MeshStandardMaterial({ color: 0x433022, roughness: 0.94, metalness: 0 });
  const foliageMats = [
    new THREE.MeshStandardMaterial({ color: 0x2a4a2d, roughness: 0.9, metalness: 0 }),
    new THREE.MeshStandardMaterial({ color: 0x355238, roughness: 0.91, metalness: 0 }),
    new THREE.MeshStandardMaterial({ color: 0x3d6042, roughness: 0.88, metalness: 0 })
  ];

  const trunkTopPoint = new THREE.Vector3(randRange(rng, -0.12, 0.1), trunkHeight, randRange(rng, -0.1, 0.1));
  addCylinderSegment(group, new THREE.Vector3(0, 0, 0), trunkTopPoint, trunkBase, trunkTop, detail, trunkMat);

  const whorls = tier === 'high' ? 7 : tier === 'mid' ? 5 : 4;
  for (let i = 0; i < whorls; i += 1) {
    const t = i / Math.max(1, whorls - 1);
    const y = 1.0 + t * (trunkHeight - 2.0);
    const branchReach = (1 - t) * (tier === 'low' ? 1.45 : 1.95) + 0.48;
    const branches = tier === 'high' ? 6 : 5;

    for (let b = 0; b < branches; b += 1) {
      const angle = (b / branches) * Math.PI * 2 + t * 0.85 + randRange(rng, -0.12, 0.12);
      const elevation = randRange(rng, 0.1, 0.22) - t * 0.05;
      const start = new THREE.Vector3(
        Math.cos(angle) * (0.12 + t * 0.07),
        y,
        Math.sin(angle) * (0.12 + t * 0.07)
      );
      const end = new THREE.Vector3(
        Math.cos(angle) * (branchReach + randRange(rng, -0.18, 0.16)),
        y + elevation,
        Math.sin(angle) * (branchReach + randRange(rng, -0.18, 0.16))
      );
      const r0 = (1 - t) * 0.08 + 0.03;
      const r1 = r0 * randRange(rng, 0.45, 0.62);
      addCylinderSegment(group, start, end, r0, r1, Math.max(5, detail - 2), branchMat);

      if (tier !== 'low' || i < whorls - 1) {
        const coneRadius = branchReach * randRange(rng, 0.46, 0.62);
        const coneHeight = coneRadius * randRange(rng, 1.5, 2.0);
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(coneRadius, coneHeight, Math.max(7, detail)),
          foliageMats[Math.floor(rng() * foliageMats.length)]
        );
        cone.position.set(end.x * 0.82, end.y + coneHeight * 0.45, end.z * 0.82);
        cone.rotation.y = angle + randRange(rng, -0.28, 0.28);
        group.add(cone);
      }
    }
  }

  const tipCone = new THREE.Mesh(
    new THREE.ConeGeometry(tier === 'high' ? 0.72 : 0.58, tier === 'high' ? 2.2 : 1.8, Math.max(7, detail)),
    foliageMats[0]
  );
  tipCone.position.set(trunkTopPoint.x * 0.2, trunkHeight + (tier === 'high' ? 0.95 : 0.75), trunkTopPoint.z * 0.2);
  group.add(tipCone);

  return group;
}

function createOakTreeModel(tier = 'high') {
  const group = new THREE.Group();
  const rng = createSeededRandom(`tree:oak:${tier}`);
  const detail = tier === 'high' ? 12 : tier === 'mid' ? 9 : 7;
  const trunkHeight = tier === 'high' ? 6.0 : tier === 'mid' ? 5.3 : 4.6;

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3f2c, roughness: 0.93, metalness: 0.01 });
  const branchMat = new THREE.MeshStandardMaterial({ color: 0x4b3526, roughness: 0.94, metalness: 0 });
  const foliageMats = [
    new THREE.MeshStandardMaterial({ color: 0x4a6d3f, roughness: 0.88, metalness: 0 }),
    new THREE.MeshStandardMaterial({ color: 0x587a4a, roughness: 0.86, metalness: 0 }),
    new THREE.MeshStandardMaterial({ color: 0x43643a, roughness: 0.9, metalness: 0 })
  ];

  const trunkKnee = new THREE.Vector3(randRange(rng, -0.2, 0.2), trunkHeight * 0.55, randRange(rng, -0.18, 0.18));
  const trunkTop = new THREE.Vector3(randRange(rng, -0.34, 0.34), trunkHeight, randRange(rng, -0.3, 0.3));
  addCylinderSegment(group, new THREE.Vector3(0, 0, 0), trunkKnee, 0.54, 0.38, detail, trunkMat);
  addCylinderSegment(group, trunkKnee, trunkTop, 0.38, 0.22, detail, trunkMat);

  const branchCount = tier === 'high' ? 9 : tier === 'mid' ? 7 : 5;
  for (let i = 0; i < branchCount; i += 1) {
    const t = i / Math.max(1, branchCount - 1);
    const angle = randRange(rng, 0, Math.PI * 2);
    const rise = randRange(rng, 0.12, 0.34);
    const reach = randRange(rng, 2.0, 3.35) * (tier === 'low' ? 0.75 : 1);
    const startY = trunkHeight * randRange(rng, 0.52, 0.88);

    const start = new THREE.Vector3(
      trunkTop.x * 0.45 + Math.cos(angle) * randRange(rng, 0.1, 0.22),
      startY,
      trunkTop.z * 0.45 + Math.sin(angle) * randRange(rng, 0.1, 0.22)
    );

    const bend = new THREE.Vector3(
      start.x + Math.cos(angle) * reach * 0.62,
      start.y + rise + randRange(rng, -0.14, 0.16),
      start.z + Math.sin(angle) * reach * 0.62
    );
    const end = new THREE.Vector3(
      start.x + Math.cos(angle) * reach,
      start.y + rise + randRange(rng, -0.2, 0.24),
      start.z + Math.sin(angle) * reach
    );

    const r0 = 0.12 + (1 - t) * 0.07;
    const r1 = r0 * randRange(rng, 0.5, 0.62);
    const r2 = r1 * randRange(rng, 0.58, 0.72);

    addCylinderSegment(group, start, bend, r0, r1, Math.max(6, detail - 2), branchMat);
    addCylinderSegment(group, bend, end, r1, r2, Math.max(6, detail - 2), branchMat);

    if (tier === 'high' || rng() > 0.25) {
      createLeafCluster(
        group,
        end,
        randRange(rng, 1.25, 1.9),
        tier === 'high' ? 8 : 5,
        tier,
        foliageMats,
        rng,
        randRange(rng, 0.7, 0.95)
      );
    }
  }

  createLeafCluster(
    group,
    new THREE.Vector3(trunkTop.x * 0.3, trunkHeight + 0.9, trunkTop.z * 0.3),
    tier === 'high' ? 2.8 : tier === 'mid' ? 2.4 : 1.9,
    tier === 'high' ? 22 : tier === 'mid' ? 16 : 11,
    tier,
    foliageMats,
    rng,
    0.82
  );

  return group;
}

function createCypressTreeModel(tier = 'high') {
  const group = new THREE.Group();
  const rng = createSeededRandom(`tree:cypress:${tier}`);
  const detail = tier === 'high' ? 11 : tier === 'mid' ? 8 : 6;
  const height = tier === 'high' ? 10.5 : tier === 'mid' ? 9.0 : 7.5;

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x523b2a, roughness: 0.92, metalness: 0 });
  const foliageMats = [
    new THREE.MeshStandardMaterial({ color: 0x355235, roughness: 0.9, metalness: 0 }),
    new THREE.MeshStandardMaterial({ color: 0x2f4a30, roughness: 0.92, metalness: 0 }),
    new THREE.MeshStandardMaterial({ color: 0x415f3e, roughness: 0.88, metalness: 0 })
  ];

  addCylinderSegment(
    group,
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(randRange(rng, -0.08, 0.08), height, randRange(rng, -0.08, 0.08)),
    tier === 'high' ? 0.28 : 0.24,
    tier === 'high' ? 0.1 : 0.09,
    detail,
    trunkMat
  );

  const clumps = tier === 'high' ? 14 : tier === 'mid' ? 11 : 8;
  for (let i = 0; i < clumps; i += 1) {
    const t = i / Math.max(1, clumps - 1);
    const y = 1.2 + t * (height - 1.1);
    const radius = Math.sin(clamp01(1 - Math.abs(t - 0.45) / 0.58) * Math.PI) * (tier === 'high' ? 1.55 : 1.35) + 0.22;
    const blobs = tier === 'low' ? 3 : 4;

    for (let b = 0; b < blobs; b += 1) {
      const angle = (b / blobs) * Math.PI * 2 + randRange(rng, -0.22, 0.22);
      const blobGeo = new THREE.IcosahedronGeometry(radius * randRange(rng, 0.45, 0.72), tier === 'high' ? 1 : 0);
      const blob = new THREE.Mesh(blobGeo, foliageMats[Math.floor(rng() * foliageMats.length)]);
      blob.position.set(
        Math.cos(angle) * radius * randRange(rng, 0.32, 0.54),
        y + randRange(rng, -0.24, 0.2),
        Math.sin(angle) * radius * randRange(rng, 0.32, 0.54)
      );
      blob.scale.set(randRange(rng, 0.9, 1.18), randRange(rng, 1.05, 1.35), randRange(rng, 0.9, 1.18));
      group.add(blob);
    }
  }

  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.48, tier === 'high' ? 1.6 : 1.25, Math.max(6, detail)), foliageMats[0]);
  cap.position.y = height + (tier === 'high' ? 0.58 : 0.44);
  group.add(cap);

  return group;
}

function createTreeModel(tier = 'high') {
  // Keep a generic "tree_*" set for backward compatibility.
  return createConiferTreeModel(tier);
}

function createShrubLushModel(tier = 'high') {
  const group = new THREE.Group();
  const rng = createSeededRandom(`shrub:lush:${tier}`);
  const detail = tier === 'high' ? 2 : tier === 'mid' ? 1 : 0;
  const coreRadius = tier === 'high' ? 1.08 : tier === 'mid' ? 0.94 : 0.8;
  const clusterCount = tier === 'high' ? 18 : tier === 'mid' ? 12 : 8;
  const stemCount = tier === 'high' ? 8 : tier === 'mid' ? 6 : 4;

  const stemMat = new THREE.MeshStandardMaterial({ color: 0x4f3d2b, roughness: 0.9, metalness: 0 });
  const foliageMats = [
    new THREE.MeshStandardMaterial({ color: 0x4e7d40, roughness: 0.88, metalness: 0 }),
    new THREE.MeshStandardMaterial({ color: 0x5c8a4c, roughness: 0.86, metalness: 0 }),
    new THREE.MeshStandardMaterial({ color: 0x446f39, roughness: 0.9, metalness: 0 })
  ];

  for (let i = 0; i < stemCount; i += 1) {
    const a = (i / stemCount) * Math.PI * 2 + randRange(rng, -0.2, 0.2);
    const s = new THREE.Vector3(Math.cos(a) * randRange(rng, 0.05, 0.16), 0, Math.sin(a) * randRange(rng, 0.05, 0.16));
    const e = new THREE.Vector3(
      Math.cos(a) * randRange(rng, 0.2, 0.45),
      randRange(rng, 0.65, 1.05),
      Math.sin(a) * randRange(rng, 0.2, 0.45)
    );
    addCylinderSegment(group, s, e, randRange(rng, 0.06, 0.08), randRange(rng, 0.03, 0.05), 6, stemMat);
  }

  createLeafCluster(
    group,
    new THREE.Vector3(0, coreRadius * 0.65, 0),
    coreRadius,
    clusterCount,
    tier,
    foliageMats,
    rng,
    0.62
  );

  return group;
}

function createShrubDryModel(tier = 'high') {
  const group = new THREE.Group();
  const rng = createSeededRandom(`shrub:dry:${tier}`);
  const detail = tier === 'high' ? 1 : 0;
  const spread = tier === 'high' ? 0.96 : tier === 'mid' ? 0.84 : 0.72;
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x5d4733, roughness: 0.92, metalness: 0 });
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x7a8251, roughness: 0.9, metalness: 0 });

  const branches = tier === 'high' ? 14 : tier === 'mid' ? 10 : 7;
  for (let i = 0; i < branches; i += 1) {
    const angle = (i / branches) * Math.PI * 2 + randRange(rng, -0.18, 0.18);
    const len = randRange(rng, 0.55, 1.25) * (tier === 'low' ? 0.85 : 1);
    const start = new THREE.Vector3(0, 0.06, 0);
    const bend = new THREE.Vector3(Math.cos(angle) * len * 0.5, randRange(rng, 0.25, 0.45), Math.sin(angle) * len * 0.5);
    const end = new THREE.Vector3(Math.cos(angle) * len, randRange(rng, 0.08, 0.3), Math.sin(angle) * len);
    addCylinderSegment(group, start, bend, 0.06, 0.04, 6, stemMat);
    addCylinderSegment(group, bend, end, 0.04, 0.018, 6, stemMat);

    if (tier !== 'low' || i % 2 === 0) {
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(randRange(rng, 0.12, 0.2), detail), foliageMat);
      leaf.position.copy(end);
      leaf.position.y += randRange(rng, 0.03, 0.12);
      leaf.scale.set(1.1, 0.7, 1.1);
      group.add(leaf);
    }
  }
  return group;
}

function createPlantFernModel(tier = 'high') {
  const group = new THREE.Group();
  const rng = createSeededRandom(`plant:fern:${tier}`);
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x557a45,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide
  });

  const frondCount = tier === 'high' ? 9 : tier === 'mid' ? 7 : 5;
  for (let i = 0; i < frondCount; i += 1) {
    const len = randRange(rng, 0.75, 1.2) * (tier === 'low' ? 0.85 : 1);
    const width = randRange(rng, 0.1, 0.16);
    const segments = tier === 'high' ? 4 : 2;
    const geo = new THREE.PlaneGeometry(width, len, 1, segments);
    const pos = geo.attributes.position;
    for (let j = 0; j < pos.count; j += 1) {
      const y = pos.getY(j);
      const bend = (y / len) * (y / len) * randRange(rng, 0.05, 0.11);
      pos.setZ(j, pos.getZ(j) + bend);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    const frond = new THREE.Mesh(geo, leafMat);
    frond.position.y = len * 0.42;
    frond.rotation.x = randRange(rng, 0.3, 0.58);
    frond.rotation.y = (i / frondCount) * Math.PI * 2 + randRange(rng, -0.22, 0.22);
    frond.rotation.z = randRange(rng, -0.22, 0.22);
    group.add(frond);
  }

  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.08, 0.35, tier === 'high' ? 8 : 6),
    new THREE.MeshStandardMaterial({ color: 0x4f3a2a, roughness: 0.9, metalness: 0 })
  );
  core.position.y = 0.16;
  group.add(core);
  return group;
}

function createPlantGrassClumpModel(tier = 'high') {
  const group = new THREE.Group();
  const rng = createSeededRandom(`plant:grassclump:${tier}`);
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x6b8a51,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide
  });

  const bladeCount = tier === 'high' ? 16 : tier === 'mid' ? 11 : 8;
  for (let i = 0; i < bladeCount; i += 1) {
    const h = randRange(rng, 0.5, 0.96) * (tier === 'low' ? 0.86 : 1);
    const w = randRange(rng, 0.03, 0.06);
    const geo = new THREE.PlaneGeometry(w, h, 1, tier === 'high' ? 3 : 1);
    const pos = geo.attributes.position;
    for (let j = 0; j < pos.count; j += 1) {
      const y = pos.getY(j);
      const bend = (y / h) * (y / h) * randRange(rng, 0.04, 0.08);
      pos.setZ(j, pos.getZ(j) + bend);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    const blade = new THREE.Mesh(geo, bladeMat);
    blade.position.y = h * 0.5;
    blade.rotation.y = randRange(rng, 0, Math.PI * 2);
    blade.rotation.x = randRange(rng, -0.12, 0.24);
    blade.rotation.z = randRange(rng, -0.16, 0.16);
    group.add(blade);
  }
  return group;
}

function createRockModel(tier = 'high') {
  const group = new THREE.Group();
  const radius = tier === 'high' ? 0.9 : tier === 'mid' ? 0.75 : 0.6;
  const detail = tier === 'high' ? 1 : 0;
  const geo = new THREE.DodecahedronGeometry(radius, detail);
  const mat = new THREE.MeshStandardMaterial({ color: 0x6a6b68, roughness: 0.98, flatShading: true });
  const rock = new THREE.Mesh(geo, mat);
  rock.position.y = radius * 0.55;
  rock.scale.set(1, 0.7, 1.2);
  group.add(rock);

  if (tier === 'high') {
    const accentGeo = new THREE.DodecahedronGeometry(0.35, 0);
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x7c7d79, roughness: 0.95 });
    const accent = new THREE.Mesh(accentGeo, accentMat);
    accent.position.set(0.35, 0.55, -0.25);
    group.add(accent);
  }

  return group;
}

function createBarnModel(tier = 'high') {
  const group = new THREE.Group();

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a2b2b, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.8 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e0, roughness: 0.7 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(8, 5.2, 12), wallMat);
  body.position.y = 2.6;
  group.add(body);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(7.2, 3, tier === 'low' ? 4 : 6), roofMat);
  roof.position.y = 6.7;
  roof.rotation.y = Math.PI / 4;
  group.add(roof);

  const door = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.5, 0.2), trimMat);
  door.position.set(0, 1.8, 6.05);
  group.add(door);

  if (tier !== 'low') {
    const windowGeo = new THREE.BoxGeometry(1, 1, 0.15);
    const leftWindow = new THREE.Mesh(windowGeo, trimMat);
    leftWindow.position.set(-2.2, 3.1, 6.05);
    group.add(leftWindow);

    const rightWindow = new THREE.Mesh(windowGeo, trimMat);
    rightWindow.position.set(2.2, 3.1, 6.05);
    group.add(rightWindow);
  }

  if (tier === 'high') {
    const chimneyMat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.85 });
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.7, 0.7), chimneyMat);
    chimney.position.set(2.2, 8.1, -1.5);
    group.add(chimney);
  }

  return group;
}

function createFenceModel(tier = 'high') {
  const group = new THREE.Group();

  const postSegments = tier === 'high' ? 8 : tier === 'mid' ? 6 : 5;
  const railSegments = tier === 'high' ? 8 : tier === 'mid' ? 6 : 4;
  const postMat = new THREE.MeshStandardMaterial({ color: 0x7e5a3b, roughness: 0.86 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x9a724d, roughness: 0.82 });

  const postHeight = 1.15;
  const halfLength = 1.45;
  const postGeo = new THREE.CylinderGeometry(0.08, 0.1, postHeight, postSegments);

  const leftPost = new THREE.Mesh(postGeo, postMat);
  leftPost.position.set(-halfLength, postHeight * 0.5, 0);
  group.add(leftPost);

  const rightPost = new THREE.Mesh(postGeo, postMat);
  rightPost.position.set(halfLength, postHeight * 0.5, 0);
  group.add(rightPost);

  const railCount = tier === 'low' ? 1 : 2;
  const railGeo = new THREE.BoxGeometry(halfLength * 2.05, 0.08, 0.1, railSegments, 1, 1);

  for (let i = 0; i < railCount; i += 1) {
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.y = railCount === 1 ? 0.65 : (0.45 + i * 0.36);
    rail.position.z = 0.02 * (i % 2 === 0 ? 1 : -1);
    group.add(rail);
  }

  return group;
}

function createHayModel(tier = 'high') {
  const group = new THREE.Group();

  const radial = tier === 'high' ? 18 : tier === 'mid' ? 14 : 10;
  const bodyGeo = new THREE.CylinderGeometry(0.62, 0.62, 1.2, radial, 1, false);
  const hayMat = new THREE.MeshStandardMaterial({ color: 0xc89c4a, roughness: 0.95, metalness: 0 });
  const body = new THREE.Mesh(bodyGeo, hayMat);
  body.rotation.z = Math.PI * 0.5;
  body.position.y = 0.62;
  group.add(body);

  const ringMat = new THREE.MeshStandardMaterial({ color: 0x9f7a34, roughness: 0.88 });
  const ringSegments = tier === 'low' ? 1 : 2;
  for (let i = 0; i < ringSegments; i += 1) {
    const torus = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.04, 8, radial), ringMat);
    torus.rotation.y = Math.PI * 0.5;
    torus.position.set((i === 0 ? -0.24 : 0.24), 0.62, 0);
    group.add(torus);
  }

  if (tier === 'high') {
    const flakeGeo = new THREE.BoxGeometry(0.14, 0.04, 0.02);
    const flakeMat = new THREE.MeshStandardMaterial({ color: 0xd9b366, roughness: 1 });
    for (let i = 0; i < 12; i += 1) {
      const flake = new THREE.Mesh(flakeGeo, flakeMat);
      flake.position.set(
        (Math.random() - 0.5) * 1.0,
        0.55 + Math.random() * 0.2,
        (Math.random() - 0.5) * 1.0
      );
      flake.rotation.set(Math.random(), Math.random(), Math.random());
      group.add(flake);
    }
  }

  return group;
}

function createPowerLineModel(tier = 'high') {
  const group = new THREE.Group();

  const poleSegments = tier === 'high' ? 10 : tier === 'mid' ? 8 : 6;
  const crossSegments = tier === 'high' ? 6 : 4;
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x6a4a35, roughness: 0.9 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x8c8f95, roughness: 0.45, metalness: 0.35 });

  const poleHeight = 8.2;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.18, poleHeight, poleSegments), poleMat);
  pole.position.y = poleHeight * 0.5;
  group.add(pole);

  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 0.12, crossSegments, 1, 1), poleMat);
  crossbar.position.y = 7.45;
  group.add(crossbar);

  const armGeo = new THREE.BoxGeometry(0.14, 0.7, 0.14);
  [-1, 0, 1].forEach((slot) => {
    const arm = new THREE.Mesh(armGeo, poleMat);
    arm.position.set(slot * 1.1, 7.05, 0);
    group.add(arm);

    if (tier !== 'low') {
      const insulator = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), metalMat);
      insulator.position.set(slot * 1.1, 6.68, 0);
      group.add(insulator);
    }
  });

  if (tier === 'high') {
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x2e2f33, roughness: 0.6, metalness: 0.1 });
    const cableGeo = new THREE.CylinderGeometry(0.015, 0.015, 2.8, 6);
    const leftCable = new THREE.Mesh(cableGeo, cableMat);
    leftCable.position.set(-1.45, 6.65, 0);
    leftCable.rotation.z = Math.PI * 0.46;
    group.add(leftCable);
    const rightCable = leftCable.clone();
    rightCable.position.x = 1.45;
    rightCable.rotation.z = -Math.PI * 0.46;
    group.add(rightCable);
  }

  return group;
}

async function buildAssetSet(assetName, factory) {
  const tiers = ['high', 'mid', 'low'];
  for (const tier of tiers) {
    const root = factory(tier);
    const output = await exportBinaryGLB(root, `${assetName}_${tier}.glb`);
    console.log(`Generated ${output}`);
  }
}

await buildAssetSet('tree', createTreeModel);
await buildAssetSet('tree_conifer', createConiferTreeModel);
await buildAssetSet('tree_oak', createOakTreeModel);
await buildAssetSet('tree_cypress', createCypressTreeModel);
await buildAssetSet('shrub_lush', createShrubLushModel);
await buildAssetSet('shrub_dry', createShrubDryModel);
await buildAssetSet('plant_fern', createPlantFernModel);
await buildAssetSet('plant_grassclump', createPlantGrassClumpModel);
await buildAssetSet('rock', createRockModel);
await buildAssetSet('barn', createBarnModel);
await buildAssetSet('fence', createFenceModel);
await buildAssetSet('hay', createHayModel);
await buildAssetSet('powerline', createPowerLineModel);

console.log('Environment GLB asset generation complete.');
