import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// A restrained, analytic solar glare. The previous implementation repeatedly
// sampled the already-bloomed frame toward the Sun. In a scene with bright
// orbit lines that turns the whole image into concentric bands. Keeping the
// glare local to the Sun preserves the sense of brightness without washing out
// planets, belts and the background.
const GodRaysShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSunPos: { value: new THREE.Vector2(0.5, 0.5) },
    uSunVisible: { value: 1.0 },
    uAspect: { value: 1.0 },
    uTime: { value: 0.0 },
    uIntensity: { value: 0.16 },
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
    uniform float uAspect;
    uniform float uTime;
    uniform float uIntensity;

    void main() {
      vec3 base = texture2D(tDiffuse, vUv).rgb;
      vec2 delta = vUv - uSunPos;
      delta.x *= uAspect;
      float dist = length(delta);
      // A compact optical glow with no synthetic starburst spikes. Fine
      // structure belongs to the physical corona rendered around the Sun.
      float core = exp(-dist * 34.0);
      float halo = exp(-dist * 15.0) * 0.24;
      float shimmer = 0.98 + 0.02 * sin(uTime * 0.52);
      vec3 glareColor = mix(vec3(1.0, 0.38, 0.08), vec3(1.0, 0.88, 0.60), core);
      vec3 glare = glareColor * (core * 0.20 + halo) * shimmer;

      gl_FragColor = vec4(base + glare * uIntensity * uSunVisible, 1.0);
    }
  `,
};

// Subtle cinematic grade: vignette, film grain, faint chromatic aberration,
// gentle contrast/lift for a more filmic look.
const CinematicShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.46 },
    uGrain: { value: 0.016 },
    uChroma: { value: 0.0007 },
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

      // Gentle filmic contrast with a cool lift in the shadows. This keeps
      // night-side detail readable without turning space grey.
      col = (col - 0.5) * 1.035 + 0.5;
      col = max(col, 0.0);
      float shadow = 1.0 - smoothstep(0.02, 0.32, dot(col, vec3(0.299, 0.587, 0.114)));
      col += vec3(0.006, 0.010, 0.022) * shadow;

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
    0.48,  // strength
    0.34,  // radius
    1.02   // threshold: reserve bloom for genuinely emissive highlights
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
      godRays.uniforms.uAspect.value = w / Math.max(h, 1);
    },
  };
}
