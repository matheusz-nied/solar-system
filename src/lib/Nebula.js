import * as THREE from 'three';

// Procedural nebula built from soft additive sprites (no textures).
// We use a small generated canvas sprite as a soft round puff, then scatter
// thousands of them across a volume with per-particle color and size variation
// to create ethereal coloured clouds. Cheap to render and looks volumetric.

function makePuffTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0.0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let sharedPuff = null;
function getPuffTexture() {
  if (!sharedPuff) sharedPuff = makePuffTexture();
  return sharedPuff;
}

export function createNebula({
  count = 1800,
  radius = 220,
  palette = [0x3a6bff, 0x9a4dff, 0xff4d8a],
  density = 1.0,
  seed = 1,
} = {}) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const seeds = new Float32Array(count);

  const cols = palette.map((c) => new THREE.Color(c));

  let s = seed * 9301 + 49297;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  for (let i = 0; i < count; i++) {
    // Cluster particles into a few lobes for an organic shape
    const lobeCount = 3;
    const lobe = Math.floor(rand() * lobeCount);
    const lobeAngle = (lobe / lobeCount) * Math.PI * 2 + rand() * 0.6;
    const lobeCenter = new THREE.Vector3(
      Math.cos(lobeAngle) * radius * 0.25,
      (rand() - 0.5) * radius * 0.4,
      Math.sin(lobeAngle) * radius * 0.25,
    );

    const r = Math.pow(rand(), 1.8) * radius;
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const p = new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta) * 0.5,
      r * Math.cos(phi),
    ).add(lobeCenter);

    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;

    // Color: blend between palette entries, darkened at the edges
    const mix = rand();
    const c = cols[Math.floor(mix * cols.length) % cols.length].clone();
    c.lerp(cols[(Math.floor(mix * cols.length) + 1) % cols.length], rand());
    const brightness = 0.35 + 0.65 * (1.0 - r / radius);
    colors[i * 3] = c.r * brightness;
    colors[i * 3 + 1] = c.g * brightness;
    colors[i * 3 + 2] = c.b * brightness;

    sizes[i] = (40 + rand() * 90) * density;
    seeds[i] = rand() * 1000;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: getPuffTexture() },
      uPixelRatio: { value: window.devicePixelRatio || 1 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aSeed;
      attribute vec3 color;
      varying vec3 vColor;
      uniform float uPixelRatio;
      uniform float uTime;
      void main() {
        vColor = color;
        // Slow drift / breathing
        float drift = sin(uTime * 0.15 + aSeed * 6.28) * 4.0;
        vec3 pos = position;
        pos.y += drift;
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = aSize * uPixelRatio * (300.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      varying vec3 vColor;
      void main() {
        vec4 t = texture2D(uMap, gl_PointCoord);
        if (t.a <= 0.01) discard;
        gl_FragColor = vec4(vColor, t.a * 0.18);
      }
    `,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.userData.update = (t) => {
    mat.uniforms.uTime.value = t;
  };
  return points;
}

// A few nebulae scattered far away to give depth to the cosmos.
export function createNebulae(sceneRadius = 1700) {
  const group = new THREE.Group();
  group.name = 'nebulae';

  const setups = [
    { pos: [sceneRadius * 0.7, -sceneRadius * 0.1, sceneRadius * 0.7],
      radius: 280, palette: [0x2a5cff, 0x6a3aff, 0xff3a8a], count: 2200, seed: 1 },
    { pos: [-sceneRadius * 0.75, sceneRadius * 0.05, -sceneRadius * 0.5],
      radius: 240, palette: [0x00d4ff, 0x6affc0, 0xb06aff], count: 1600, seed: 2 },
    { pos: [-sceneRadius * 0.2, sceneRadius * 0.45, sceneRadius * 0.85],
      radius: 200, palette: [0xff7a3a, 0xffc83a, 0xff3a6a], count: 1400, seed: 3 },
  ];

  const updaters = [];
  for (const cfg of setups) {
    const n = createNebula(cfg);
    n.position.set(...cfg.pos);
    group.add(n);
    updaters.push(n.userData.update);
  }

  group.userData.update = (t) => {
    for (const u of updaters) u(t);
  };
  return group;
}
