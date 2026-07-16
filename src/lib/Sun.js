import * as THREE from 'three';

// Realistic-ish Sun built from procedural shaders (no static look):
//  - Surface: animated FBM noise producing granulation + brighter plasma cells,
//    drifting sunspots (umbra + penumbra) and a physically-correct limb
//    darkening (center brightest). A thin chromospheric rim tints the edge.
//  - Corona: streaming additive fresnel glow with animated noise that pulses.
//  - Prominences: curved plasma arcs anchored on the surface that sway and
//    "erupt" with a slow breathing scale.
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

  // Cheap value-noise for large-scale features (sunspots / supergranulation)
  float hash2(vec3 p){
    p = fract(p*0.3183099+0.1);
    p *= 17.0;
    return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
  }
  float vnoise(vec3 p){
    vec3 i=floor(p); vec3 f=fract(p);
    f=f*f*(3.0-2.0*f);
    float n000=hash2(i+vec3(0,0,0));
    float n100=hash2(i+vec3(1,0,0));
    float n010=hash2(i+vec3(0,1,0));
    float n110=hash2(i+vec3(1,1,0));
    float n001=hash2(i+vec3(0,0,1));
    float n101=hash2(i+vec3(1,0,1));
    float n011=hash2(i+vec3(0,1,1));
    float n111=hash2(i+vec3(1,1,1));
    float nx00=mix(n000,n100,f.x);
    float nx10=mix(n010,n110,f.x);
    float nx01=mix(n001,n101,f.x);
    float nx11=mix(n011,n111,f.x);
    float nxy0=mix(nx00,nx10,f.y);
    float nxy1=mix(nx01,nx11,f.y);
    return mix(nxy0,nxy1,f.z);
  }

  void main() {
    vec3 dir = normalize(vPos);
    vec3 p = dir * 4.1;
    float t = uTime * 0.12;
    // Two layers of fbm: large plasma cells + finer granulation
    float cells = fbm(p + vec3(0.0, t, 0.0));
    float fine  = fbm(p * 4.6 - vec3(t * 0.6, 0.0, t * 0.4));
    float n = cells * 0.55 + fine * 0.45;
    float heat = smoothstep(-0.32, 0.68, n);

    vec3 col = mix(uColorCool, uColorHot, heat);
    // Bright filament edges where the noise gradient is high
    float edge = smoothstep(0.48, 0.88, n);
    col += uColorHot * edge * 0.16;

    // Sunspots: slow, big-scale darker blotches that drift with rotation.
    float spotNoise = vnoise(dir * 3.0 + vec3(t * 0.04, 0.0, -t * 0.03));
    float spots = smoothstep(0.70, 0.84, spotNoise);
    // Penumbra: a slightly brighter ring around the dark umbra
    float penRing = smoothstep(0.64, 0.70, spotNoise) - smoothstep(0.70, 0.75, spotNoise);
    col = mix(col, col * 0.24, spots);
    col += uColorHot * penRing * 0.16;

    // Limb darkening (Eddington-ish): CENTER is brightest, edge ~40%.
    float mu = max(dot(vNormal, vViewDir), 0.0);
    float limb = 0.40 + 0.60 * sqrt(mu);
    col *= limb;

    // Thin chromospheric rim — warm red-orange, only the very edge (subtle)
    float rim = pow(1.0 - mu, 6.0);
    col += vec3(1.0, 0.32, 0.10) * rim * 0.8;

    // A small HDR lift lets only the hottest cells bloom; the surface texture
    // remains visible instead of collapsing into a white disc.
    col *= 1.06;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const coronaVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Camera-facing procedural corona. Unlike nested transparent spheres, this
// has no geometric circular boundary: its wisps fade organically into space.
const coronaFrag = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      sum += noise(p) * amp;
      p = p * 2.03 + 7.1;
      amp *= 0.5;
    }
    return sum;
  }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    float angle = atan(p.y, p.x);
    float t = uTime * 0.10;

    // The visible solar surface ends around r=0.36 on this plane.
    float outside = smoothstep(0.32, 0.41, r);
    float edgeFade = 1.0 - smoothstep(0.64, 0.94, r);
    float radialFade = exp(-max(r - 0.34, 0.0) * 5.8);

    // Sample noise in circular coordinates to avoid repeated, evenly spaced
    // rays. Two slowly drifting layers create broad asymmetric plasma wisps.
    vec2 radial = vec2(cos(angle), sin(angle));
    vec2 tangent = vec2(-radial.y, radial.x);
    vec2 driftA = vec2(t * 0.34, -t * 0.22);
    vec2 driftB = vec2(-t * 0.17, t * 0.29);
    float curl = sin(r * 11.0 - t * 1.2) * max(r - 0.34, 0.0) * 2.6;
    float broad = fbm(radial * (2.1 + r * 1.7) + tangent * curl + driftA);
    float detail = fbm(radial * (4.8 + r * 2.2) - tangent * curl * 1.4 + driftB);
    float turbulence = broad * 0.68 + detail * 0.32;
    float wisps = smoothstep(0.34, 0.78, turbulence);
    float asymmetry = 0.90 + 0.10 * sin(angle * 3.0 + broad * 5.0 + t * 0.7);

    float chromosphere = exp(-pow((r - 0.365) * 18.0, 2.0));
    float corona = outside * radialFade * edgeFade * (0.032 + wisps * 0.052) * asymmetry;
    float pulse = 0.975 + 0.025 * sin(uTime * 0.48);
    float alpha = (chromosphere * 0.20 + corona) * pulse;

    vec3 innerColor = vec3(1.0, 0.38, 0.055);
    vec3 outerColor = vec3(1.0, 0.73, 0.30);
    vec3 color = mix(innerColor, outerColor, smoothstep(0.36, 0.78, r));
    color *= 0.88 + turbulence * 0.24;

    gl_FragColor = vec4(color, alpha);
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
      uColorHot: { value: new THREE.Color(0xfff4c7) },
      uColorCool: { value: new THREE.Color(0xf26b12) },
    },
    vertexShader: surfaceVert,
    fragmentShader: surfaceFrag,
  });
  const surface = new THREE.Mesh(surfGeo, surfMat);
  surface.name = 'sun-surface';
  group.add(surface);

  // One soft billboard replaces the former nested corona spheres and torus
  // prominences. It always faces the camera and fades without a hard edge.
  const coronaGeo = new THREE.PlaneGeometry(radius * 5.5, radius * 5.5);
  const coronaMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: coronaVert,
    fragmentShader: coronaFrag,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const corona = new THREE.Mesh(coronaGeo, coronaMat);
  corona.name = 'sun-corona';
  corona.renderOrder = 1;
  corona.onBeforeRender = (_renderer, _scene, camera) => {
    corona.quaternion.copy(camera.quaternion);
  };
  group.add(corona);

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
    surface.rotation.y += dt * 0.05 * speed;
  };

  group.userData.proxy = proxy;
  return group;
}
