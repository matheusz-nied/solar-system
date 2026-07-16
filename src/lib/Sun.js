import * as THREE from 'three';

// Realistic-ish Sun built from procedural shaders (no static look):
//  - Surface: animated FBM noise producing granulation + brighter plasma cells,
//    with a subtle limb darkening.
//  - Corona: multi-layer additive fresnel glow that pulses gently.
//  - Prominences: a few curved plasma arcs anchored on the surface that sway.
//  - Optional lens flare is added by SceneInit (uses THREE.Lensflare).

const surfaceVert = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vPos;
  void main() {
    vPos = position;
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const surfaceFrag = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vPos;
  uniform float uTime;
  uniform vec3 uColorHot;
  uniform vec3 uColorCool;

  // Classic 3D simplex noise (Ashima). Cheap enough for a single sphere.
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);
    const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.0-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(
      i.z+vec4(0.0,i1.z,i2.z,1.0))
      +i.y+vec4(0.0,i1.y,i2.y,1.0))
      +i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;
    vec4 s1=floor(b1)*2.0+1.0;
    vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
    m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }

  float fbm(vec3 p){
    float a=0.5;
    float f=1.0;
    float s=0.0;
    for(int i=0;i<5;i++){
      s+=a*snoise(p*f);
      f*=2.02;
      a*=0.5;
    }
    return s;
  }

  void main() {
    vec3 p = normalize(vPos) * 2.6;
    float t = uTime * 0.12;
    // Two layers of fbm: large plasma cells + finer granulation
    float cells = fbm(p + vec3(0.0, t, 0.0));
    float fine  = fbm(p * 3.2 - vec3(t * 0.6, 0.0, t * 0.4));
    float n = cells * 0.7 + fine * 0.3;
    float heat = smoothstep(-0.2, 0.9, n);

    vec3 col = mix(uColorCool, uColorHot, heat);
    // Bright filament edges where the noise gradient is high
    float edge = smoothstep(0.55, 0.95, n);
    col += uColorHot * edge * 0.6;

    // Limb darkening for a more physical look
    float mu = max(dot(vNormal, vViewDir), 0.0);
    float limb = pow(mu, 0.55);
    col *= 0.65 + 0.55 * limb;

    // Bright hot rim for the corona transition
    float rim = pow(1.0 - mu, 2.5);
    col += uColorHot * rim * 0.5;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const coronaFrag = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uIntensity;
  void main() {
    float mu = max(dot(vNormal, vViewDir), 0.0);
    float fresnel = pow(1.0 - mu, 3.2);
    float pulse = 0.85 + 0.15 * sin(uTime * 0.8);
    float a = fresnel * uIntensity * pulse;
    gl_FragColor = vec4(uColor * fresnel * 1.8, a);
  }
`;

const coronaVert = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

export function createSun(radius, manager) {
  const group = new THREE.Group();
  group.name = 'sun';

  // Surface
  const surfGeo = new THREE.SphereGeometry(radius, 96, 96);
  const surfMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColorHot: { value: new THREE.Color(0xffd27a) },
      uColorCool: { value: new THREE.Color(0xff5a18) },
    },
    vertexShader: surfaceVert,
    fragmentShader: surfaceFrag,
  });
  const surface = new THREE.Mesh(surfGeo, surfMat);
  surface.name = 'sun-surface';
  group.add(surface);

  // Inner corona (tight glow)
  const coronaGeo = new THREE.SphereGeometry(radius * 1.18, 64, 64);
  const coronaMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0xffb24d) },
      uTime: { value: 0 },
      uIntensity: { value: 1.1 },
    },
    vertexShader: coronaVert,
    fragmentShader: coronaFrag,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const corona = new THREE.Mesh(coronaGeo, coronaMat);
  corona.name = 'sun-corona';
  group.add(corona);

  // Outer glow (large soft halo)
  const haloGeo = new THREE.SphereGeometry(radius * 1.9, 64, 64);
  const haloMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0xff8a3c) },
      uTime: { value: 0 },
      uIntensity: { value: 0.55 },
    },
    vertexShader: coronaVert,
    fragmentShader: coronaFrag,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.name = 'sun-halo';
  group.add(halo);

  // Prominences (plasma arcs). Each is a thin torus oriented at random.
  const prominences = new THREE.Group();
  prominences.name = 'sun-prominences';
  const promCount = 5;
  const promColors = [0xff7a3a, 0xffb24d, 0xff5a3a, 0xffd27a, 0xff8a3a];
  for (let i = 0; i < promCount; i++) {
    const torusR = radius * (0.35 + Math.random() * 0.35);
    const tubeR = radius * (0.04 + Math.random() * 0.05);
    const torusGeo = new THREE.TorusGeometry(torusR, tubeR, 12, 64, Math.PI * (0.8 + Math.random() * 0.6));
    const torusMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(promColors[i % promColors.length]) },
        uTime: { value: 0 },
        uSeed: { value: Math.random() * 10 },
      },
      vertexShader: coronaVert,
      fragmentShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        uniform vec3 uColor;
        uniform float uTime;
        uniform float uSeed;
        void main() {
          float mu = max(dot(vNormal, vViewDir), 0.0);
          float fresnel = pow(1.0 - mu, 2.0);
          float pulse = 0.7 + 0.3 * sin(uTime * 1.4 + uSeed * 6.28);
          gl_FragColor = vec4(uColor, fresnel * 0.55 * pulse);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const torus = new THREE.Mesh(torusGeo, torusMat);
    // Anchor the arc so it sits on the sun's surface
    torus.position.set(
      (Math.random() - 0.5) * radius * 1.2,
      (Math.random() - 0.5) * radius * 1.2,
      (Math.random() - 0.5) * radius * 1.2,
    );
    const n = torus.position.clone().normalize();
    torus.lookAt(n.clone().multiplyScalar(radius * 3));
    torus.rotateX(Math.PI / 2);
    torus.position.copy(n.multiplyScalar(radius * 1.0));
    torus.userData.seed = Math.random() * 10;
    prominences.add(torus);
  }
  group.add(prominences);

  // Reference mesh (kept for compatibility / picking).
  // We add a transparent proxy sphere so raycasting still hits the sun while
  // the visible surface is the shader mesh above.
  const proxyGeo = new THREE.SphereGeometry(radius, 24, 24);
  const proxyMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const proxy = new THREE.Mesh(proxyGeo, proxyMat);
  proxy.name = 'sun-proxy';
  group.add(proxy);

  group.userData.update = (t, dt, speed) => {
    surfMat.uniforms.uTime.value = t;
    coronaMat.uniforms.uTime.value = t;
    haloMat.uniforms.uTime.value = t;
    surface.rotation.y += dt * 0.05 * speed;
    prominences.rotation.y += dt * 0.02 * speed;
    for (const child of prominences.children) {
      child.material.uniforms.uTime.value = t;
      child.rotation.z += dt * 0.1 * (child.userData.seed - 5);
    }
  };

  group.userData.proxy = proxy;
  return group;
}
