import * as THREE from 'three';

let softParticleTexture;

function getSoftParticleTexture() {
  if (softParticleTexture) return softParticleTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2
  );
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.22, 'rgba(255,255,255,0.82)');
  gradient.addColorStop(0.58, 'rgba(255,255,255,0.22)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  softParticleTexture = new THREE.CanvasTexture(canvas);
  softParticleTexture.colorSpace = THREE.SRGBColorSpace;
  return softParticleTexture;
}

// Spiral-galaxy design adapted from fable. Soft textured particles make the
// arms read as luminous dust instead of isolated square points.
export function createGalaxy({
  count = 9000,
  radius = 240,
  arms = 4,
  spin = 1.5,
  randomness = 0.22,
  colorInside = '#ffe1b5',
  colorOutside = '#6687ff',
  size = 5.2,
} = {}) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const inside = new THREE.Color(colorInside);
  const outside = new THREE.Color(colorOutside);
  const mixed = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const normalizedRadius = Math.pow(Math.random(), 1.7);
    const r = normalizedRadius * radius;
    const branchAngle = ((i % arms) / arms) * Math.PI * 2;
    const spinAngle = normalizedRadius * spin * Math.PI * 2;
    const spread = randomness * r;

    positions[i * 3] = Math.cos(branchAngle + spinAngle) * r
      + (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.26;
    positions[i * 3 + 2] = Math.sin(branchAngle + spinAngle) * r
      + (Math.random() - 0.5) * spread;

    mixed.copy(inside).lerp(outside, normalizedRadius);
    const luminosity = 0.55 + (1 - normalizedRadius) * 0.55;
    colors[i * 3] = mixed.r * luminosity;
    colors[i * 3 + 1] = mixed.g * luminosity;
    colors[i * 3 + 2] = mixed.b * luminosity;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    map: getSoftParticleTexture(),
    size,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.68,
    alphaTest: 0.015,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const galaxy = new THREE.Points(geometry, material);
  galaxy.frustumCulled = false;
  return galaxy;
}

export function createGalaxies(sceneRadius = 1800) {
  const group = new THREE.Group();
  group.name = 'galaxies';

  const setups = [
    {
      count: 9000, radius: 250, arms: 4, spin: 1.45,
      colorInside: '#ffe2b8', colorOutside: '#688aff', size: 5.4,
      position: [-0.52, -0.08, -0.92], rotation: [0.92, 0.28, 0.48], scale: 1,
    },
    {
      count: 6200, radius: 185, arms: 2, spin: 2.15,
      colorInside: '#ffc8e8', colorOutside: '#8258ff', size: 4.8,
      position: [0.66, -0.34, -0.88], rotation: [-0.58, 0.78, 0.22], scale: 0.9,
    },
    {
      count: 4800, radius: 145, arms: 3, spin: 1.75,
      colorInside: '#dcfff5', colorOutside: '#3cc8c2', size: 4.4,
      position: [0.10, 0.05, -0.96], rotation: [1.18, -0.42, 0.88], scale: 0.78,
    },
  ];

  const galaxies = setups.map((setup) => {
    const galaxy = createGalaxy(setup);
    galaxy.position.set(
      setup.position[0] * sceneRadius,
      setup.position[1] * sceneRadius,
      setup.position[2] * sceneRadius
    );
    galaxy.rotation.set(...setup.rotation);
    galaxy.scale.setScalar(setup.scale);
    group.add(galaxy);
    return galaxy;
  });

  group.userData.update = (_t, dt) => {
    galaxies.forEach((galaxy, index) => {
      galaxy.rotateOnAxis(
        galaxy.up,
        dt * 0.006 * (index % 2 === 0 ? 1 : -1)
      );
    });
  };
  return group;
}
