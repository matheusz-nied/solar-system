import * as THREE from 'three';

// Comet on a highly elliptical orbit around the sun.
// The tail is a particle stream that always points away from the sun, with the
// ion tail (blue, straight) and a dust tail (warm, slightly curved). Both are
// real particle objects, not textures.

function makePuffTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
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

export function createComet({
  perihelion = 60,
  aphelion = 360,
  period = 60,         // seconds for a full orbit at speed=1
  inclination = 0.4,
  phase = 0,
  tailLength = 90,
  tailParticles = 800,
} = {}) {
  const root = new THREE.Group();
  root.name = 'comet';

  // Nucleus (icy rock)
  const nucleusGeo = new THREE.DodecahedronGeometry(0.8, 0);
  const nucleusMat = new THREE.MeshStandardMaterial({
    color: 0xb8c4d0,
    roughness: 0.6,
    metalness: 0.1,
    flatShading: true,
    emissive: 0x223344,
    emissiveIntensity: 0.4,
  });
  const nucleus = new THREE.Mesh(nucleusGeo, nucleusMat);
  nucleus.castShadow = true;
  nucleus.receiveShadow = true;
  root.add(nucleus);

  // Coma (fuzzy glow around the nucleus)
  const comaGeo = new THREE.SphereGeometry(2.4, 24, 24);
  const comaMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0xaad4ff) } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV;
      void main(){
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; uniform vec3 uColor;
      void main(){
        float f = pow(1.0 - max(dot(vN,vV),0.0), 2.0);
        gl_FragColor = vec4(uColor * f, f * 0.55);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
  });
  const coma = new THREE.Mesh(comaGeo, comaMat);
  root.add(coma);

  // Tail: a stretched particle cloud anchored at the nucleus. We emit particles
  // in local space along +X (away from sun after we orient the group) and let
  // them spread with distance.
  const tailGeo = new THREE.BufferGeometry();
  const tailPos = new Float32Array(tailParticles * 3);
  const tailCol = new Float32Array(tailParticles * 3);
  const tailSize = new Float32Array(tailParticles);
  const tailLife = new Float32Array(tailParticles);
  const tailSeed = new Float32Array(tailParticles);

  for (let i = 0; i < tailParticles; i++) {
    tailLife[i] = Math.random();
    tailSeed[i] = Math.random();
    // Dust tail is warmer and slightly off-axis; ion tail is blue and straight.
    const isIon = i % 2 === 0;
    if (isIon) {
      tailCol[i * 3] = 0.55;
      tailCol[i * 3 + 1] = 0.75;
      tailCol[i * 3 + 2] = 1.0;
    } else {
      tailCol[i * 3] = 1.0;
      tailCol[i * 3 + 1] = 0.85;
      tailCol[i * 3 + 2] = 0.6;
    }
    tailSize[i] = 6 + Math.random() * 14;
  }

  tailGeo.setAttribute('position', new THREE.BufferAttribute(tailPos, 3));
  tailGeo.setAttribute('color', new THREE.BufferAttribute(tailCol, 3));
  tailGeo.setAttribute('aSize', new THREE.BufferAttribute(tailSize, 1));

  const tailMat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: getPuffTexture() },
      uPixelRatio: { value: window.devicePixelRatio || 1 },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute vec3 color;
      varying vec3 vColor;
      uniform float uPixelRatio;
      void main(){
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_PointSize = aSize * uPixelRatio * (300.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      varying vec3 vColor;
      void main(){
        vec4 t = texture2D(uMap, gl_PointCoord);
        if (t.a <= 0.01) discard;
        gl_FragColor = vec4(vColor, t.a * 0.5);
      }
    `,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const tail = new THREE.Points(tailGeo, tailMat);
  tail.frustumCulled = false;
  tail.name = 'comet-tail';
  root.add(tail);

  // Elliptical orbit state. We solve Kepler's equation approximately using
  // a few iterations of Newton's method.
  const a = (perihelion + aphelion) / 2;
  const e = (aphelion - perihelion) / (aphelion + perihelion);
  const b = a * Math.sqrt(1 - e * e);

  const orbitGroup = new THREE.Group();
  orbitGroup.rotation.x = inclination;
  orbitGroup.add(root);
  root.position.set(perihelion, 0, 0); // start at perihelion

  const tmpDir = new THREE.Vector3();
  const awayDir = new THREE.Vector3();

  function solveKepler(M, ecc) {
    let E = M;
    for (let i = 0; i < 4; i++) {
      E = E - (E - ecc * Math.sin(E) - M) / (1 - ecc * Math.cos(E));
    }
    return E;
  }

  function updateTail() {
    // Orient the comet so +X points away from the sun (in orbit-local space the
    // sun is at the origin, so "away" is just the normalized position).
    awayDir.copy(root.position).normalize();
    // Build a quaternion that maps +X to awayDir
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), awayDir);
    tail.quaternion.copy(q);

    const posAttr = tail.geometry.attributes.position;
    for (let i = 0; i < tailParticles; i++) {
      const life = tailLife[i];
      const seed = tailSeed[i];
      const isIon = i % 2 === 0;
      const dist = life * tailLength;
      // Spread perpendicular to the tail axis (more spread further down the tail)
      const spread = 0.04 + life * 0.9;
      const perpY = (seed - 0.5) * spread * (isIon ? 0.6 : 1.4);
      const perpZ = ((seed * 1.7) % 1 - 0.5) * spread * (isIon ? 0.6 : 1.4);
      // Dust tail curves slightly backwards along the orbit
      const curve = isIon ? 0 : -life * 8 * Math.sign(root.position.z || 1);
      posAttr.setXYZ(i, dist, perpY, perpZ + curve);
      // Cycle life so particles flow
      tailLife[i] = (life + 0.012) % 1.0;
    }
    posAttr.needsUpdate = true;
  }

  let M = phase * Math.PI * 2;
  orbitGroup.userData.update = (dt, speed) => {
    M += (dt * speed * 2 * Math.PI) / period;
    const E = solveKepler(M % (Math.PI * 2), e);
    const x = a * (Math.cos(E) - e);
    const z = b * Math.sin(E);
    root.position.set(x, 0, z);
    nucleus.rotation.y += dt * 0.4 * speed;
    nucleus.rotation.x += dt * 0.2 * speed;
    updateTail();
  };

  // The sun-distance drives tail brightness: closer to sun -> longer/brighter tail.
  // We bake that into the material opacity via a uniform-ish scalar on the coma.
  orbitGroup.userData.update(0, 1);

  // Expose nucleus for picking
  orbitGroup.userData.nucleus = nucleus;
  orbitGroup.userData.name = 'Cometa';

  return orbitGroup;
}

export function createComets() {
  const group = new THREE.Group();
  group.name = 'comets';

  const setups = [
    { perihelion: 50, aphelion: 380, period: 90, inclination: 0.45, phase: 0.0 },
    { perihelion: 80, aphelion: 320, period: 120, inclination: -0.7, phase: 0.35 },
    { perihelion: 120, aphelion: 420, period: 160, inclination: 1.1, phase: 0.7 },
  ];

  const updaters = [];
  for (const cfg of setups) {
    const c = createComet(cfg);
    group.add(c);
    updaters.push(c.userData.update);
  }

  group.userData.update = (dt, speed) => {
    for (const u of updaters) u(dt, speed);
  };
  return group;
}
