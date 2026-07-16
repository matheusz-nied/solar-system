import * as THREE from 'three';

// Adapted from the visual direction used on the fable branch: one deep shell
// of individually coloured stars, with varied apparent size and a slow,
// asynchronous twinkle. The values are calibrated for this branch's smaller
// scene radius and camera far plane.
const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    vColor = aColor;
    float speed = 0.45 + aPhase * 0.75;
    vTwinkle = 0.72 + 0.28 * sin(uTime * speed + aPhase * 40.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(aSize * uPixelRatio * (760.0 / -mv.z), 0.55, 4.2);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    vec2 p = gl_PointCoord - vec2(0.5);
    float d = length(p);
    if (d > 0.5) discard;
    float core = 1.0 - smoothstep(0.02, 0.16, d);
    float halo = 1.0 - smoothstep(0.08, 0.5, d);
    float alpha = (core + halo * 0.72) * vTwinkle;
    gl_FragColor = vec4(vColor * (0.72 + core * 0.55), alpha);
  }
`;

const STAR_COLORS = [
  [1.00, 1.00, 1.00],
  [0.68, 0.80, 1.00],
  [0.86, 0.92, 1.00],
  [1.00, 0.91, 0.72],
  [1.00, 0.72, 0.50],
];

export function createStarField({ count = 9000, radius = 1800 } = {}) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const y = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const r = radius * (0.88 + Math.random() * 0.16);
    const ring = Math.sqrt(1 - y * y);
    positions[i * 3] = r * ring * Math.cos(theta);
    positions[i * 3 + 1] = r * y;
    positions[i * 3 + 2] = r * ring * Math.sin(theta);

    const palette = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];
    const brightness = 0.42 + Math.random() * 0.58;
    colors[i * 3] = palette[0] * brightness;
    colors[i * 3 + 1] = palette[1] * brightness;
    colors[i * 3 + 2] = palette[2] * brightness;

    // Most stars stay tiny; a few become bright landmarks in the sky.
    sizes[i] = 1.4 + Math.pow(Math.random(), 4) * 7.5;
    phases[i] = Math.random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const stars = new THREE.Points(geometry, material);
  stars.name = 'starField';
  stars.frustumCulled = false;
  stars.userData.update = (t) => {
    material.uniforms.uTime.value = t;
  };
  return stars;
}
