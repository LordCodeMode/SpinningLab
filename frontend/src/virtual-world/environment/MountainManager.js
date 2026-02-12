/**
 * MountainManager - layered ridge backdrop with realistic rocky silhouettes.
 */

import * as THREE from 'three';
import { THEMES } from '../scene-config.js';

export class MountainManager {
  constructor(scene, textureFactory = null) {
    this.scene = scene;
    this.textureFactory = textureFactory;
    this.mountainGroup = null;
    this.mountainMaterials = [];
    this.mountainTextures = [];
    this.mountainShaders = [];
    this.ridgeEntries = [];
    this.theme = 'classic';
    this.textures = null;
    this.routeStyle = {
      mountainNearHills: 0.45,
      mountainDetailBoost: 0,
      snowLineBias: 0,
      mountainParallax: 1,
      mountainBackdropDensity: 1
    };
    this.fallbackDetailTexture = null;
  }

  create() {
    this.mountainGroup = new THREE.Group();
    this.textures = this.textureFactory?.getTextures?.() || null;
    this.fallbackDetailTexture = this.createFallbackDetailTexture(128);

    const layers = [
      {
        tone: 'far',
        count: 16,
        spanMin: 520,
        spanMax: 980,
        peakMin: 240,
        peakMax: 510,
        depthMin: 110,
        depthMax: 220,
        profileSamples: 30,
        roughness: 52,
        spreadX: 2060,
        baseZ: 1480,
        zJitter: 280,
        yBase: -36,
        arc: 1.28,
        depthLayers: 3,
        depthLayerSpan: 360,
        lateralJitter: 170,
        headingJitter: 0.48,
        forwardArc: 180,
        outcropCount: [3, 6],
        map: this.cloneMountainTexture(this.textures?.rock, 2.5, 1.7),
        normalMap: this.cloneMountainTexture(this.textures?.rockNormal, 2.5, 1.7),
        roughnessMap: this.cloneMountainTexture(this.textures?.rockRoughness, 2.5, 1.7),
        normalScale: new THREE.Vector2(0.62, 0.62),
        roughnessValue: 0.96,
        strataFreq: 0.22,
        creviceStrength: 0.42,
        shadowLift: 0.24,
        aerialPerspective: 0.62,
        snowAmount: 0.52,
        snowLineStartRatio: 0.42,
        snowLineEndRatio: 0.7
      },
      {
        tone: 'mid',
        count: 12,
        spanMin: 360,
        spanMax: 680,
        peakMin: 170,
        peakMax: 360,
        depthMin: 70,
        depthMax: 145,
        profileSamples: 24,
        roughness: 34,
        spreadX: 1340,
        baseZ: 940,
        zJitter: 220,
        yBase: -18,
        arc: 1.08,
        depthLayers: 3,
        depthLayerSpan: 220,
        lateralJitter: 130,
        headingJitter: 0.36,
        forwardArc: 142,
        outcropCount: [2, 4],
        map: this.cloneMountainTexture(this.textures?.rock, 3.2, 2.2),
        normalMap: this.cloneMountainTexture(this.textures?.rockNormal, 3.2, 2.2),
        roughnessMap: this.cloneMountainTexture(this.textures?.rockRoughness, 3.2, 2.2),
        normalScale: new THREE.Vector2(0.56, 0.56),
        roughnessValue: 0.93,
        strataFreq: 0.24,
        creviceStrength: 0.36,
        shadowLift: 0.2,
        aerialPerspective: 0.48,
        snowAmount: 0.34,
        snowLineStartRatio: 0.5,
        snowLineEndRatio: 0.76
      },
      {
        tone: 'foothill',
        count: 8,
        spanMin: 250,
        spanMax: 460,
        peakMin: 70,
        peakMax: 170,
        depthMin: 50,
        depthMax: 95,
        profileSamples: 18,
        roughness: 16,
        spreadX: 860,
        baseZ: 560,
        zJitter: 120,
        yBase: -12,
        arc: 0.88,
        depthLayers: 2,
        depthLayerSpan: 90,
        lateralJitter: 96,
        headingJitter: 0.24,
        forwardArc: 112,
        outcropCount: [0, 2],
        map: this.cloneMountainTexture(this.textures?.grass, 3.7, 2.4),
        normalMap: this.cloneMountainTexture(this.textures?.grassNormal, 3.7, 2.4),
        roughnessMap: this.cloneMountainTexture(this.textures?.grassRoughness, 3.7, 2.4),
        normalScale: new THREE.Vector2(0.3, 0.3),
        roughnessValue: 0.95,
        strataFreq: 0.17,
        creviceStrength: 0.24,
        shadowLift: 0.16,
        aerialPerspective: 0.24,
        snowAmount: 0.07,
        snowLineStartRatio: 0.72,
        snowLineEndRatio: 0.95
      },
      {
        tone: 'near',
        count: 6,
        spanMin: 210,
        spanMax: 360,
        peakMin: 85,
        peakMax: 190,
        depthMin: 42,
        depthMax: 85,
        profileSamples: 18,
        roughness: 20,
        spreadX: 520,
        baseZ: 420,
        zJitter: 80,
        yBase: -6,
        arc: 0.72,
        depthLayers: 1,
        depthLayerSpan: 0,
        lateralJitter: 84,
        headingJitter: 0.22,
        forwardArc: 96,
        outcropCount: [1, 2],
        map: this.cloneMountainTexture(this.textures?.rock, 3.8, 2.8),
        normalMap: this.cloneMountainTexture(this.textures?.rockNormal, 3.8, 2.8),
        roughnessMap: this.cloneMountainTexture(this.textures?.rockRoughness, 3.8, 2.8),
        normalScale: new THREE.Vector2(0.48, 0.48),
        roughnessValue: 0.93,
        strataFreq: 0.28,
        creviceStrength: 0.46,
        shadowLift: 0.13,
        aerialPerspective: 0.14,
        snowAmount: 0.14,
        snowLineStartRatio: 0.64,
        snowLineEndRatio: 0.9
      }
    ];

    layers.forEach((layer) => this.addRidgeLayer(layer));
    this.addBackdropMassifs();
    this.setTheme(this.theme);
    this.scene.add(this.mountainGroup);
  }

