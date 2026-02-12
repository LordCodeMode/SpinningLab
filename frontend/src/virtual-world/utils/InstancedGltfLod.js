/**
 * InstancedGltfLod - load GLTF LOD tiers and render them via InstancedMesh batches.
 * Supports optional far-distance impostor card tiers, including rendered atlas snapshots from source GLTF models.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class InstancedGltfLod {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.loader = new GLTFLoader();
    this.textureLoader = new THREE.TextureLoader();

    this.levels = options.levels || [];
    this.capacity = options.capacity || 512;
    this.castShadow = options.castShadow ?? true;
    this.receiveShadow = options.receiveShadow ?? true;
    this.frustumCulled = options.frustumCulled ?? false;
    this.enableInstanceColor = options.enableInstanceColor ?? true;
    this.materialHook = typeof options.materialHook === 'function' ? options.materialHook : null;
    this.paletteLock = options.paletteLock
      ? {
          enabled: true,
          hueCenter: 0.3,
          hueRange: 0.08,
          satMin: 0.22,
          satMax: 0.78,
          lumaMin: 0.2,
          lumaMax: 0.82,
          seasonHueShift: 0,
          seasonSatMult: 1,
          seasonLumaMult: 1,
          ...options.paletteLock
        }
      : null;
    this._paletteMaterials = new Set();

    this.loadedLevels = [];
    this.visible = true;
    this.ready = false;

    this._m1 = new THREE.Matrix4();
    this._v1 = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._white = new THREE.Color(0xffffff);
    this._impostorAtlasCache = new Map();
  }

  async load() {
    this.loadedLevels = [];

    for (const level of this.levels) {
      if ((level.type || '').toLowerCase() === 'impostor') {
        const impostorLevel = await this.#createImpostorLevel(level);
        this.loadedLevels.push(impostorLevel);
        continue;
      }

      const gltf = await this.loader.loadAsync(level.path);
      const parsedLevel = this.#parseGltfLevel(level, gltf.scene);
      this.loadedLevels.push(parsedLevel);
    }

    this.ready = this.loadedLevels.length > 0;
  }

  #cloneMaterial(material) {
    if (Array.isArray(material)) {
      return material.map((mat) => {
        const cloned = mat?.clone?.() || new THREE.MeshStandardMaterial({ color: 0x999999 });
        cloned.vertexColors = this.enableInstanceColor || Boolean(cloned.vertexColors);
        this.#applyMaterialStyle(cloned);
        return cloned;
      });
    }
    const cloned = material?.clone?.() || new THREE.MeshStandardMaterial({ color: 0x999999 });
    cloned.vertexColors = this.enableInstanceColor || Boolean(cloned.vertexColors);
    this.#applyMaterialStyle(cloned);
    return cloned;
  }

  #applyMaterialStyle(material) {
    if (!material) return;

    if (this.materialHook) {
      this.materialHook(material);
    }

    if (this.paletteLock) {
      this.#attachPaletteLock(material);
    }
  }

  #attachPaletteLock(material) {
    if (!material || material.userData?.__paletteLockPatched) return;

    const prevOnBeforeCompile = material.onBeforeCompile;
    const prevCacheKey = material.customProgramCacheKey;
    material.userData = material.userData || {};

    material.onBeforeCompile = (shader, ...rest) => {
      if (typeof prevOnBeforeCompile === 'function') {
        prevOnBeforeCompile(shader, ...rest);
      }

      shader.uniforms.uPaletteEnabled = { value: this.paletteLock?.enabled ? 1 : 0 };
      shader.uniforms.uHueCenter = { value: this.paletteLock?.hueCenter ?? 0.3 };
      shader.uniforms.uHueRange = { value: this.paletteLock?.hueRange ?? 0.08 };
      shader.uniforms.uSatMin = { value: this.paletteLock?.satMin ?? 0.22 };
      shader.uniforms.uSatMax = { value: this.paletteLock?.satMax ?? 0.78 };
      shader.uniforms.uLumaMin = { value: this.paletteLock?.lumaMin ?? 0.2 };
      shader.uniforms.uLumaMax = { value: this.paletteLock?.lumaMax ?? 0.82 };
      shader.uniforms.uSeasonHueShift = { value: this.paletteLock?.seasonHueShift ?? 0 };
      shader.uniforms.uSeasonSatMult = { value: this.paletteLock?.seasonSatMult ?? 1 };
      shader.uniforms.uSeasonLumaMult = { value: this.paletteLock?.seasonLumaMult ?? 1 };

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
        uniform float uPaletteEnabled;
        uniform float uHueCenter;
        uniform float uHueRange;
        uniform float uSatMin;
        uniform float uSatMax;
        uniform float uLumaMin;
        uniform float uLumaMax;
        uniform float uSeasonHueShift;
        uniform float uSeasonSatMult;
        uniform float uSeasonLumaMult;

        vec3 pp_rgb2hsv(vec3 c) {
          vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
          vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
          vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
          float d = q.x - min(q.w, q.y);
          float e = 1.0e-10;
          return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
        }

        vec3 pp_hsv2rgb(vec3 c) {
          vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
          vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
          return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        vec3 applyFoliagePaletteLock(vec3 color) {
          vec3 hsv = pp_rgb2hsv(color);
          float centeredDelta = mod(hsv.x - uHueCenter + 0.5, 1.0) - 0.5;
          float clampedHue = uHueCenter + clamp(centeredDelta, -uHueRange, uHueRange);
          hsv.x = fract(clampedHue + uSeasonHueShift);
          hsv.y = clamp(hsv.y * uSeasonSatMult, uSatMin, uSatMax);

          vec3 recolored = pp_hsv2rgb(hsv);
          float luma = dot(recolored, vec3(0.2126, 0.7152, 0.0722));
          float targetLuma = clamp(luma * uSeasonLumaMult, uLumaMin, uLumaMax);
          recolored *= targetLuma / max(luma, 1e-4);
          return clamp(recolored, 0.0, 1.0);
        }`
      );

      if (shader.fragmentShader.includes('gl_FragColor = vec4( outgoingLight, diffuseColor.a );')) {
        shader.fragmentShader = shader.fragmentShader.replace(
          'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
          `vec3 __paletteOut = outgoingLight;
          if (uPaletteEnabled > 0.5) {
            __paletteOut = applyFoliagePaletteLock(__paletteOut);
          }
          gl_FragColor = vec4( __paletteOut, diffuseColor.a );`
        );
      } else if (shader.fragmentShader.includes('gl_FragColor = vec4( outgoingLight, 1.0 );')) {
        shader.fragmentShader = shader.fragmentShader.replace(
          'gl_FragColor = vec4( outgoingLight, 1.0 );',
          `vec3 __paletteOut = outgoingLight;
          if (uPaletteEnabled > 0.5) {
            __paletteOut = applyFoliagePaletteLock(__paletteOut);
          }
          gl_FragColor = vec4( __paletteOut, 1.0 );`
        );
      }

      material.userData.__paletteUniforms = shader.uniforms;
    };

    material.customProgramCacheKey = () => {
      const base = typeof prevCacheKey === 'function' ? prevCacheKey.call(material) : '';
      return `${base}|palette-lock-v1`;
    };

    material.userData.__paletteLockPatched = true;
    this._paletteMaterials.add(material);
    material.needsUpdate = true;
  }

  setPaletteLock(lock = {}) {
    if (!this.paletteLock) {
      this.paletteLock = {
        enabled: true,
        hueCenter: 0.3,
        hueRange: 0.08,
        satMin: 0.22,
        satMax: 0.78,
        lumaMin: 0.2,
        lumaMax: 0.82,
        seasonHueShift: 0,
        seasonSatMult: 1,
        seasonLumaMult: 1
      };
    }

    this.paletteLock = {
      ...this.paletteLock,
      ...lock
    };

    this._paletteMaterials.forEach((material) => {
      const uniforms = material?.userData?.__paletteUniforms;
      if (!uniforms) {
        material.needsUpdate = true;
        return;
      }
      if (uniforms.uPaletteEnabled) uniforms.uPaletteEnabled.value = this.paletteLock.enabled ? 1 : 0;
      if (uniforms.uHueCenter) uniforms.uHueCenter.value = this.paletteLock.hueCenter;
      if (uniforms.uHueRange) uniforms.uHueRange.value = this.paletteLock.hueRange;
      if (uniforms.uSatMin) uniforms.uSatMin.value = this.paletteLock.satMin;
      if (uniforms.uSatMax) uniforms.uSatMax.value = this.paletteLock.satMax;
      if (uniforms.uLumaMin) uniforms.uLumaMin.value = this.paletteLock.lumaMin;
      if (uniforms.uLumaMax) uniforms.uLumaMax.value = this.paletteLock.lumaMax;
      if (uniforms.uSeasonHueShift) uniforms.uSeasonHueShift.value = this.paletteLock.seasonHueShift;
      if (uniforms.uSeasonSatMult) uniforms.uSeasonSatMult.value = this.paletteLock.seasonSatMult;
      if (uniforms.uSeasonLumaMult) uniforms.uSeasonLumaMult.value = this.paletteLock.seasonLumaMult;
    });
  }

  #parseGltfLevel(levelDef, rootScene) {
    rootScene.updateMatrixWorld(true);

    const parts = [];
    const rootInverse = rootScene.matrixWorld.clone().invert();

    rootScene.traverse((node) => {
      if (!node.isMesh || !node.geometry) return;

      const localMatrix = rootInverse.clone().multiply(node.matrixWorld);
      const clonedMaterial = this.#cloneMaterial(node.material);

      const instanced = new THREE.InstancedMesh(node.geometry.clone(), clonedMaterial, this.capacity);
      instanced.castShadow = this.castShadow;
      instanced.receiveShadow = this.receiveShadow;
      instanced.frustumCulled = this.frustumCulled;
      instanced.count = 0;
      this.scene.add(instanced);

      parts.push({
        instanced,
        localMatrix,
        count: 0,
        colorDirty: false
      });
    });

    return {
      ...levelDef,
      kind: 'gltf',
      parts
    };
  }

  #normalizeTexture(texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
  }

  #defaultFrames(count = 1) {
    const frames = [];
    for (let i = 0; i < count; i++) {
      frames.push({
        u0: i / count,
        v0: 0,
        u1: (i + 1) / count,
        v1: 1
      });
    }
    return frames;
  }

  #createUvMappedCardGeometry(width, height, frame) {
    const geo = new THREE.PlaneGeometry(width, height, 1, 1);
    geo.translate(0, height * 0.5, 0);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      uv.setXY(
        i,
        THREE.MathUtils.lerp(frame.u0, frame.u1, u),
        THREE.MathUtils.lerp(frame.v0, frame.v1, v)
      );
    }
    uv.needsUpdate = true;
    return geo;
  }

  #createProceduralImpostorAtlas(style = 'tree', size = 256, frameCount = 2) {
    const cols = Math.max(1, frameCount);
    const canvas = document.createElement('canvas');
    canvas.width = size * cols;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let frame = 0; frame < cols; frame++) {
      const ox = frame * size;
      ctx.save();
      ctx.translate(ox, 0);

      if (style === 'rock') {
        const grad = ctx.createLinearGradient(0, size * 0.2, 0, size);
        grad.addColorStop(0, '#a5a69e');
        grad.addColorStop(1, '#5f6059');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(size * 0.16, size * 0.89);
        ctx.lineTo(size * 0.25, size * 0.42);
        ctx.lineTo(size * 0.44, size * 0.22);
        ctx.lineTo(size * 0.68, size * 0.21);
        ctx.lineTo(size * 0.85, size * 0.48);
        ctx.lineTo(size * 0.9, size * 0.88);
        ctx.closePath();
        ctx.fill();
      } else if (style === 'barn') {
        const wallGrad = ctx.createLinearGradient(0, size * 0.42, 0, size);
        wallGrad.addColorStop(0, '#a8453f');
        wallGrad.addColorStop(1, '#6a312c');
        ctx.fillStyle = wallGrad;
        ctx.fillRect(size * 0.17, size * 0.44, size * 0.66, size * 0.43);
        ctx.fillStyle = '#4e4a45';
        ctx.beginPath();
        ctx.moveTo(size * 0.12, size * 0.46);
        ctx.lineTo(size * 0.5, size * 0.23);
        ctx.lineTo(size * 0.88, size * 0.46);
        ctx.closePath();
        ctx.fill();
      } else if (style === 'powerline') {
        ctx.fillStyle = '#6f533d';
        ctx.fillRect(size * 0.47, size * 0.18, size * 0.06, size * 0.74);
        ctx.fillRect(size * 0.26, size * 0.24, size * 0.48, size * 0.04);
      } else if (style === 'hay') {
        ctx.fillStyle = '#c89f4d';
        ctx.beginPath();
        ctx.ellipse(size * 0.5, size * 0.72, size * 0.28, size * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (style === 'fence') {
        ctx.fillStyle = '#8f6846';
        ctx.fillRect(size * 0.19, size * 0.62, size * 0.62, size * 0.08);
        ctx.fillRect(size * 0.19, size * 0.48, size * 0.62, size * 0.08);
        ctx.fillRect(size * 0.18, size * 0.36, size * 0.06, size * 0.42);
        ctx.fillRect(size * 0.76, size * 0.36, size * 0.06, size * 0.42);
      } else {
        ctx.fillStyle = '#4d382a';
        ctx.fillRect(size * 0.46, size * 0.56, size * 0.08, size * 0.36);
        const crownGrad = ctx.createRadialGradient(size * 0.5, size * 0.36, size * 0.08, size * 0.5, size * 0.38, size * 0.36);
        crownGrad.addColorStop(0, '#5b9251');
        crownGrad.addColorStop(1, '#335f30');
        ctx.fillStyle = crownGrad;
        [
          [0.38, 0.43, 0.2],
          [0.62, 0.43, 0.2],
          [0.5, 0.3, 0.24],
          [0.5, 0.5, 0.2]
        ].forEach(([x, y, r]) => {
          ctx.beginPath();
          ctx.arc(size * x, size * y, size * r, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      ctx.restore();
    }

    return {
      texture: this.#normalizeTexture(new THREE.CanvasTexture(canvas)),
      frames: this.#defaultFrames(cols),
      generated: true
    };
  }

  async #createRenderedImpostorAtlas(sourcePath, levelDef) {
    if (typeof document === 'undefined') {
      return this.#createProceduralImpostorAtlas(levelDef.style || 'tree', levelDef.textureSize || 256, levelDef.atlasFrames || 2);
    }

    const atlasFrames = Math.max(1, levelDef.atlasFrames || (levelDef.cross === false ? 1 : 2));
    const frameSize = Math.max(128, levelDef.textureSize || 512);
    const canvas = document.createElement('canvas');
    canvas.width = frameSize * atlasFrames;
    canvas.height = frameSize;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    renderer.setSize(canvas.width, canvas.height, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.28;
    renderer.setScissorTest(true);

    const tempScene = new THREE.Scene();
    const ambient = new THREE.AmbientLight(0xffffff, 1.05);
    const key = new THREE.DirectionalLight(0xfff4de, 1.95);
    key.position.set(3.2, 6.2, 2.4);
    const fill = new THREE.DirectionalLight(0xdfeaf8, 0.95);
    fill.position.set(-2.4, 3.4, -2.8);
    const rim = new THREE.DirectionalLight(0xffe9c2, 0.62);
    rim.position.set(-3.1, 2.8, 2.9);
    tempScene.add(ambient, key, fill, rim);

    let root = null;
    try {
      const gltf = await this.loader.loadAsync(sourcePath);
      root = gltf.scene;
      root.updateMatrixWorld(true);

      const bbox = new THREE.Box3().setFromObject(root);
      const size = bbox.getSize(this._v1);
      const center = bbox.getCenter(this._v2);

      const pivot = new THREE.Group();
      root.position.sub(center);
      root.position.y -= bbox.min.y;
      pivot.add(root);
      tempScene.add(pivot);
      pivot.updateMatrixWorld(true);

      const maxDim = Math.max(size.x, size.y, size.z, 0.001);
      const cam = new THREE.PerspectiveCamera(28, 1, 0.01, Math.max(64, maxDim * 18));
      const target = new THREE.Vector3(0, size.y * 0.5, 0);

      const viewAngles = atlasFrames === 2
        ? [0, Math.PI * 0.5]
        : Array.from({ length: atlasFrames }, (_, i) => (i / atlasFrames) * Math.PI * 2);

      viewAngles.forEach((angle, idx) => {
        const radius = maxDim * 1.55 + size.y * 0.38;
        cam.position.set(
          Math.sin(angle) * radius,
          size.y * 0.55,
          Math.cos(angle) * radius
        );
        cam.lookAt(target);
        cam.updateProjectionMatrix();

        renderer.setViewport(idx * frameSize, 0, frameSize, frameSize);
        renderer.setScissor(idx * frameSize, 0, frameSize, frameSize);
        renderer.clear(true, true, true);
        renderer.render(tempScene, cam);
      });
    } finally {
      renderer.setScissorTest(false);
      renderer.forceContextLoss();
      renderer.dispose();

      if (root) {
        root.removeFromParent();
      }
    }

    return {
      texture: this.#normalizeTexture(new THREE.CanvasTexture(canvas)),
      frames: this.#defaultFrames(atlasFrames),
      generated: true
    };
  }

  async #loadImpostorAtlas(levelDef) {
    if (levelDef.texturePath) {
      const key = `tex:${levelDef.texturePath}:${levelDef.atlasFrames || 1}`;
      if (this._impostorAtlasCache.has(key)) return this._impostorAtlasCache.get(key);
      const loaded = await this.textureLoader.loadAsync(levelDef.texturePath);
      const atlas = {
        texture: this.#normalizeTexture(loaded),
        frames: this.#defaultFrames(levelDef.atlasFrames || 1),
        generated: false
      };
      this._impostorAtlasCache.set(key, atlas);
      return atlas;
    }

    if (levelDef.sourcePath) {
      const key = `src:${levelDef.sourcePath}:${levelDef.textureSize || 512}:${levelDef.atlasFrames || 2}`;
      if (this._impostorAtlasCache.has(key)) return this._impostorAtlasCache.get(key);
      const atlas = await this.#createRenderedImpostorAtlas(levelDef.sourcePath, levelDef);
      this._impostorAtlasCache.set(key, atlas);
      return atlas;
    }

    const style = levelDef.style || 'tree';
    const size = levelDef.textureSize || 256;
    const frames = levelDef.atlasFrames || (levelDef.cross === false ? 1 : 2);
    const key = `proc:${style}:${size}:${frames}`;

    if (this._impostorAtlasCache.has(key)) return this._impostorAtlasCache.get(key);
    const atlas = this.#createProceduralImpostorAtlas(style, size, frames);
    this._impostorAtlasCache.set(key, atlas);
    return atlas;
  }

  async #createImpostorLevel(levelDef) {
    const width = levelDef.width || 6;
    const height = levelDef.height || 10;
    const cross = levelDef.cross ?? true;
    const alphaTest = levelDef.alphaTest ?? 0.3;
    const atlas = await this.#loadImpostorAtlas(levelDef);

    const cardMaterial = new THREE.MeshBasicMaterial({
      map: atlas.texture,
      transparent: true,
      alphaTest,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false
    });
    cardMaterial.vertexColors = this.enableInstanceColor;
    this.#applyMaterialStyle(cardMaterial);

    const parts = [];
    const cardCount = cross ? 2 : 1;
    const frames = atlas.frames?.length ? atlas.frames : this.#defaultFrames(cardCount);

    for (let i = 0; i < cardCount; i++) {
      const frame = frames[i % frames.length];
      const cardGeometry = this.#createUvMappedCardGeometry(width, height, frame);
      const localMatrix = new THREE.Matrix4().makeRotationY(cross && i === 1 ? Math.PI * 0.5 : 0);
      const levelMaterial = cardMaterial.clone();
      this.#applyMaterialStyle(levelMaterial);
      const instanced = new THREE.InstancedMesh(cardGeometry, levelMaterial, this.capacity);
      instanced.castShadow = false;
      instanced.receiveShadow = true;
      instanced.frustumCulled = this.frustumCulled;
      instanced.count = 0;
      this.scene.add(instanced);

      parts.push({
        instanced,
        localMatrix,
        count: 0,
        colorDirty: false
      });
    }

    return {
      ...levelDef,
      kind: 'impostor',
      parts
    };
  }

  setVisible(visible) {
    this.visible = visible;
    this.loadedLevels.forEach((level) => {
      level.parts.forEach((part) => {
        part.instanced.visible = visible;
      });
    });
  }

  beginFrame() {
    this.loadedLevels.forEach((level) => {
      level.parts.forEach((part) => {
        part.count = 0;
        part.colorDirty = false;
      });
    });
  }

  addInstance(worldMatrix, distanceMeters = 0, options = {}) {
    if (!this.ready || !this.visible) return;

    const level = this.#pickLevel(distanceMeters);
    if (!level) return;

    const tintColor = options.color || this._white;

    level.parts.forEach((part) => {
      const idx = part.count;
      if (idx >= this.capacity) return;

      this._m1.multiplyMatrices(worldMatrix, part.localMatrix);
      part.instanced.setMatrixAt(idx, this._m1);

      if (this.enableInstanceColor) {
        part.instanced.setColorAt(idx, tintColor);
        part.colorDirty = true;
      }

      part.count += 1;
    });
  }

  endFrame() {
    this.loadedLevels.forEach((level) => {
      level.parts.forEach((part) => {
        part.instanced.count = part.count;
        part.instanced.instanceMatrix.needsUpdate = true;
        if (part.colorDirty && part.instanced.instanceColor) {
          part.instanced.instanceColor.needsUpdate = true;
        }
      });
    });
  }

  #pickLevel(distanceMeters) {
    const absDistance = Math.abs(distanceMeters);
    for (const level of this.loadedLevels) {
      if (absDistance <= (level.maxDistance ?? Infinity)) {
        return level;
      }
    }
    return this.loadedLevels[this.loadedLevels.length - 1] || null;
  }

  destroy() {
    const disposedTextures = new Set();

    this.loadedLevels.forEach((level) => {
      level.parts.forEach((part) => {
        this.scene.remove(part.instanced);
        part.instanced.geometry?.dispose?.();

        if (Array.isArray(part.instanced.material)) {
          part.instanced.material.forEach((mat) => {
            if (mat?.map && !disposedTextures.has(mat.map)) {
              disposedTextures.add(mat.map);
              mat.map.dispose?.();
            }
            mat?.dispose?.();
          });
        } else {
          const mat = part.instanced.material;
          if (mat?.map && !disposedTextures.has(mat.map)) {
            disposedTextures.add(mat.map);
            mat.map.dispose?.();
          }
          mat?.dispose?.();
        }
      });
    });

    this._impostorAtlasCache.forEach((atlas) => {
      const tex = atlas?.texture;
      if (tex && !disposedTextures.has(tex)) {
        tex.dispose?.();
      }
    });
    this._impostorAtlasCache.clear();
    this._paletteMaterials.clear();

    this.loadedLevels = [];
    this.ready = false;
  }
}
