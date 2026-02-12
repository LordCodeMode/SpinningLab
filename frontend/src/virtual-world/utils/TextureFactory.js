/**
 * TextureFactory - Procedural texture generation for the virtual world
 */

import * as THREE from 'three';

export class TextureFactory {
  constructor() {
    this.cache = new Map();
    this.maxAnisotropy = 1;
    this.textureLoader = new THREE.TextureLoader();
    this.useExternalRealismPack = true;
    this.externalRealismBasePath = '/textures/environment/polyhaven';
    this.externalRealismAttempted = false;
  }

  configure(renderer) {
    if (!renderer?.capabilities) return;
    this.maxAnisotropy = Math.max(1, renderer.capabilities.getMaxAnisotropy?.() || 1);
    this.cache.forEach((texture) => {
      texture.anisotropy = this.maxAnisotropy;
      texture.needsUpdate = true;
    });
  }

  getTextures() {
    if (this.cache.size === 0) {
      this.cache.set('grass', this.createGrassTexture());
      this.cache.set('grassNormal', this.createGrassNormalTexture());
      this.cache.set('grassRoughness', this.createGrassRoughnessTexture());
      this.cache.set('grassAo', this.createGrassRoughnessTexture());
      this.cache.set('road', this.createRoadTexture());
      this.cache.set('roadNormal', this.createRoadNormalTexture());
      this.cache.set('roadRoughness', this.createRoadRoughnessTexture());
      this.cache.set('roadAo', this.createRoadRoughnessTexture());
      this.cache.set('dirt', this.createDirtTexture());
      this.cache.set('dirtNormal', this.createDirtNormalTexture());
      this.cache.set('dirtRoughness', this.createDirtRoughnessTexture());
      this.cache.set('dirtAo', this.createDirtRoughnessTexture());
      this.cache.set('rock', this.createRockTexture());
      this.cache.set('rockNormal', this.createRockNormalTexture());
      this.cache.set('rockRoughness', this.createRockRoughnessTexture());
      this.cache.set('rockAo', this.createRockRoughnessTexture());
      this.cache.set('gravel', this.createGravelTexture());
      this.cache.set('gravelNormal', this.createGravelNormalTexture());
      this.cache.set('gravelRoughness', this.createGravelRoughnessTexture());
      this.cache.set('gravelAo', this.createGravelRoughnessTexture());
      this.cache.set('blendNoise', this.createBlendNoiseTexture());
      this.cache.set('biomeMask', this.createBiomeMaskTexture());

      if (this.useExternalRealismPack) {
        this.applyExternalRealismPack();
      }
    }
    return {
      grass: this.cache.get('grass'),
      grassNormal: this.cache.get('grassNormal'),
      grassRoughness: this.cache.get('grassRoughness'),
      grassAo: this.cache.get('grassAo'),
      road: this.cache.get('road'),
      roadNormal: this.cache.get('roadNormal'),
      roadRoughness: this.cache.get('roadRoughness'),
      roadAo: this.cache.get('roadAo'),
      dirt: this.cache.get('dirt'),
      dirtNormal: this.cache.get('dirtNormal'),
      dirtRoughness: this.cache.get('dirtRoughness'),
      dirtAo: this.cache.get('dirtAo'),
      rock: this.cache.get('rock'),
      rockNormal: this.cache.get('rockNormal'),
      rockRoughness: this.cache.get('rockRoughness'),
      rockAo: this.cache.get('rockAo'),
      gravel: this.cache.get('gravel'),
      gravelNormal: this.cache.get('gravelNormal'),
      gravelRoughness: this.cache.get('gravelRoughness'),
      gravelAo: this.cache.get('gravelAo'),
      blendNoise: this.cache.get('blendNoise'),
      biomeMask: this.cache.get('biomeMask')
    };
  }