  addRidgeLayer(config) {
    const backdropDensity = THREE.MathUtils.clamp(this.routeStyle.mountainBackdropDensity || 1, 0.7, 1.65);
    const ridgeCount = Math.max(1, Math.round(config.count * backdropDensity));
    for (let i = 0; i < ridgeCount; i += 1) {
      const progress = ridgeCount > 1 ? i / (ridgeCount - 1) : 0.5;
      const span = THREE.MathUtils.lerp(config.spanMin, config.spanMax, Math.random());
      const peakHeight = THREE.MathUtils.lerp(config.peakMin, config.peakMax, Math.random());
      const depth = THREE.MathUtils.lerp(config.depthMin, config.depthMax, Math.random());
      const geometry = this.createRidgeGeometry({
        span,
        peakHeight,
        depth,
        profileSamples: config.profileSamples,
        roughness: config.roughness
      });

      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: config.map || null,
        normalMap: config.normalMap || null,
        roughnessMap: config.roughnessMap || null,
        roughness: config.roughnessValue,
        metalness: 0,
        normalScale: config.normalScale,
        fog: true
      });
      this.enhanceRockShading(material, config, peakHeight);

      const ridge = new THREE.Mesh(geometry, material);
      ridge.castShadow = false;
      ridge.receiveShadow = true;

      const arcAngle = THREE.MathUtils.lerp(-config.arc, config.arc, progress);
      const depthLayers = Math.max(1, config.depthLayers || 1);
      const layerBand = depthLayers > 1
        ? (Math.floor(Math.random() * depthLayers) - (depthLayers - 1) * 0.5)
        : 0;
      const layerSpan = config.depthLayerSpan || 0;
      const depthOffset = layerBand * layerSpan + (Math.random() - 0.5) * layerSpan * 0.34;
      const forwardArc = config.forwardArc || 120;
      const lateralJitter = config.lateralJitter || 110;
      const headingJitter = config.headingJitter || 0.18;
      ridge.position.set(
        Math.sin(arcAngle) * config.spreadX + (Math.random() - 0.5) * lateralJitter,
        config.yBase + (Math.random() - 0.5) * 8,
        config.baseZ + depthOffset + Math.cos(arcAngle) * forwardArc + (Math.random() - 0.5) * config.zJitter
      );
      ridge.rotation.y = arcAngle * 0.2 + (Math.random() - 0.5) * headingJitter;

