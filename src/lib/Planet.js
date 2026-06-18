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
      this.clouds.castShadow = false;
      this.clouds.receiveShadow = false;
      this.tilt.add(this.clouds);
    }

    this.ringMesh = null;
    if (data.ring) {
      const { innerRadius, outerRadius, segments } = data.ring;
      const ringGeo = new THREE.RingGeometry(
        innerRadius,
        outerRadius,
        segments,
        4
      );
      const ringMat = new THREE.MeshStandardMaterial({
        map: getTexture(url(data.textures.ring), manager),
        alphaMap: getLinearTexture(url(data.textures.ring), manager),
        side: THREE.DoubleSide,
        transparent: true,
        roughness: 0.9,
        metalness: 0.0,
        depthWrite: false,
      });
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
      this.ringMesh = new THREE.Mesh(ringGeo, ringMat);
      this.ringMesh.rotation.x = Math.PI / 2;
      this.ringMesh.receiveShadow = true;
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
    for (const moon of this.moons) {
      moon.update(delta, speed);
    }
  }

  getLabelPosition(out = new THREE.Vector3()) {
    out.set(0, 0, 0);
    this.tilt.localToWorld(out);
    return out;
  }
}

class Moon {
  constructor(data, manager) {
    this.data = data;
    this.angle = 0;
    this.root = new THREE.Group();
    this.root.name = data.id;

    const geo = new THREE.SphereGeometry(data.radius, 32, 32);
    const mat = new THREE.MeshStandardMaterial({
      map: getTexture(url(data.textures.color), manager),
      roughness: 0.9,
      metalness: 0.0,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.root.add(this.mesh);
    this.root.position.set(data.orbitDistance, 0, 0);
    this.update(0, 1);
  }

  update(delta, speed) {
    this.angle += delta * this.data.orbitSpeed * speed;
    this.root.position.set(
      Math.cos(this.angle) * this.data.orbitDistance,
      0,
      Math.sin(this.angle) * this.data.orbitDistance
    );
    this.mesh.rotation.y += delta * this.data.rotationSpeed * speed;
  }
}