  applyExternalRealismPack() {
    if (this.externalRealismAttempted) return;
    this.externalRealismAttempted = true;

    const textureBindings = [
      { key: 'road', file: 'road_albedo.jpg', colorSpace: 'srgb', repeat: [1, 20] },
      { key: 'roadNormal', file: 'road_normal.jpg', colorSpace: 'linear', repeat: [1, 20] },
      { key: 'roadRoughness', file: 'road_roughness.jpg', colorSpace: 'linear', repeat: [1, 20] },
      { key: 'roadAo', file: 'road_ao.jpg', colorSpace: 'linear', repeat: [1, 20] },

      { key: 'grass', file: 'grass_albedo.jpg', colorSpace: 'srgb', repeat: [7, 7] },
      { key: 'grassNormal', file: 'grass_normal.jpg', colorSpace: 'linear', repeat: [7, 7] },
      { key: 'grassRoughness', file: 'grass_roughness.jpg', colorSpace: 'linear', repeat: [7, 7] },
      { key: 'grassAo', file: 'grass_ao.jpg', colorSpace: 'linear', repeat: [7, 7] },

      { key: 'dirt', file: 'dirt_albedo.jpg', colorSpace: 'srgb', repeat: [4, 4] },
      { key: 'dirtNormal', file: 'dirt_normal.jpg', colorSpace: 'linear', repeat: [4, 4] },
      { key: 'dirtRoughness', file: 'dirt_roughness.jpg', colorSpace: 'linear', repeat: [4, 4] },
      { key: 'dirtAo', file: 'dirt_ao.jpg', colorSpace: 'linear', repeat: [4, 4] },

      { key: 'rock', file: 'rock_albedo.jpg', colorSpace: 'srgb', repeat: [3, 3] },
      { key: 'rockNormal', file: 'rock_normal.jpg', colorSpace: 'linear', repeat: [3, 3] },
      { key: 'rockRoughness', file: 'rock_roughness.jpg', colorSpace: 'linear', repeat: [3, 3] },
      { key: 'rockAo', file: 'rock_ao.jpg', colorSpace: 'linear', repeat: [3, 3] },

      { key: 'gravel', file: 'gravel_albedo.jpg', colorSpace: 'srgb', repeat: [6, 6] },
      { key: 'gravelNormal', file: 'gravel_normal.jpg', colorSpace: 'linear', repeat: [6, 6] },
      { key: 'gravelRoughness', file: 'gravel_roughness.jpg', colorSpace: 'linear', repeat: [6, 6] },
      { key: 'gravelAo', file: 'gravel_ao.jpg', colorSpace: 'linear', repeat: [6, 6] }
    ];

    textureBindings.forEach((binding) => {
      const texture = this.cache.get(binding.key);
      if (!texture) return;
      this.upgradeTextureFromFile(texture, `${this.externalRealismBasePath}/${binding.file}`, binding);
    });
  }

  upgradeTextureFromFile(targetTexture, filePath, options = {}) {
    const { repeat = [1, 1], colorSpace = 'srgb' } = options;

    this.textureLoader.load(
      filePath,
      (loadedTexture) => {
        targetTexture.image = loadedTexture.image;
        targetTexture.wrapS = THREE.RepeatWrapping;
        targetTexture.wrapT = THREE.RepeatWrapping;
        targetTexture.repeat.set(repeat[0], repeat[1]);
        targetTexture.anisotropy = this.maxAnisotropy;
        targetTexture.colorSpace = colorSpace === 'linear'
          ? THREE.NoColorSpace
          : THREE.SRGBColorSpace;
        targetTexture.needsUpdate = true;
        loadedTexture.dispose?.();
      },
      undefined,
      () => {
        // Keep procedural fallback when optional external textures are missing.
      }
    );
  }

  createGrassTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // VIVID GREEN base - no blue at all
    ctx.fillStyle = '#2d8a2d';
    ctx.fillRect(0, 0, size, size);

    // Add noise - ONLY green/yellow hues (90-130)
    for (let i = 0; i < 8000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const brightness = 25 + Math.random() * 30;
      const hue = 95 + Math.random() * 35; // Pure green-yellow hues ONLY
      ctx.fillStyle = `hsla(${hue}, 70%, ${brightness}%, 0.4)`;
      ctx.fillRect(x, y, 1 + Math.random() * 2, 2 + Math.random() * 4);
    }

