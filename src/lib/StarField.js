import * as THREE from 'three';

// Multi-layer starfield built entirely from point objects (no background texture).
// - Distant faint dust (tiny points)
// - Mid-field stars with twinkle and subtle color
// - Bright nearby stars with procedural diffraction spikes and glow halo
//
// Everything is rendered as additive point clouds so the background stays a
// pure black void while the stars themselves are real, individual objects.

const STAR_PALETTE = [
  new THREE.Color(0xffffff), // white  (A-type)
  new THREE.Color(0xc8d4ff), // blue   (O/B-type)
  new THREE.Color(0xfff4e8), // warm white (F-type)
  new THREE.Color(0xffe2a8), // yellow (G-type, like the Sun)
  new THREE.Color(0xffb27a), // orange (K-type)
  new THREE.Color(0xff8a6a), // red    (M-type)
];

function pickStarColor() {
  const c = STAR_PALETTE[Math.floor(Math.random() * STAR_PALETTE.length)];
  return c.clone().multiplyScalar(0.55 + Math.random() * 0.45);
}

function buildDustLayer({ count, radius }) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const seeds = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = radius * (0.9 + Math.random() * 0.15);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    const c = pickStarColor().multiplyScalar(0.35 + Math.random() * 0.4);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;

    sizes[i] = 0.6 + Math.random() * 0.8;
    seeds[i] = Math.random() * 1000;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: window.devicePixelRatio || 1 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aSeed;
      attribute vec3 color;
      varying vec3 vColor;
      varying float vTwinkle;
      uniform float uPixelRatio;
      uniform float uTime;
      void main() {
        vColor = color;
        float tw = 0.65 + 0.35 * sin(uTime * 1.8 + aSeed * 6.2831);
        vTwinkle = tw;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * (300.0 / -mv.z) * tw;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        vec2 c = gl_PointCoord - vec2(0.5);
        float d = length(c);
        if (d > 0.5) discard;
        float core = smoothstep(0.5, 0.0, d);
        float halo = smoothstep(0.5, 0.18, d) * 0.4;
        float a = clamp(core + halo, 0.0, 1.0) * vTwinkle;
        gl_FragColor = vec4(vColor, a);
      }
    `,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

function buildBrightLayer({ count, radius }) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const seeds = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = radius * (0.8 + Math.random() * 0.4);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    const c = pickStarColor();
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;

    // A small fraction are very bright "named" stars with spikes
    const roll = Math.random();
    sizes[i] = roll < 0.04 ? 6.0 + Math.random() * 3.0
      : roll < 0.18 ? 3.0 + Math.random() * 1.5
      : 1.4 + Math.random() * 1.0;
    seeds[i] = Math.random() * 1000;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: window.devicePixelRatio || 1 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aSeed;
      attribute vec3 color;
      varying vec3 vColor;
      varying float vTwinkle;
      varying float vSpike;
      uniform float uPixelRatio;
      uniform float uTime;
      void main() {
        vColor = color;
        float tw = 0.7 + 0.3 * sin(uTime * 2.4 + aSeed * 6.2831);
        vTwinkle = tw;
        vSpike = step(4.5, aSize);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * (300.0 / -mv.z) * (0.9 + 0.2 * tw);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vTwinkle;
      varying float vSpike;
      void main() {
        vec2 c = gl_PointCoord - vec2(0.5);
        float d = length(c);
        if (d > 0.5) discard;

        // Soft core + halo
        float core = smoothstep(0.5, 0.0, d);
        float halo = smoothstep(0.5, 0.22, d) * 0.55;

        // Cross-shaped diffraction spikes for bright stars
        float spike = 0.0;
        if (vSpike > 0.5) {
          float ax = abs(c.x);
          float ay = abs(c.y);
          float sH = smoothstep(0.5, 0.0, ay) * smoothstep(0.5, 0.0, ax * 6.0);
          float sV = smoothstep(0.5, 0.0, ax) * smoothstep(0.5, 0.0, ay * 6.0);
          spike = (sH + sV) * 0.7;
        }

        float a = clamp(core + halo + spike, 0.0, 1.0) * vTwinkle;
        gl_FragColor = vec4(vColor * (0.8 + 0.5 * core), a);
      }
    `,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

export function createStarField({ count = 5000, radius = 1800 } = {}) {
  const group = new THREE.Group();
  group.name = 'starField';

  const dust = buildDustLayer({ count: Math.floor(count * 0.6), radius: radius * 1.05 });
  dust.name = 'starField-dust';
  group.add(dust);

  const bright = buildBrightLayer({ count: Math.floor(count * 0.4), radius });
  bright.name = 'starField-bright';
  group.add(bright);

  group.userData.update = (t) => {
    dust.material.uniforms.uTime.value = t;
    bright.material.uniforms.uTime.value = t;
  };

  return group;
}
