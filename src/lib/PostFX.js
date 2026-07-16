import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// Screen-space god rays: radial blur of bright pixels toward the sun's screen
// position, then additively blended back. Cheap and works with the existing
// HDR-ish scene produced by the bloom pass.
const GodRaysShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSunPos: { value: new THREE.Vector2(0.5, 0.5) },
    uSunVisible: { value: 1.0 },
    uDensity: { value: 0.92 },
    uWeight: { value: 0.32 },
    uDecay: { value: 0.94 },
    uExposure: { value: 0.55 },
    uThreshold: { value: 0.6 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform vec2 uSunPos;
    uniform float uSunVisible;
    uniform float uDensity;
    uniform float uWeight;
    uniform float uDecay;
    uniform float uExposure;
    uniform float uThreshold;

    void main() {
      vec2 tc = vUv;
      vec2 dir = uSunPos - tc;
      float dist = length(dir);
      dir /= max(dist, 0.0001);

      // Step count scales with distance so far rays are smooth
      const int MAX_SAMPLES = 80;
      int samples = int(clamp(dist * float(MAX_SAMPLES) * uDensity, 4.0, float(MAX_SAMPLES)));
      float stepSize = dist / float(samples);
      vec2 pos = tc + dir * stepSize * 0.5;

      float illum = 1.0;
      vec3 accum = vec3(0.0);
      for (int i = 0; i < MAX_SAMPLES; i++) {
        if (i >= samples) break;
        vec3 s = texture2D(tDiffuse, pos).rgb;
        float l = dot(s, vec3(0.299, 0.587, 0.114));
        // Only bright pixels contribute to god rays
        float mask = smoothstep(uThreshold, 1.2, l);
        accum += s * mask * uWeight * illum;
        illum *= uDecay;
        pos += dir * stepSize;
      }

      vec3 base = texture2D(tDiffuse, vUv).rgb;
      vec3 rays = accum * uExposure * uSunVisible;
      gl_FragColor = vec4(base + rays, 1.0);
    }
  `,
};

// Subtle cinematic grade: vignette, film grain, faint chromatic aberration,
// gentle contrast/lift for a more filmic look.
const CinematicShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.85 },
    uGrain: { value: 0.045 },
    uChroma: { value: 0.0015 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uChroma;

    // Hash for grain
    float hash(vec2 p){
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec2 uv = vUv;
      vec2 center = vec2(0.5);
      vec2 d = uv - center;

      // Faint chromatic aberration, stronger toward the edges
      float caAmt = uChroma * length(d);
      vec3 col;
      col.r = texture2D(tDiffuse, uv - d * caAmt).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv + d * caAmt).b;

      // Vignette (smooth, elliptical)
      float vig = 1.0 - dot(d, d) * uVignette * 2.2;
      vig = clamp(vig, 0.0, 1.0);
      vig = pow(vig, 0.85);
      col *= vig;

      // Slight contrast/lift for filmic tone
      col = (col - 0.5) * 1.06 + 0.5;
      col = max(col, 0.0);

      // Film grain
      float g = hash(uv * 1024.0 + fract(uTime) * 17.0);
      col += (g - 0.5) * uGrain;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createPostFX(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.setSize(window.innerWidth, window.innerHeight);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.9,   // strength
    0.7,   // radius
    0.75   // threshold
  );
  composer.addPass(bloom);

  const godRays = new ShaderPass(GodRaysShader);
  godRays.enabled = true;
  composer.addPass(godRays);

  // OutputPass converts linear HDR -> sRGB display space. The cinematic grade
  // runs after it so its vignette/grain/contrast operate in display space.
  const output = new OutputPass();
  composer.addPass(output);

  const cinematic = new ShaderPass(CinematicShader);
  composer.addPass(cinematic);

  return {
    composer,
    bloom,
    godRays,
    cinematic,
    setSize(w, h) {
      composer.setSize(w, h);
      bloom.setSize(w, h);
    },
  };
}