    // Grass blades - saturated greens
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const length = 3 + Math.random() * 8;
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.4;

      ctx.strokeStyle = `hsla(${100 + Math.random() * 25}, 65%, ${28 + Math.random() * 18}%, 0.5)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.repeat.set(8, 8);
    return this.applyTextureSettings(texture, { colorSpace: 'srgb' });
  }

  createGrassNormalTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgb(128, 185, 128)';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const nx = 120 + Math.random() * 16;
      const ny = 170 + Math.random() * 35;
      const nz = 125 + Math.random() * 16;
      ctx.fillStyle = `rgba(${nx}, ${ny}, ${nz}, ${0.18 + Math.random() * 0.22})`;
      ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }

    return this.applyTextureSettings(new THREE.CanvasTexture(canvas), { colorSpace: 'linear' });
  }

  createGrassRoughnessTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgb(210, 210, 210)';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 6500; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const shade = 165 + Math.random() * 55;
      ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${0.2 + Math.random() * 0.25})`;
      ctx.fillRect(x, y, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }

    return this.applyTextureSettings(new THREE.CanvasTexture(canvas), { colorSpace: 'linear' });
  }

  createRoadTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Dark asphalt base
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, size, size);

    // Add gravel/aggregate noise
    for (let i = 0; i < 15000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const grey = 20 + Math.random() * 40;
      ctx.fillStyle = `rgb(${grey}, ${grey}, ${grey})`;
      ctx.fillRect(x, y, 1 + Math.random(), 1 + Math.random());
    }

    // Add subtle cracks
    for (let i = 0; i < 20; i++) {
      let x = Math.random() * size;
      let y = Math.random() * size;
      ctx.strokeStyle = `rgba(15, 15, 15, ${0.3 + Math.random() * 0.3})`;
      ctx.lineWidth = 0.5 + Math.random();
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let j = 0; j < 10; j++) {
        x += (Math.random() - 0.5) * 30;
        y += Math.random() * 20;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Add tire marks
    for (let i = 0; i < 5; i++) {
      const x = size * 0.3 + Math.random() * size * 0.4;
      ctx.strokeStyle = `rgba(20, 20, 20, ${0.1 + Math.random() * 0.15})`;
      ctx.lineWidth = 8 + Math.random() * 15;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (Math.random() - 0.5) * 20, size);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.repeat.set(1, 20);
    return this.applyTextureSettings(texture, { colorSpace: 'srgb' });
  }

  createRoadNormalTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgb(128, 128, 255)';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 15000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const tiltX = 118 + Math.random() * 20;
      const tiltY = 118 + Math.random() * 20;
      const tiltZ = 240 + Math.random() * 15;
      ctx.fillStyle = `rgba(${tiltX}, ${tiltY}, ${tiltZ}, ${0.08 + Math.random() * 0.14})`;
      ctx.fillRect(x, y, 1 + Math.random() * 1.4, 1 + Math.random() * 1.4);
    }

    // Add subtle linear groove direction along road flow.
    ctx.strokeStyle = 'rgba(128, 142, 245, 0.18)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const x = (size / 14) * i + (Math.random() - 0.5) * 8;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (Math.random() - 0.5) * 12, size);
      ctx.stroke();
    }

    return this.applyTextureSettings(new THREE.CanvasTexture(canvas), { colorSpace: 'linear' });
  }

  createRoadRoughnessTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgb(188, 188, 188)';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 12000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const shade = 145 + Math.random() * 70;
      ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${0.08 + Math.random() * 0.2})`;
      ctx.fillRect(x, y, 1 + Math.random() * 2.2, 1 + Math.random() * 2.2);
    }

    // Center of lane is slightly smoother due to wear.
    const laneGrad = ctx.createLinearGradient(size * 0.5, 0, size * 0.5, size);
    laneGrad.addColorStop(0, 'rgba(130,130,130,0.18)');
    laneGrad.addColorStop(1, 'rgba(130,130,130,0.18)');
    ctx.fillStyle = laneGrad;
    ctx.fillRect(size * 0.36, 0, size * 0.28, size);

    return this.applyTextureSettings(new THREE.CanvasTexture(canvas), { colorSpace: 'linear' });
  }

  createDirtTexture(size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Brown dirt base
    ctx.fillStyle = '#8b7355';
    ctx.fillRect(0, 0, size, size);

    // Add pebbles and variation
    for (let i = 0; i < 5000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const hue = 25 + Math.random() * 20;
      const light = 30 + Math.random() * 25;
      ctx.fillStyle = `hsla(${hue}, 40%, ${light}%, 0.5)`;
      const pebbleSize = 1 + Math.random() * 3;
      ctx.beginPath();
      ctx.ellipse(x, y, pebbleSize, pebbleSize * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.repeat.set(4, 4);
    return this.applyTextureSettings(texture, { colorSpace: 'srgb' });
  }

  createDirtNormalTexture(size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgb(130, 120, 250)';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 4500; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const nx = 115 + Math.random() * 30;
      const ny = 110 + Math.random() * 30;
      const nz = 230 + Math.random() * 25;
      ctx.fillStyle = `rgba(${nx}, ${ny}, ${nz}, ${0.14 + Math.random() * 0.26})`;
      ctx.fillRect(x, y, 1 + Math.random() * 2.5, 1 + Math.random() * 2.5);
    }

    return this.applyTextureSettings(new THREE.CanvasTexture(canvas), { colorSpace: 'linear' });
  }

  createDirtRoughnessTexture(size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgb(205, 205, 205)';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 5000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const shade = 155 + Math.random() * 65;
      ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${0.15 + Math.random() * 0.22})`;
      ctx.fillRect(x, y, 1 + Math.random() * 2.4, 1 + Math.random() * 2.4);
    }

    return this.applyTextureSettings(new THREE.CanvasTexture(canvas), { colorSpace: 'linear' });
  }

  createRockTexture(size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#6d726e';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 7000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const grey = 80 + Math.random() * 120;
      ctx.fillStyle = `rgba(${grey}, ${grey}, ${grey}, ${0.12 + Math.random() * 0.22})`;
      ctx.fillRect(x, y, 1 + Math.random() * 2.6, 1 + Math.random() * 2.6);
    }

    return this.applyTextureSettings(new THREE.CanvasTexture(canvas), { colorSpace: 'srgb' });
  }

  createRockNormalTexture(size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgb(128, 128, 255)';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 6000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const nx = 110 + Math.random() * 35;
      const ny = 110 + Math.random() * 35;
      const nz = 220 + Math.random() * 35;
      ctx.fillStyle = `rgba(${nx}, ${ny}, ${nz}, ${0.16 + Math.random() * 0.22})`;
      ctx.fillRect(x, y, 1 + Math.random() * 2.1, 1 + Math.random() * 2.1);
    }

    return this.applyTextureSettings(new THREE.CanvasTexture(canvas), { colorSpace: 'linear' });
  }

  createRockRoughnessTexture(size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgb(196, 196, 196)';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 5200; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const shade = 150 + Math.random() * 70;
      ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${0.12 + Math.random() * 0.25})`;
      ctx.fillRect(x, y, 1 + Math.random() * 2.3, 1 + Math.random() * 2.3);
    }

    return this.applyTextureSettings(new THREE.CanvasTexture(canvas), { colorSpace: 'linear' });
  }

  createGravelTexture(size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#7b725f';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 8000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const hue = 24 + Math.random() * 18;
      const sat = 8 + Math.random() * 18;
      const light = 28 + Math.random() * 28;
      const pebble = 0.8 + Math.random() * 2.2;
      ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${0.28 + Math.random() * 0.38})`;
      ctx.beginPath();
      ctx.ellipse(x, y, pebble, pebble * (0.55 + Math.random() * 0.5), Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.repeat.set(6, 6);
    return this.applyTextureSettings(texture, { colorSpace: 'srgb' });
  }

  createGravelNormalTexture(size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgb(128, 128, 245)';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 7000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const nx = 112 + Math.random() * 32;
      const ny = 112 + Math.random() * 32;
      const nz = 224 + Math.random() * 28;
      ctx.fillStyle = `rgba(${nx}, ${ny}, ${nz}, ${0.14 + Math.random() * 0.24})`;
      ctx.fillRect(x, y, 1 + Math.random() * 2.2, 1 + Math.random() * 2.2);
    }

    return this.applyTextureSettings(new THREE.CanvasTexture(canvas), { colorSpace: 'linear' });
  }

  createGravelRoughnessTexture(size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgb(202, 202, 202)';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 6200; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const shade = 148 + Math.random() * 76;
      ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${0.12 + Math.random() * 0.26})`;
      ctx.fillRect(x, y, 1 + Math.random() * 2.2, 1 + Math.random() * 2.2);
    }

    return this.applyTextureSettings(new THREE.CanvasTexture(canvas), { colorSpace: 'linear' });
  }

  createBlendNoiseTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const image = ctx.createImageData(size, size);
    const data = image.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const noise =
          (Math.sin(x * 0.045) + Math.cos(y * 0.04)) * 0.18 +
          Math.sin((x + y) * 0.02) * 0.24 +
          Math.random() * 0.58;
        const shade = Math.max(0, Math.min(255, Math.floor(noise * 255)));
        data[i] = shade;
        data[i + 1] = shade;
        data[i + 2] = shade;
        data[i + 3] = 255;
      }
    }

    ctx.putImageData(image, 0, 0);
    return this.applyTextureSettings(new THREE.CanvasTexture(canvas), { colorSpace: 'linear' });
  }

  createBiomeMaskTexture(size = 1024) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const image = ctx.createImageData(size, size);
    const data = image.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const nx = (x / size) - 0.5;
        const ny = (y / size) - 0.5;

        // R: moisture field
        let moisture =
          0.5 +
          Math.sin((x * 0.009) + (y * 0.004)) * 0.24 +
          Math.cos((y * 0.011) - (x * 0.003)) * 0.19 +
          Math.sin((x + y) * 0.006) * 0.1;
        moisture += (1 - Math.min(1, Math.abs(nx) * 1.4)) * 0.08;

        // G: drainage / dirt tendency
        let drainage =
          0.5 +
          Math.sin((x * 0.013) - (y * 0.006)) * 0.21 +
          Math.cos((x * 0.004) + (y * 0.015)) * 0.18;
        drainage += Math.abs(nx) * 0.14;

        // B: scree/rock tendency
        let scree =
          0.45 +
          Math.cos((x * 0.018) + (y * 0.014)) * 0.2 +
          Math.sin((x * 0.005) - (y * 0.019)) * 0.17;
        scree += Math.max(0, (Math.abs(ny) - 0.22)) * 0.2;

        moisture = Math.max(0, Math.min(1, moisture));
        drainage = Math.max(0, Math.min(1, drainage));
        scree = Math.max(0, Math.min(1, scree));

        data[i] = Math.floor(moisture * 255);
        data[i + 1] = Math.floor(drainage * 255);
        data[i + 2] = Math.floor(scree * 255);
        data[i + 3] = 255;
      }
    }

    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.repeat.set(5, 5);
    return this.applyTextureSettings(texture, { colorSpace: 'linear' });
  }

  createSunGlareTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Radial gradient for sun glow
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(255, 255, 200, 1)');
    gradient.addColorStop(0.2, 'rgba(255, 240, 180, 0.6)');
    gradient.addColorStop(0.5, 'rgba(255, 220, 150, 0.2)');
    gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);

    return this.applyTextureSettings(new THREE.CanvasTexture(canvas), { colorSpace: 'srgb' });
  }

  applyTextureSettings(texture, options = {}) {
    if (!texture) return texture;
    const { colorSpace = 'srgb' } = options;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = this.maxAnisotropy;
    texture.colorSpace = colorSpace === 'linear'
      ? THREE.NoColorSpace
      : THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  destroy() {
    this.cache.forEach(texture => texture.dispose());
    this.cache.clear();
  }
}
