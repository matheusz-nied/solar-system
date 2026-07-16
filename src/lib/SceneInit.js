import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Lensflare, LensflareElement } from 'three/examples/jsm/objects/Lensflare.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';

import { SUN_RADIUS, SUN_INFO, PLANET_DATA } from './planetData';
import { Planet } from './Planet';
import { createSun } from './Sun';
import { createStarField } from './StarField';
import { createGalaxies } from './Galaxy';
import { createNebulae } from './Nebula';
import { createAsteroidBelt, createKuiperBelt } from './AsteroidBelt';
import { createComets } from './Comet';
import { createPostFX } from './PostFX';

const SCENE_RADIUS = 1800;

// Procedural lens flare textures (canvas-generated, no external assets).
function makeFlareTexture(size, inner) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(255,255,255,${inner})`);
  g.addColorStop(0.18, `rgba(255,255,255,${inner * 0.16})`);
  g.addColorStop(0.55, `rgba(255,255,255,${inner * 0.025})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeRingTexture(size, color) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.translate(size / 2, size / 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, size / 2 - 1, 0, Math.PI * 2);
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default class SceneInit {
  constructor(canvasId) {
    this.canvasId = canvasId;
    this.scene = undefined;
    this.camera = undefined;
    this.renderer = undefined;
    this.labelRenderer = undefined;
    this.composer = undefined;
    this.bloom = undefined;
    this.godRays = undefined;
    this.cinematic = undefined;

    this.fov = 55;
    this.nearPlane = 0.5;
    this.farPlane = 6000;

    this.clock = undefined;
    this.stats = undefined;
    this.controls = undefined;
    this.sunLight = undefined;
    this.ambient = undefined;

    this.planets = [];
    this.timeSpeed = 1;
    this.paused = false;
    this._onLoadingProgress = undefined;
    this._onLoad = undefined;

    // Dynamic environment groups
    this.starField = null;
    this.galaxies = null;
    this.nebulae = null;
    this.asteroidBelt = null;
    this.kuiperBelt = null;
    this.comets = null;
    this.orbitLines = null;

    // Focus / camera follow
    this.focusTarget = null;
    this._focusTransitioning = false;
    this._focusProgress = 0;
    this._focusStartCam = new THREE.Vector3();
    this._focusStartTarget = new THREE.Vector3();
    this._focusDesiredOffset = new THREE.Vector3();
    this._focusDistance = 0;

    // Picking
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._pointerDown = { x: 0, y: 0 };

    // Stats per-frame cache
    this._sunScreen = new THREE.Vector3();
    this._tmpV = new THREE.Vector3();
    this._tmpV2 = new THREE.Vector3();
  }

  initialize() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000003);
    // Subtle nebula tint fog so extremely far objects fade to deep space
    this.scene.fog = new THREE.FogExp2(0x000005, 0.00006);

    this.camera = new THREE.PerspectiveCamera(
      this.fov,
      window.innerWidth / window.innerHeight,
      this.nearPlane,
      this.farPlane
    );
    this.camera.position.set(0, 120, 320);

    const canvas = document.getElementById(this.canvasId);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Leave enough highlight headroom for the Sun while keeping planet
    // textures saturated. ACES will roll off the solar core smoothly.
    this.renderer.toneMappingExposure = 0.78;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.labelRenderer = new CSS2DRenderer({
      element: document.getElementById('labels'),
    });
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);

    this.clock = new THREE.Clock();
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 1400;
    this.controls.target.set(0, 0, 0);
    this.controls.zoomSpeed = 1.1;
    this.controls.rotateSpeed = 0.65;

    this.stats = Stats();
    this.stats.dom.style.position = 'absolute';
    this.stats.dom.style.top = '8px';
    this.stats.dom.style.left = '8px';
    this.stats.dom.style.opacity = '0.55';
    document.body.appendChild(this.stats.dom);

    // Lighting -------------------------------------------------------------
    // Very dim ambient so the night sides of planets are not pure black.
    this.ambient = new THREE.HemisphereLight(0x223355, 0x000010, 0.08);
    this.scene.add(this.ambient);

    // Sun is the dominant light source. High intensity, no decay so distant
    // planets still receive light (realistic inverse-square would be too dark).
    this.sunLight = new THREE.PointLight(0xfff1d8, 3.6, 0, 0);
    this.sunLight.position.set(0, 0, 0);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 760;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.04;
    this.scene.add(this.sunLight);

    // A very faint directional "fill" coming from the galactic plane so the
    // night sides of planets are not crushed to pure black — reads as ambient
    // starlight rather than a visible second light source.
    this.fillLight = new THREE.DirectionalLight(0x3a4a6a, 0.12);
    this.fillLight.position.set(0, 1, 0.001);
    this.scene.add(this.fillLight);

    // Loading manager ------------------------------------------------------
    const manager = new THREE.LoadingManager();
    manager.onProgress = (url, loaded, total) => {
      this._onLoadingProgress?.(loaded / total);
    };
    manager.onLoad = () => {
      this._onLoad?.();
    };
    this._manager = manager;

    // Sun ------------------------------------------------------------------
    this.sun = createSun(SUN_RADIUS, manager);
    this.sunGroup = this.sun;
    this.scene.add(this.sun);
    // Expose a representative mesh for compatibility (some code expects this.sun)
    this.sunMesh = this.sun.userData.proxy;

    // Lens flare attached to the sun
    this._addSunLensflare();

    // Background objects ---------------------------------------------------
    this.starField = createStarField({ count: 9000, radius: SCENE_RADIUS });
    this.scene.add(this.starField);

    this.galaxies = createGalaxies(SCENE_RADIUS);
    this.scene.add(this.galaxies);

    this.nebulae = createNebulae(SCENE_RADIUS);
    this.scene.add(this.nebulae);

    // Planets --------------------------------------------------------------
    for (const data of PLANET_DATA) {
      const planet = new Planet(data, this.sun, manager);
      this.planets.push(planet);
      this.scene.add(planet.root);
    }

    // Belts ----------------------------------------------------------------
    this.asteroidBelt = createAsteroidBelt();
    this.scene.add(this.asteroidBelt);

    this.kuiperBelt = createKuiperBelt();
    this.scene.add(this.kuiperBelt);

    // Comets ---------------------------------------------------------------
    this.comets = createComets();
    this.scene.add(this.comets);

    // Build focusable bodies list (sun + planets) --------------------------
    this.focusableBodies = [
      {
        id: 'sun',
        name: SUN_INFO.name,
        info: SUN_INFO,
        isSun: true,
        getWorldPosition: (out) => out.set(0, 0, 0),
        radius: SUN_RADIUS,
      },
    ];
    for (const p of this.planets) {
      this.focusableBodies.push({
        id: p.data.id,
        name: p.data.name,
        info: p.data.info,
        isSun: false,
        getWorldPosition: (out) => p.getWorldPosition(out),
        radius: p.data.radius,
        planet: p,
      });
    }

    // Picking --------------------------------------------------------------
    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      this._pointerDown.x = e.clientX;
      this._pointerDown.y = e.clientY;
    });
    this.renderer.domElement.addEventListener('pointerup', (e) => {
      // Treat as a click only if the pointer barely moved (not a drag)
      const dx = e.clientX - this._pointerDown.x;
      const dy = e.clientY - this._pointerDown.y;
      if (Math.hypot(dx, dy) > 4) return;
      this._handleClick(e);
    });

    window.addEventListener('resize', () => this.onWindowResize(), false);
    window.addEventListener('keydown', (e) => this._handleKey(e), false);

    // Post-processing ------------------------------------------------------
    const fx = createPostFX(this.renderer, this.scene, this.camera);
    this.composer = fx.composer;
    this.bloom = fx.bloom;
    this.godRays = fx.godRays;
    this.cinematic = fx.cinematic;
    this._fx = fx;
    this._fx.setSize(window.innerWidth, window.innerHeight);
  }

  _addSunLensflare() {
    const flare = new Lensflare();
    const halo = makeFlareTexture(512, 0.6);
    const ring1 = makeRingTexture(128, 'rgba(255,220,170,0.9)');
    const ring2 = makeRingTexture(96, 'rgba(170,200,255,0.7)');

    // Bloom and the corona already handle the solar core. Lensflare is kept
    // only for subtle optical ghosts across the lens, avoiding a flat coloured
    // disc over the Sun itself.
    flare.addElement(new LensflareElement(ring1, 34, 0.58, new THREE.Color(0xd58a45)));
    flare.addElement(new LensflareElement(ring2, 22, 0.92, new THREE.Color(0x526b91)));
    flare.addElement(new LensflareElement(halo, 32, 1.25, new THREE.Color(0xc97c42)));
    flare.position.set(0, 0, 0);
    this.lensflare = flare;
    this.scene.add(flare);
  }

  _handleClick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    // Collect pickable meshes: planet meshes, rings, moons, sun proxy
    const targets = [];
    for (const p of this.planets) {
      targets.push(p.mesh);
      if (p.ringMesh) targets.push(p.ringMesh);
      for (const m of p.moons) targets.push(m.mesh);
    }
    if (this.sunMesh) targets.push(this.sunMesh);

    const hits = this.raycaster.intersectObjects(targets, false);
    if (hits.length === 0) return;
    const hit = hits[0].object;
    const planet = hit.userData.planet;
    if (planet) {
      this.focusOn(planet.data.id);
      this._lastClicked = planet.data.id;
    } else if (hit === this.sunMesh) {
      this.focusOn('sun');
      this._lastClicked = 'sun';
    }
  }

  _handleKey(e) {
    // Number keys 1-9 focus on planets, 0 focuses on the sun
    if (e.key >= '0' && e.key <= '9') {
      const n = Number(e.key);
      if (n === 0) {
        this.focusOn('sun');
      } else if (this.focusableBodies[n]) {
        this.focusOn(this.focusableBodies[n].id);
      }
    } else if (e.key === 'Escape') {
      this.clearFocus();
    } else if (e.key === ' ') {
      e.preventDefault();
      this.setPaused(!this.paused);
      this._onTogglePause?.(this.paused);
    }
  }

  // --- Public API used by React components -------------------------------
  focusOn(id) {
    const body = this.focusableBodies.find((b) => b.id === id);
    if (!body) return;
    this.focusTarget = body;
    this._focusTransitioning = true;
    this._focusProgress = 0;
    this._focusStartCam.copy(this.camera.position);
    this._focusStartTarget.copy(this.controls.target);
    // Desired offset = current viewing direction * (radius * factor + padding)
    body.getWorldPosition(this._tmpV);
    const dir = this._tmpV2.copy(this._focusStartCam).sub(this._focusStartTarget).normalize();
    const desiredDist = Math.max(body.radius * 6 + 10, 25);
    this._focusDesiredOffset.copy(dir).multiplyScalar(desiredDist);
    this._focusDistance = desiredDist;
    this._onFocus?.(body);
  }

  clearFocus() {
    this.focusTarget = null;
    this._focusTransitioning = false;
    this._onFocus?.(null);
  }

  resetCamera() {
    this.focusTarget = null;
    this._focusTransitioning = false;
    // Smoothly return to the default overview position
    this._resetting = true;
    this._resetStart = this.camera.position.clone();
    this._resetStartTarget = this.controls.target.clone();
    this._resetProgress = 0;
    this._onFocus?.(null);
  }

  setSpeed(speed) {
    this.timeSpeed = speed;
  }

  setPaused(paused) {
    this.paused = paused;
  }

  setOrbitsVisible(v) {
    // Orbit guides were intentionally removed for a cleaner, realistic view.
  }

  setBeltsVisible(v) {
    if (this.asteroidBelt) this.asteroidBelt.visible = v;
    if (this.kuiperBelt) this.kuiperBelt.visible = v;
  }

  setStarsVisible(v) {
    if (this.starField) this.starField.visible = v;
    if (this.galaxies) this.galaxies.visible = v;
    if (this.nebulae) this.nebulae.visible = v;
  }

  setCinematic(v) {
    if (this.cinematic) this.cinematic.enabled = v;
  }

  setLabelsVisible(v) {
    const el = document.getElementById('labels');
    if (el) el.style.display = v ? 'block' : 'none';
  }

  onLoadingProgress(cb) {
    this._onLoadingProgress = cb;
  }

  onLoad(cb) {
    this._onLoad = cb;
  }

  onFocus(cb) {
    this._onFocus = cb;
  }

  onTogglePause(cb) {
    this._onTogglePause = cb;
  }

  // --- Per-frame update --------------------------------------------------
  render() {
    const delta = Math.min(this.clock.getDelta(), 0.1);
    const t = this.clock.getElapsedTime();

    if (!this.paused) {
      for (const p of this.planets) p.update(delta, this.timeSpeed);
      if (this.sun && this.sun.userData.update) {
        this.sun.userData.update(t, delta, this.timeSpeed);
      }
      if (this.starField.userData.update) this.starField.userData.update(t);
      if (this.galaxies.userData.update) this.galaxies.userData.update(t, delta);
      if (this.nebulae.userData.update) this.nebulae.userData.update(t);
      if (this.asteroidBelt.userData.update) this.asteroidBelt.userData.update(delta, this.timeSpeed);
      if (this.kuiperBelt.userData.update) this.kuiperBelt.userData.update(delta, this.timeSpeed);
      if (this.comets.userData.update) this.comets.userData.update(delta, this.timeSpeed);
    }

    // Always animate background gently even when paused? Keep paused = full pause.

    // Camera follow / focus transition
    this._updateCamera(delta);

    this.controls.update();

    // God rays: project sun position to screen space
    this._sunScreen.set(0, 0, 0).project(this.camera);
    const sx = (this._sunScreen.x + 1) * 0.5;
    const sy = (this._sunScreen.y + 1) * 0.5;
    const inFront = this._sunScreen.z < 1;
    if (this.godRays) {
      this.godRays.uniforms.uSunPos.value.set(sx, sy);
      this.godRays.uniforms.uTime.value = t;
      // Fade rays out when the sun is behind the camera or off-screen
      const off = Math.max(0, 1 - Math.abs(sx - 0.5) * 2) * Math.max(0, 1 - Math.abs(sy - 0.5) * 2);
      this.godRays.uniforms.uSunVisible.value = inFront ? off : 0;
    }
    if (this.cinematic) {
      this.cinematic.material.uniforms.uTime.value = t;
    }

    this.stats.update();
    this.composer.render(delta);
    this.labelRenderer.render(this.scene, this.camera);
  }

  _updateCamera(delta) {
    if (this.focusTarget) {
      this.focusTarget.getWorldPosition(this._tmpV);
      if (this._focusTransitioning) {
        // Smoothly move camera + target into position over ~0.8s
        this._focusProgress = Math.min(1, this._focusProgress + delta / 0.8);
        const k = easeInOutCubic(this._focusProgress);
        const desiredTarget = this._tmpV;
        const desiredCam = this._tmpV2.copy(this._tmpV).add(this._focusDesiredOffset);
        this.controls.target.lerpVectors(this._focusStartTarget, desiredTarget, k);
        this.camera.position.lerpVectors(this._focusStartCam, desiredCam, k);
        if (this._focusProgress >= 1) {
          this._focusTransitioning = false;
        }
      } else {
        // Follow the body: keep the target locked, let user orbit around it.
        // Preserve the camera's current relative offset so orbit feels natural.
        this.controls.target.copy(this._tmpV);
      }
    } else if (this._resetting) {
      this._resetProgress = Math.min(1, this._resetProgress + delta / 0.9);
      const k = easeInOutCubic(this._resetProgress);
      this.controls.target.lerpVectors(this._resetStartTarget, new THREE.Vector3(0, 0, 0), k);
      this.camera.position.lerpVectors(this._resetStart, new THREE.Vector3(0, 120, 320), k);
      if (this._resetProgress >= 1) this._resetting = false;
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this._fx.setSize(window.innerWidth, window.innerHeight);
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
  }
}

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
