import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { SUN_RADIUS, PLANET_DATA } from './planetData';
import { Planet, getTexture } from './Planet';
import { createStarField } from './StarField';
import { createPostFX } from './PostFX';

const TEXTURE_BASE = '/textures/';
function url(filename) {
  return TEXTURE_BASE + filename;
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

    this.fov = 55;
    this.nearPlane = 0.5;
    this.farPlane = 4000;

    this.clock = undefined;
    this.stats = undefined;
    this.controls = undefined;
    this.sunLight = undefined;
    this.ambient = undefined;

    this.planets = [];
    this.timeSpeed = 1;
    this.paused = false;
    this._onLoadingProgress = undefined;
  }

  initialize() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000005);

    this.camera = new THREE.PerspectiveCamera(
      this.fov,
      window.innerWidth / window.innerHeight,
      this.nearPlane,
      this.farPlane
    );
    this.camera.position.set(0, 70, 200);

    const canvas = document.getElementById(this.canvasId);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
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
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 20;
    this.controls.maxDistance = 800;
    this.controls.target.set(0, 0, 0);

    this.stats = Stats();
    this.stats.dom.style.position = 'absolute';
    this.stats.dom.style.top = '8px';
    this.stats.dom.style.left = '8px';
    this.stats.dom.style.opacity = '0.6';
    document.body.appendChild(this.stats.dom);

    this.ambient = new THREE.HemisphereLight(0xffffff, 0x101030, 0.06);
    this.scene.add(this.ambient);

    this._buildSun();

    this.sunLight = new THREE.PointLight(0xfff2d6, 3.0, 0, 0);
    this.sunLight.position.set(0, 0, 0);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 600;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    const stars = createStarField({ count: 5000, radius: 1800 });
    this.scene.add(stars);

    const manager = new THREE.LoadingManager();
    manager.onProgress = (url, loaded, total) => {
      this._onLoadingProgress?.(loaded / total);
    };
    this._manager = manager;

    for (const data of PLANET_DATA) {
      const planet = new Planet(data, this.sun, manager);
      this.planets.push(planet);
      this.scene.add(planet.root);
    }

    window.addEventListener('resize', () => this.onWindowResize(), false);

    const { composer, bloom } = createPostFX(this.renderer, this.scene, this.camera);
    this.composer = composer;
    this.bloom = bloom;
  }

  _buildSun() {
    const sunGroup = new THREE.Group();
    sunGroup.name = 'sun';

    const sunGeo = new THREE.SphereGeometry(SUN_RADIUS, 64, 64);
    const sunMat = new THREE.MeshBasicMaterial({
      map: getTexture(url('sun.jpg'), this._manager),
    });
    this.sun = new THREE.Mesh(sunGeo, sunMat);
    this.sun.castShadow = false;
    this.sun.receiveShadow = false;
    sunGroup.add(this.sun);

    const glowGeo = new THREE.SphereGeometry(SUN_RADIUS * 1.4, 64, 64);
    const glowMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0xffb84d) } },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        uniform vec3 uColor;
        void main() {
          float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.0);
          gl_FragColor = vec4(uColor * fresnel * 1.6, fresnel * 0.9);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.name = 'sun-glow';
    sunGroup.add(glow);

    this.scene.add(sunGroup);
  }

  setSpeed(speed) {
    this.timeSpeed = speed;
  }

  setPaused(paused) {
    this.paused = paused;
  }

  onLoadingProgress(cb) {
    this._onLoadingProgress = cb;
  }

  render() {
    const delta = Math.min(this.clock.getDelta(), 0.1);
    if (!this.paused) {
      for (const p of this.planets) p.update(delta, this.timeSpeed);
      this.sun.rotation.y += delta * 0.05 * this.timeSpeed;
    }
    this.controls.update();
    this.stats.update();
    this.composer.render(delta);
    this.labelRenderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
  }
}
