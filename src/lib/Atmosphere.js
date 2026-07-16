import * as THREE from 'three';

// Atmosphere shader with a Rayleigh-style scattering approximation:
//  - The light direction is passed in so we get a real day/night terminator.
//  - The rim is brightened (limb) and tinted towards the scattering color.
//  - The night side is faintly visible (so planets don't disappear when back-lit).
//
// `uLightDir` is in view space, recomputed each frame by the planet.

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldNormal;
  uniform vec3 uColor;
  uniform vec3 uColorHorizon;
  uniform vec3 uLightDir;   // world-space direction TOWARDS the sun
  uniform float uIntensity;
  void main() {
    float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 2.2);
    // How lit is this part of the atmosphere (1 = day, 0 = night)
    float sun = max(dot(normalize(vWorldNormal), normalize(uLightDir)), 0.0);
    float day = pow(sun, 0.6);

    // Rayleigh-ish: stronger near the terminator (low sun) and on the limb
    float scatter = fresnel * (0.35 + 0.85 * day);
    vec3 col = mix(uColorHorizon, uColor, fresnel);
    col *= uIntensity * (0.6 + 1.2 * day);

    // Warm sunset tint close to the terminator
    float term = smoothstep(0.0, 0.35, sun) * (1.0 - smoothstep(0.35, 0.8, sun));
    col = mix(col, uColorHorizon * 1.6, term * 0.6);

    float a = scatter;
    gl_FragColor = vec4(col, a);
  }
`;

export function createAtmosphere(radius, scale = 1.05, color = 0x6cb0ff, intensity = 1.0) {
  const geo = new THREE.SphereGeometry(radius * scale, 64, 64);
  const baseColor = new THREE.Color(color);
  // Slightly warmer/desaturated horizon colour
  const horizon = baseColor.clone().lerp(new THREE.Color(0xffb98a), 0.45);
  const mat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uColor: { value: baseColor },
      uColorHorizon: { value: horizon },
      uIntensity: { value: intensity },
      uLightDir: { value: new THREE.Vector3(1, 0, 0) },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'atmosphere';
  mesh.userData.update = (lightDirWorld) => {
    mat.uniforms.uLightDir.value.copy(lightDirWorld);
  };
  return mesh;
}
