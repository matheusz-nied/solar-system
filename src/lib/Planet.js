import * as THREE from 'three';
import { createAtmosphere } from './Atmosphere';

const textureCache = new Map();

export function getTexture(path, manager) {
  if (textureCache.has(path)) return textureCache.get(path);
  const loader = new THREE.TextureLoader(manager);
  const tex = loader.load(path);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  textureCache.set(path, tex);
  return tex;
}

export function getLinearTexture(path, manager) {
  if (textureCache.has(`linear:${path}`)) return textureCache.get(`linear:${path}`);
  const loader = new THREE.TextureLoader(manager);
  const tex = loader.load(path);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 8;
  textureCache.set(`linear:${path}`, tex);
  return tex;
}

const TEXTURE_BASE = '/textures/';

function url(filename) {
  return TEXTURE_BASE + filename;
}

// Build a ring texture procedurally so we can carve out gaps (e.g. Cassini
// division) and tint rings without relying on a single image. The user's
// existing saturn_ring.png is still used as an alpha guide when provided.
function buildRingAlphaTexture(innerRadius, outerRadius, gaps = [], baseAlphaUrl = null, manager) {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');

  // Base random banding
  for (let x = 0; x < size; x++) {
    const t = x / size;
    // Many fine bands with a power bias toward the inner ring
    const band = 0.5 + 0.5 * Math.sin(t * 220) * Math.sin(t * 37);
    const envelope = Math.pow(1.0 - Math.abs(t - 0.4) * 1.4, 1.5);
    let a = 0.35 + band * 0.55;
    a *= 0.45 + envelope * 0.7;
    // Carve gaps
    for (const [gs, ge] of gaps) {
      if (t >= gs && t <= ge) a *= 0.05;
    }
    a = Math.max(0, Math.min(1, a));
    const v = 200 + Math.floor(band * 40);
    ctx.fillStyle = `rgba(${v},${v - 20},${v - 60},${a})`;
    ctx.fillRect(x, 0, 1, 16);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export class Planet {
  constructor(data, sun, manager) {
    this.data = data;
    this.sun = sun;
    this.manager = manager;
    this.orbitAngle = Math.random() * Math.PI * 2;

    this.root = new THREE.Group();
    this.root.name = data.id;

    this.orbit = new THREE.Group();
    this.orbit.name = `${data.id}-orbit`;
    this.tilt = new THREE.Group();
    this.tilt.name = `${data.id}-tilt`;

    const geo = new THREE.SphereGeometry(data.radius, 64, 64);
    const mat = new THREE.MeshStandardMaterial({
      map: getTexture(url(data.textures.color), manager),
      roughness: data.roughness ?? 0.8,
      metalness: data.metalness ?? 0.0,
    });
    // Optional color tint (used to recolor the shared moon texture for different moons)
    if (data.tint) {
      mat.color = new THREE.Color(data.tint);
      mat.blending = THREE.MultiplyBlending;
      mat.transparent = true;
    }
    if (data.textures.normal) {
      mat.normalMap = getLinearTexture(url(data.textures.normal), manager);
      mat.normalScale = new THREE.Vector2(0.8, 0.8);
    }
    if (data.textures.specular) {
      mat.roughnessMap = getLinearTexture(url(data.textures.specular), manager);
    }
    if (data.textures.lights) {
      mat.emissiveMap = getTexture(url(data.textures.lights), manager);
      mat.emissive = new THREE.Color(0xffaa55);
      mat.emissiveIntensity = 0.6;
    }

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.name = data.name;
    this.mesh.userData.planet = this;
    this.mesh.userData.id = data.id;
    this.tilt.add(this.mesh);

    if (data.atmosphere) {
      this.atmosphere = createAtmosphere(
        data.radius,
        data.atmosphere.scale,
        data.atmosphere.color,
        data.atmosphere.intensity
      );
      this.tilt.add(this.atmosphere);
    }

    this.clouds = null;
    if (data.textures.clouds) {
      const cloudGeo = new THREE.SphereGeometry(data.radius * 1.015, 64, 64);
      const cloudMat = new THREE.MeshStandardMaterial({
        map: getTexture(url(data.textures.clouds), manager),
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });
      this.clouds = new THREE.Mesh(cloudGeo, cloudMat);
      this.clouds.castShadow = true;
      this.clouds.receiveShadow = true;
      this.tilt.add(this.clouds);
    }

    this.ringMesh = null;
    if (data.ring) {
      const { innerRadius, outerRadius, segments, gaps, opacity, color } = data.ring;
      const ringGeo = new THREE.RingGeometry(
        Math.max(0.01, innerRadius),
        Math.max(0.02, outerRadius),
        segments,
        4
      );
      // Remap UVs so u goes radially across the ring (0 = inner, 1 = outer)
      const uv = ringGeo.attributes.uv;
      const pos = ringGeo.attributes.position;
      for (let i = 0; i < uv.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const r = Math.sqrt(x * x + y * y);
        const t = (r - innerRadius) / (outerRadius - innerRadius);
        const theta = Math.atan2(y, x);
        const v = (theta + Math.PI) / (2 * Math.PI);
        uv.setXY(i, t, v);
      }
      const ringMat = new THREE.MeshStandardMaterial({
        map: buildRingAlphaTexture(innerRadius, outerRadius, gaps || [], data.textures.ring, manager),
        side: THREE.DoubleSide,
        transparent: true,
        roughness: 0.9,
        metalness: 0.0,
        depthWrite: false,
        opacity: opacity ?? 1.0,
      });
      if (color) {
        ringMat.color = new THREE.Color(color);
        ringMat.blending = THREE.MultiplyBlending;
      }
      this.ringMesh = new THREE.Mesh(ringGeo, ringMat);
      this.ringMesh.rotation.x = Math.PI / 2;
      this.ringMesh.castShadow = true;
      this.ringMesh.receiveShadow = true;
      this.ringMesh.userData.planet = this;
      this.ringMesh.userData.id = data.id;
      this.tilt.add(this.ringMesh);
    }

    this.tilt.rotation.z = data.axialTilt ?? 0;
    this.tilt.position.set(data.distance, 0, 0);
    this.orbit.add(this.tilt);
    this.root.add(this.orbit);

    this.moons = [];
    if (data.moons) {
      for (const moonData of data.moons) {
        const moon = new Moon(moonData, manager);
        moon.mesh.userData.planet = this;
        moon.mesh.userData.isMoon = true;
        moon.mesh.userData.moonName = moonData.name;
        this.moons.push(moon);
        this.tilt.add(moon.root);
      }
    }

    this.update(0, 1);
  }

  update(delta, speed) {
    this.orbitAngle += delta * this.data.orbitSpeed * speed;
    this.orbit.rotation.y = this.orbitAngle;
    this.mesh.rotation.y += delta * this.data.rotationSpeed * speed;
    if (this.clouds) {
      this.clouds.rotation.y += delta * this.data.rotationSpeed * speed * 1.3;
    }
    // Update atmosphere light direction (sun is at world origin)
    if (this.atmosphere && this.atmosphere.userData.update) {
      _worldPos.set(0, 0, 0);
      this.tilt.getWorldPosition(_worldPos);
      _lightDir.copy(_worldPos).negate().normalize();
      this.atmosphere.userData.update(_lightDir);
    }
    for (const moon of this.moons) {
      moon.update(delta, speed);
    }
  }

  getWorldPosition(out = new THREE.Vector3()) {
    this.tilt.getWorldPosition(out);
    return out;
  }

  getLabelPosition(out = new THREE.Vector3()) {
    out.set(0, this.data.radius + 1.5, 0);
    this.tilt.localToWorld(out);
    return out;
  }
}

const _worldPos = new THREE.Vector3();
const _lightDir = new THREE.Vector3();

class Moon {
  constructor(data, manager) {
    this.data = data;
    this.angle = Math.random() * Math.PI * 2;
    this.root = new THREE.Group();
    this.root.name = data.id;

    const geo = new THREE.SphereGeometry(data.radius, 32, 32);
    const mat = new THREE.MeshStandardMaterial({
      map: getTexture(url(data.textures.color), manager),
      roughness: 0.9,
      metalness: 0.0,
    });
    if (data.tint) {
      mat.color = new THREE.Color(data.tint);
      mat.blending = THREE.MultiplyBlending;
      mat.transparent = true;
    }
    if (data.emissive) {
      mat.emissive = new THREE.Color(data.emissive);
      mat.emissiveIntensity = 0.5;
    }
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.name = data.name;
    this.root.add(this.mesh);

    if (data.atmosphere) {
      this.atmosphere = createAtmosphere(
        data.radius,
        data.atmosphere.scale,
        data.atmosphere.color,
        data.atmosphere.intensity
      );
      this.root.add(this.atmosphere);
    }

    this.update(0, 1);
  }

  update(delta, speed) {
    this.angle += delta * this.data.orbitSpeed * speed;
    this.root.position.set(
      Math.cos(this.angle) * this.data.orbitDistance,
      Math.sin(this.angle * 0.3) * 0.5,
      Math.sin(this.angle) * this.data.orbitDistance
    );
    this.mesh.rotation.y += delta * this.data.rotationSpeed * speed;
    if (this.atmosphere && this.atmosphere.userData.update) {
      _mWorld.set(0, 0, 0);
      this.root.getWorldPosition(_mWorld);
      _mLight.copy(_mWorld).negate().normalize();
      this.atmosphere.userData.update(_mLight);
    }
  }
}

const _mWorld = new THREE.Vector3();
const _mLight = new THREE.Vector3();
