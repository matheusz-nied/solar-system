import * as THREE from 'three';

// Instanced asteroid belt: thousands of individual rocky objects orbiting in
// a torus around the sun. Each asteroid has its own rotation, size and orbital
// phase. Built from a low-poly irregular rock geometry generated once.

function makeRockGeometry(radius = 1) {
  const geo = new THREE.DodecahedronGeometry(radius, 0);
  // Push vertices around a bit so every instance can look slightly different
  // (we do per-instance scale/rotation; the base shape just needs to be lumpy).
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const len = Math.sqrt(x * x + y * y + z * z);
    const n = 0.7 + Math.random() * 0.6;
    pos.setXYZ(i, (x / len) * radius * n, (y / len) * radius * n, (z / len) * radius * n);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createBelt({
  count = 4000,
  innerRadius = 105,
  outerRadius = 130,
  thickness = 4,
  minSize = 0.15,
  maxSize = 0.9,
  color = 0x8a7f6a,
  roughness = 1.0,
  speed = 0.05,
  verticalBias = 1.0,
} = {}) {
  const baseGeo = makeRockGeometry(1);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.0,
    flatShading: true,
  });
  const mesh = new THREE.InstancedMesh(baseGeo, mat, count);
  mesh.name = 'belt';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;

  // Per-instance state
  const dummy = new THREE.Object3D();
  const data = new Float32Array(count * 6); // r, angle, y, speed, size, spin
  for (let i = 0; i < count; i++) {
    const r = innerRadius + Math.random() * (outerRadius - innerRadius);
    const a = Math.random() * Math.PI * 2;
    const y = (Math.random() - 0.5) * thickness * verticalBias;
    // Keplerian-ish: inner asteroids orbit slightly faster
    const spd = speed * Math.pow(innerRadius / r, 1.1);
    const size = minSize + Math.pow(Math.random(), 2.2) * (maxSize - minSize);
    const spin = (Math.random() - 0.5) * 2.0;
    data[i * 6] = r;
    data[i * 6 + 1] = a;
    data[i * 6 + 2] = y;
    data[i * 6 + 3] = spd;
    data[i * 6 + 4] = size;
    data[i * 6 + 5] = spin;

    dummy.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    dummy.scale.setScalar(size);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;

  mesh.userData.update = (dt, timeSpeed) => {
    for (let i = 0; i < count; i++) {
      const r = data[i * 6];
      let a = data[i * 6 + 1] + dt * data[i * 6 + 3] * timeSpeed;
      data[i * 6 + 1] = a;
      const y = data[i * 6 + 2];
      const size = data[i * 6 + 4];
      const spin = data[i * 6 + 5];
      dummy.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      dummy.rotation.set(
        spin * a * 0.5,
        spin * a,
        spin * a * 0.3,
      );
      dummy.scale.setScalar(size);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  return mesh;
}

export function createAsteroidBelt() {
  // Between Mars (~92) and Jupiter (~132)
  return createBelt({
    count: 4500,
    innerRadius: 104,
    outerRadius: 126,
    thickness: 5,
    minSize: 0.12,
    maxSize: 0.85,
    color: 0x9a8a74,
    speed: 0.07,
  });
}

export function createKuiperBelt() {
  // Beyond Neptune (~252)
  const mesh = createBelt({
    count: 3000,
    innerRadius: 285,
    outerRadius: 340,
    thickness: 12,
    minSize: 0.18,
    maxSize: 1.2,
    color: 0x9bb6d6,
    roughness: 0.85,
    speed: 0.025,
    verticalBias: 1.6,
  });
  mesh.name = 'kuiperBelt';
  return mesh;
}
