import * as THREE from 'three';

// Procedural spiral galaxy built entirely from point particles.
// No textures: every star in the galaxy is a real point in 3D space, with a
// bulge, spiral arms (logarithmic), dust lanes and per-particle color based on
// radial distance (hot blue arms, warm yellow core, reddish dust).

function hashFloat(n) {
  const s = Math.sin(n) * 43758.5453123;
  return s - Math.floor(s);
}

export function createGalaxy({
  count = 12000,
  radius = 220,
  arms = 4,
  armSpread = 0.55,
  spin = 1.05,
  thickness = 0.18,
  coreSize = 0.18,
  hueShift = 0.0,
} = {}) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  const core = new THREE.Color().setHSL(0.08 + hueShift, 0.65, 0.85); // warm yellow core
  const arm = new THREE.Color().setHSL(0.58 + hueShift, 0.7, 0.6);    // hot blue arms
  const dust = new THREE.Color().setHSL(0.02 + hueShift, 0.6, 0.35);  // reddish dust

  for (let i = 0; i < count; i++) {
    // Distribute radius with bias toward the centre (sqrt for disc-like falloff)
    const rr = Math.pow(Math.random(), 1.6);
    const dist = rr * radius;

    // Pick an arm and an angular offset that increases with radius (log spiral)
    const armIndex = Math.floor(Math.random() * arms);
    const armAngle = (armIndex / arms) * Math.PI * 2;
    const radialAngle = dist * spin / radius;
    const jitter = (hashFloat(i * 1.37) - 0.5) * armSpread * (0.4 + dist / radius);
    const angle = armAngle + radialAngle + jitter;

    // Vertical thickness falls off toward the edge
    const yScatter = (1.0 - rr * 0.6) * thickness * radius
      * (hashFloat(i * 2.13) - 0.5) * 2.0;

    positions[i * 3] = Math.cos(angle) * dist;
    positions[i * 3 + 1] = yScatter;
    positions[i * 3 + 2] = Math.sin(angle) * dist;

    // Color: blend core -> arm, sprinkle dust particles in mid-disc
    const tNorm = Math.min(dist / radius, 1.0);
    const col = new THREE.Color().copy(core).lerp(arm, tNorm);
    if (tNorm > 0.25 && tNorm < 0.8 && hashFloat(i * 7.71) < 0.12) {
      col.lerp(dust, 0.6);
    }
    // Brightness boost near core
    const bright = 0.5 + 0.5 * (1.0 - tNorm);
    colors[i * 3] = col.r * bright;
    colors[i * 3 + 1] = col.g * bright;
    colors[i * 3 + 2] = col.b * bright;

    // Slightly larger core stars
    sizes[i] = rr < coreSize ? 2.2 + Math.random() * 1.5 : 0.9 + Math.random() * 1.1;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: window.devicePixelRatio || 1 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute vec3 color;
      varying vec3 vColor;
      uniform float uPixelRatio;
      uniform float uTime;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * (220.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        vec2 c = gl_PointCoord - vec2(0.5);
        float d = length(c);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor, a * 0.9);
      }
    `,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.userData.update = (t, dt) => {
    points.rotation.y += dt * 0.005;
  };
  return points;
}

// A small cluster of distant galaxies placed around the scene at far distance.
export function createGalaxies(sceneRadius = 1700) {
  const group = new THREE.Group();
  group.name = 'galaxies';

  const setups = [
    { count: 14000, radius: 260, arms: 4, spin: 1.1, hueShift: 0.0,
      pos: [sceneRadius * 0.92, sceneRadius * 0.18, -sceneRadius * 0.55],
      rot: [0.5, 0.2, -0.3], scale: 1.0 },
    { count: 9000, radius: 180, arms: 3, spin: 0.9, hueShift: 0.06,
      pos: [-sceneRadius * 0.85, -sceneRadius * 0.25, sceneRadius * 0.6],
      rot: [-0.7, 1.1, 0.4], scale: 0.85 },
    { count: 7000, radius: 150, arms: 5, spin: 1.3, hueShift: -0.08,
      pos: [sceneRadius * 0.2, sceneRadius * 0.7, sceneRadius * 0.8],
      rot: [1.2, -0.4, 0.6], scale: 0.7 },
    { count: 5000, radius: 120, arms: 2, spin: 0.7, hueShift: 0.12,
      pos: [-sceneRadius * 0.4, -sceneRadius * 0.6, -sceneRadius * 0.8],
      rot: [-0.3, 0.6, -1.0], scale: 0.6 },
  ];

  const updaters = [];
  for (const cfg of setups) {
    const g = createGalaxy(cfg);
    g.position.set(...cfg.pos);
    g.rotation.set(...cfg.rot);
    g.scale.setScalar(cfg.scale);
    group.add(g);
    updaters.push(g.userData.update);
  }

  group.userData.update = (t, dt) => {
    for (const u of updaters) u(t, dt);
  };
  return group;
}