      this.addRidgeOutcrops(ridge, config, span, peakHeight);
      this.addRidgeNeedles(ridge, config, span, peakHeight);
      this.addSnowCaps(ridge, config, span, peakHeight);

      const tintJitter = {
        h: (Math.random() - 0.5) * 0.07,
        s: (Math.random() - 0.5) * 0.2,
        l: (Math.random() - 0.5) * 0.26
      };

      this.mountainGroup.add(ridge);
      this.mountainMaterials.push({ material, tone: config.tone, tintJitter });
      this.ridgeEntries.push({
        mesh: ridge,
        tone: config.tone,
        baseX: ridge.position.x,
        baseY: ridge.position.y,
        baseZ: ridge.position.z,
        baseScaleX: ridge.scale.x || 1,
        baseScaleY: ridge.scale.y || 1,
        baseScaleZ: ridge.scale.z || 1
      });
    }
  }

  addRidgeOutcrops(ridgeMesh, config, span, peakHeight) {
    const minCount = config.outcropCount?.[0] ?? 0;
    const maxCount = config.outcropCount?.[1] ?? 0;
    const count = Math.max(0, minCount + Math.floor(Math.random() * (Math.max(1, maxCount - minCount + 1))));
    if (!count) return;

    const outcropMaterial = ridgeMesh.material;
    for (let i = 0; i < count; i += 1) {
      const geo = new THREE.DodecahedronGeometry(1.0 + Math.random() * 0.5, 1);
      const rock = new THREE.Mesh(geo, outcropMaterial);
      rock.scale.set(
        1.7 + Math.random() * 2.8,
        2.6 + Math.random() * 4.6,
        1.2 + Math.random() * 2.2
      );
      rock.position.set(
        (-span * 0.4) + Math.random() * (span * 0.8),
        peakHeight * (0.42 + Math.random() * 0.34),
        (Math.random() - 0.5) * 20
      );
      rock.rotation.set(
        (Math.random() - 0.5) * 0.6,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.4
      );
      rock.castShadow = false;
      rock.receiveShadow = true;
      ridgeMesh.add(rock);
    }
  }

  addSnowCaps(ridgeMesh, config, span, peakHeight) {
    if (config.tone !== 'far' && config.tone !== 'mid') return;

    const capCount = config.tone === 'far' ? 4 + Math.floor(Math.random() * 3) : 3 + Math.floor(Math.random() * 2);
    const snowMat = new THREE.MeshStandardMaterial({
      color: 0xf5f9ff,
      roughness: 0.72,
      metalness: 0,
      opacity: config.tone === 'far' ? 0.96 : 0.88,
      transparent: true
    });

    for (let i = 0; i < capCount; i += 1) {
      const capGeo = new THREE.SphereGeometry(1, 8, 6);
      const cap = new THREE.Mesh(capGeo, snowMat);
      cap.scale.set(
        16 + Math.random() * 34,
        5 + Math.random() * 10,
        12 + Math.random() * 26
      );
      cap.position.set(
        (-span * 0.32) + Math.random() * (span * 0.64),
        peakHeight * (0.72 + Math.random() * 0.2),
        (Math.random() - 0.5) * 14
      );
      cap.rotation.set(
        (Math.random() - 0.5) * 0.24,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.18
      );
      cap.castShadow = false;
      cap.receiveShadow = false;
      ridgeMesh.add(cap);
    }
  }

  addRidgeNeedles(ridgeMesh, config, span, peakHeight) {
    if (config.tone !== 'far' && config.tone !== 'mid') return;
    const count = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i += 1) {
      const geo = new THREE.ConeGeometry(1, 1, 6, 1);
      const needle = new THREE.Mesh(geo, ridgeMesh.material);
      needle.scale.set(
        6 + Math.random() * 14,
        16 + Math.random() * 38,
        6 + Math.random() * 14
      );
      needle.position.set(
        (-span * 0.3) + Math.random() * (span * 0.6),
        peakHeight * (0.7 + Math.random() * 0.24),
        (Math.random() - 0.5) * 14
      );
      needle.rotation.set(
        (Math.random() - 0.5) * 0.28,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.22
      );
      needle.castShadow = false;
      needle.receiveShadow = true;
      ridgeMesh.add(needle);
    }
  }

  addBackdropMassifs() {
    const farMap = this.cloneMountainTexture(this.textures?.rock, 2.1, 1.5);
    const farNormal = this.cloneMountainTexture(this.textures?.rockNormal, 2.1, 1.5);
    const farRoughness = this.cloneMountainTexture(this.textures?.rockRoughness, 2.1, 1.5);
    const count = Math.max(8, Math.round(14 * THREE.MathUtils.clamp(this.routeStyle.mountainBackdropDensity || 1, 0.75, 1.6)));

    for (let i = 0; i < count; i += 1) {
      const geometry = this.createMassifGeometry();
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: farMap,
        normalMap: farNormal,
        roughnessMap: farRoughness,
        roughness: 0.95,
        metalness: 0,
        normalScale: new THREE.Vector2(0.56, 0.56),
        fog: true
      });

      const massif = new THREE.Mesh(geometry, material);
      const size = 1 + Math.random() * 1.4;
      massif.scale.set(
        170 * size + Math.random() * 150,
        150 * size + Math.random() * 220,
        170 * size + Math.random() * 150
      );

      const arcT = count > 1 ? i / (count - 1) : 0.5;
      const arc = THREE.MathUtils.lerp(-1.22, 1.22, arcT) + (Math.random() - 0.5) * 0.16;
      massif.position.set(
        Math.sin(arc) * (1880 + Math.random() * 620) + (Math.random() - 0.5) * 220,
        -74 + (Math.random() - 0.5) * 12,
        1620 + Math.cos(arc) * 320 + (Math.random() - 0.5) * 360
      );
      massif.rotation.set(
        (Math.random() - 0.5) * 0.12,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.09
      );
      massif.castShadow = false;
      massif.receiveShadow = true;

      this.addMassifDetailRocks(massif);
      this.addMassifSnowCaps(massif);

      const tintJitter = {
        h: (Math.random() - 0.5) * 0.05,
        s: (Math.random() - 0.5) * 0.18,
        l: (Math.random() - 0.5) * 0.2
      };

      this.mountainGroup.add(massif);
      this.mountainMaterials.push({ material, tone: 'massif', tintJitter });
      this.ridgeEntries.push({
        mesh: massif,
        tone: 'massif',
        baseX: massif.position.x,
        baseY: massif.position.y,
        baseZ: massif.position.z,
        baseScaleX: massif.scale.x,
        baseScaleY: massif.scale.y,
        baseScaleZ: massif.scale.z
      });
    }
  }

  createMassifGeometry() {
    const geometry = new THREE.ConeGeometry(1, 1, 14, 6, false);
    geometry.translate(0, 0.5, 0);
    const positions = geometry.attributes.position;

    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      if (y <= 0) continue;

      const radial = Math.sqrt((x * x) + (z * z));
      const ridgeNoise =
        Math.sin(x * 11 + z * 8) * 0.07
        + Math.cos(x * 17 - z * 13) * 0.04
        - radial * 0.04;
      const verticalNoise =
        Math.abs(Math.sin(x * 9.2 - z * 7.4)) * 0.18
        + Math.sin((x + z) * 5.6) * 0.08;

      positions.setX(i, x + ridgeNoise * 0.32);
      positions.setY(i, y + verticalNoise * y * 0.4);
      positions.setZ(i, z + ridgeNoise * 0.28);
    }

    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  }

  addMassifDetailRocks(massif) {
    const count = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i += 1) {
      const geo = new THREE.DodecahedronGeometry(1, 1);
      const rock = new THREE.Mesh(geo, massif.material);
      rock.scale.set(
        18 + Math.random() * 34,
        16 + Math.random() * 40,
        16 + Math.random() * 32
      );
      rock.position.set(
        (Math.random() - 0.5) * 120,
        54 + Math.random() * 128,
        (Math.random() - 0.5) * 120
      );
      rock.rotation.set(
        (Math.random() - 0.5) * 0.26,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.26
      );
      rock.castShadow = false;
      rock.receiveShadow = true;
      massif.add(rock);
    }
  }

  addMassifSnowCaps(massif) {
    if (Math.random() < 0.25) return;
    const snowMat = new THREE.MeshStandardMaterial({
      color: 0xeaf0f7,
      roughness: 0.76,
      metalness: 0,
      transparent: true,
      opacity: 0.92
    });
    const capCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < capCount; i += 1) {
      const geo = new THREE.IcosahedronGeometry(1, 1);
      const cap = new THREE.Mesh(geo, snowMat);
      cap.scale.set(
        34 + Math.random() * 42,
        16 + Math.random() * 28,
        30 + Math.random() * 38
      );
      cap.position.set(
        (Math.random() - 0.5) * 90,
        160 + Math.random() * 120,
        (Math.random() - 0.5) * 90
      );
      cap.rotation.set(
        (Math.random() - 0.5) * 0.22,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.22
      );
      cap.castShadow = false;
      cap.receiveShadow = false;
      massif.add(cap);
    }
  }

  createRidgeGeometry({ span, peakHeight, depth, profileSamples, roughness }) {
    const halfSpan = span * 0.5;
    const controls = this.createProfileControls(8);
    const shape = new THREE.Shape();
    shape.moveTo(-halfSpan, 0);

    for (let i = 0; i <= profileSamples; i += 1) {
      const t = i / profileSamples;
      const x = -halfSpan + t * span;

      const broadMountain = Math.pow(Math.sin(t * Math.PI), 0.54);
      const macroWave = Math.sin(t * Math.PI * (1.2 + controls[2] * 1.5)) * 0.16;

      const serrationA = Math.pow(Math.max(0, Math.sin((t * Math.PI * (7 + controls[5] * 5)) + controls[0] * 4.2)), 3.2) * 0.22;
      const serrationB = Math.pow(Math.max(0, Math.sin((t * Math.PI * (14 + controls[6] * 7)) + controls[1] * 5.4)), 4.1) * 0.16;
      const notch = Math.pow(Math.abs(Math.sin((t * Math.PI * (5 + controls[7] * 4)) + controls[3] * 7.3)), 2.2) * 0.1;

      const profileNoise = this.sampleSmoothControls(controls, t) * 0.18;

      const height = THREE.MathUtils.clamp(
        peakHeight * (0.15 + broadMountain * 0.55 + macroWave + profileNoise + serrationA + serrationB - notch),
        peakHeight * 0.08,
        peakHeight * 1.04
      );

      shape.lineTo(x, height);
    }

    shape.lineTo(halfSpan, 0);
    shape.lineTo(-halfSpan, 0);

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      steps: 2,
      bevelEnabled: false,
      curveSegments: 16
    });
    geometry.translate(0, 0, -depth * 0.5);

    const positions = geometry.attributes.position;
    const ridgeScale = roughness / Math.max(1, peakHeight);

    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      if (y <= 0) continue;

      const yMask = y / peakHeight;
      const warp = (
        Math.sin(x * 0.028 + z * 0.06) * roughness
        + Math.sin(x * 0.064 - z * 0.031) * roughness * 0.52
        + Math.sin(x * 0.14 + z * 0.13) * roughness * 0.16
      ) * yMask;

      const vertical = (
        Math.sin(x * 0.017 + z * 0.014) * roughness * 0.14
        - Math.abs(Math.sin(x * 0.082 - z * 0.043)) * roughness * 0.08
      ) * yMask;

      positions.setZ(i, z + warp * ridgeScale);
      positions.setY(i, y + vertical);
    }

    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  }

  enhanceRockShading(material, config, peakHeight) {
    const detailNoiseMap = this.textures?.blendNoise || this.textures?.rock || this.fallbackDetailTexture;
    const snowStartRatio = config.snowLineStartRatio || 0.62;
    const snowEndRatio = config.snowLineEndRatio || 0.9;

    material.onBeforeCompile = (shader) => {
      shader.uniforms.detailNoiseMap = { value: detailNoiseMap };
      shader.uniforms.strataFreq = { value: config.strataFreq || 0.2 };
      shader.uniforms.creviceStrength = { value: config.creviceStrength || 0.35 };
      shader.uniforms.snowLineStart = { value: peakHeight * snowStartRatio };
      shader.uniforms.snowLineEnd = { value: peakHeight * snowEndRatio };
      shader.uniforms.snowAmount = { value: config.snowAmount || 0.12 };
      shader.uniforms.snowTint = { value: new THREE.Color(0xdce4ee) };
      shader.uniforms.detailBoost = { value: 1 };
      shader.uniforms.snowLineBias = { value: 0 };
      shader.uniforms.shadowLift = { value: config.shadowLift || 0.14 };
      shader.uniforms.aerialPerspective = { value: config.aerialPerspective || 0.2 };
      shader.uniforms.hazeTint = { value: new THREE.Color(0x9caab9) };

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vWorldPos;
          varying float vLocalY;
          varying vec3 vWorldNormal;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vLocalY = transformed.y;`
        )
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
          vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
          vWorldPos = worldPosition.xyz;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform sampler2D detailNoiseMap;
          uniform float strataFreq;
          uniform float creviceStrength;
          uniform float snowLineStart;
          uniform float snowLineEnd;
          uniform float snowAmount;
          uniform vec3 snowTint;
          uniform float detailBoost;
          uniform float snowLineBias;
          uniform float shadowLift;
          uniform float aerialPerspective;
          uniform vec3 hazeTint;
          varying vec3 vWorldPos;
          varying float vLocalY;
          varying vec3 vWorldNormal;`
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          vec2 ridgeUv = vWorldPos.xz * 0.00175;
          float noiseA = texture2D(detailNoiseMap, ridgeUv + vec2(0.013 * vWorldPos.y, 0.0)).r;
          float noiseB = texture2D(detailNoiseMap, ridgeUv * 1.95 + vec2(7.3, 12.8)).g;
          float noiseC = texture2D(detailNoiseMap, ridgeUv * 0.75 + vec2(13.1, 4.7)).b;
          float ridgeNoise = clamp(noiseA * 0.5 + noiseB * 0.35 + noiseC * 0.15, 0.0, 1.0);

          float strata = sin((vLocalY + ridgeNoise * 14.0) * strataFreq * detailBoost);
          float strataMask = smoothstep(-0.35, 0.95, strata);

          float crackBands = abs(sin((vWorldPos.x + vWorldPos.z * 0.4) * 0.09 + ridgeNoise * 6.0));
          float creviceMask = smoothstep(0.58, 0.95, ridgeNoise * 0.82 + (1.0 - strataMask) * 0.52 + crackBands * 0.2 * detailBoost);

          diffuseColor.rgb *= mix(0.8, 1.1, strataMask);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.54, creviceMask * creviceStrength * detailBoost);
          vec3 warmRock = vec3(0.46, 0.4, 0.34);
          vec3 coolRock = vec3(0.34, 0.38, 0.44);
          vec3 heteroTint = mix(warmRock, coolRock, noiseC);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * heteroTint * 1.32, 0.22 + creviceMask * 0.15);

          float snowNoise = texture2D(detailNoiseMap, ridgeUv * 0.6 + vec2(2.5, 9.1)).r;
          float snowSlopeMask = smoothstep(0.18, 0.82, vWorldNormal.y);
          float snowMask = smoothstep(snowLineStart + snowLineBias, snowLineEnd + snowLineBias, vLocalY + snowNoise * 18.0) * snowAmount * (0.38 + 0.62 * snowSlopeMask);
          diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, snowTint, 0.68), snowMask);

          float distToCamera = length(vWorldPos.xz);
          float haze = smoothstep(420.0, 2600.0, distToCamera) * aerialPerspective;
          diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, hazeTint, 0.72), haze);
          diffuseColor.rgb = max(diffuseColor.rgb, vec3(shadowLift));`
        );

      this.mountainShaders.push({ tone: config.tone, uniforms: shader.uniforms });
    };

    material.needsUpdate = true;
  }

  createProfileControls(count = 8) {
    const controls = [];
    for (let i = 0; i < count; i += 1) {
      controls.push(0.2 + Math.random() * 0.8);
    }
    return controls;
  }

  sampleSmoothControls(controls, t) {
    if (controls.length === 1) return controls[0];
    const scaled = t * (controls.length - 1);
    const lower = Math.floor(scaled);
    const upper = Math.min(controls.length - 1, lower + 1);
    const localT = scaled - lower;
    const smoothT = localT * localT * (3 - 2 * localT);
    return THREE.MathUtils.lerp(controls[lower], controls[upper], smoothT);
  }

  createFallbackDetailTexture(size = 128) {
    const count = size * size;
    const data = new Uint8Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const value = Math.floor(Math.random() * 255);
      const valueB = Math.floor(Math.random() * 255);
      data[i * 3] = value;
      data[i * 3 + 1] = Math.floor((value * 0.6) + (valueB * 0.4));
      data[i * 3 + 2] = valueB;
    }

    const texture = new THREE.DataTexture(data, size, size, THREE.RGBFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipMapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  }

  cloneMountainTexture(texture, repeatX = 1, repeatY = 1) {
    if (!texture) return null;
    const clone = texture.clone();
    clone.wrapS = THREE.RepeatWrapping;
    clone.wrapT = THREE.RepeatWrapping;
    clone.repeat.set(repeatX, repeatY);
    clone.needsUpdate = true;
    this.mountainTextures.push(clone);
    return clone;
  }

  setTheme(themeId) {
    this.theme = themeId;
    const preset = THEMES[themeId] || THEMES.classic;

    const farColor = new THREE.Color(preset.mountain).offsetHSL(0.012, -0.02, 0.14);
    const midColor = new THREE.Color(preset.mountain).offsetHSL(0.015, -0.06, 0.03);
    const massifColor = new THREE.Color(preset.mountain).offsetHSL(-0.008, -0.03, -0.01);
    const foothillColor = new THREE.Color(preset.grassDark).offsetHSL(0, -0.03, -0.02);
    const nearColor = new THREE.Color(preset.mountain).offsetHSL(-0.02, -0.1, -0.08);

    this.mountainMaterials.forEach((entry) => {
      if (!entry?.material) return;
      const tint = entry.tintJitter || { h: 0, s: 0, l: 0 };
      if (entry.tone === 'far') {
        entry.material.color.copy(farColor).offsetHSL(tint.h, tint.s * 1.3, tint.l * 1.35);
      } else if (entry.tone === 'mid') {
        entry.material.color.copy(midColor).offsetHSL(tint.h * 1.1, tint.s * 1.2, tint.l * 1.2);
      } else if (entry.tone === 'massif') {
        entry.material.color.copy(massifColor).offsetHSL(tint.h * 0.92, tint.s, tint.l * 0.95);
      } else if (entry.tone === 'near') {
        entry.material.color.copy(nearColor).offsetHSL(tint.h, tint.s, tint.l * 0.9);
      } else {
        entry.material.color.copy(foothillColor).offsetHSL(tint.h * 0.8, tint.s * 0.7, tint.l * 0.6);
      }
    });

    this.mountainShaders.forEach((shader) => {
      if (!shader?.uniforms?.snowTint) return;
      if (shader.tone === 'far') {
        shader.uniforms.snowTint.value.set(0xe5ecf4);
      } else if (shader.tone === 'mid') {
        shader.uniforms.snowTint.value.set(0xdbe3ed);
      } else if (shader.tone === 'near') {
        shader.uniforms.snowTint.value.set(0xdbe3ec);
      } else {
        shader.uniforms.snowTint.value.set(0xd5dde8);
      }
    });

    this.applyRouteStyle();
  }

  applyRouteStyle() {
    const nearHills = THREE.MathUtils.clamp(this.routeStyle.mountainNearHills || 0, 0, 1);
    const detailBoost = 1 + THREE.MathUtils.clamp(this.routeStyle.mountainDetailBoost || 0, 0, 0.5);
    const snowLineBias = THREE.MathUtils.clamp(this.routeStyle.snowLineBias || 0, -40, 30);
    const backdropDensity = THREE.MathUtils.clamp(this.routeStyle.mountainBackdropDensity || 1, 0.7, 1.65);

    this.ridgeEntries.forEach((entry) => {
      if (!entry?.mesh) return;
      if (entry.tone === 'near') {
        entry.mesh.visible = nearHills > 0.18;
        entry.mesh.position.z = entry.baseZ - (1 - nearHills) * 120;
        entry.mesh.position.y = entry.baseY - (1 - nearHills) * 5;
        return;
      }
      if (entry.tone === 'massif') {
        entry.mesh.visible = backdropDensity > 0.85;
        const scaleFactor = THREE.MathUtils.lerp(0.86, 1.18, (backdropDensity - 0.7) / 0.95);
        const baseScaleX = entry.baseScaleX || 1;
        const baseScaleY = entry.baseScaleY || 1;
        const baseScaleZ = entry.baseScaleZ || 1;
        entry.mesh.scale.set(
          baseScaleX * scaleFactor,
          baseScaleY * (scaleFactor * 0.96),
          baseScaleZ * scaleFactor
        );
        return;
      }
      if (entry.tone === 'far' || entry.tone === 'mid') {
        const scaleFactor = THREE.MathUtils.lerp(0.9, 1.14, (backdropDensity - 0.7) / 0.95);
        entry.mesh.scale.set(
          (entry.baseScaleX || 1) * scaleFactor,
          (entry.baseScaleY || 1) * scaleFactor,
          (entry.baseScaleZ || 1) * scaleFactor
        );
      }
    });

    this.mountainShaders.forEach((shader) => {
      if (!shader?.uniforms) return;
      const toneShadowLift = shader.tone === 'far'
        ? 0.22
        : shader.tone === 'mid'
          ? 0.19
          : shader.tone === 'foothill'
            ? 0.16
            : 0.13;
      const toneAerial = shader.tone === 'far'
        ? 0.6
        : shader.tone === 'mid'
          ? 0.46
          : shader.tone === 'foothill'
            ? 0.24
            : 0.14;
      if (shader.uniforms.detailBoost) {
        const toneBoost = shader.tone === 'far' ? 0.04 : shader.tone === 'near' ? 0.12 : 0.08;
        shader.uniforms.detailBoost.value = detailBoost + toneBoost;
      }
      if (shader.uniforms.snowLineBias) {
        const toneBias = shader.tone === 'far' ? snowLineBias : shader.tone === 'near' ? snowLineBias * 0.45 : snowLineBias * 0.72;
        shader.uniforms.snowLineBias.value = toneBias;
      }
      if (shader.uniforms.shadowLift) {
        shader.uniforms.shadowLift.value = toneShadowLift;
      }
      if (shader.uniforms.aerialPerspective) {
        shader.uniforms.aerialPerspective.value = toneAerial;
      }
    });
  }

  setRouteStyle(style = {}) {
    this.routeStyle = {
      ...this.routeStyle,
      ...(style || {})
    };
    this.applyRouteStyle();
  }

  update(_deltaTime, worldState = null) {
    if (!this.mountainGroup || !worldState) return;

    const parallax = THREE.MathUtils.clamp(this.routeStyle.mountainParallax || 1, 0.6, 1.5);
    const roadOffset = worldState.roadOffset || 0;
    const hillVista = worldState.sceneryProfile?.hillVista || 0;

    this.mountainGroup.position.x = -roadOffset * 0.18 * parallax;
    this.mountainGroup.position.y = hillVista * 4.2;
  }

  destroy() {
    if (this.mountainGroup) {
      this.scene.remove(this.mountainGroup);
      this.mountainGroup.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }

    this.mountainTextures.forEach((texture) => texture?.dispose?.());
    this.mountainTextures = [];
    this.fallbackDetailTexture?.dispose?.();
    this.fallbackDetailTexture = null;
    this.mountainMaterials = [];
    this.mountainShaders = [];
    this.ridgeEntries = [];
    this.mountainGroup = null;
  }
}
