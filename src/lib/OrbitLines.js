import * as THREE from 'three';

// Draws orbit rings as thin line loops. Cheap, toggleable, and they help the
// viewer understand the geometry of the system.

const orbitMat = new THREE.LineBasicMaterial({
  color: 0x4a6a8a,
  transparent: true,
  opacity: 0.35,
  depthWrite: false,
});

export function createOrbitLine(radius, segments = 256, color = 0x4a6a8a, opacity = 0.35) {
  const r = Math.max(0.01, radius);
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = orbitMat.clone();
  mat.color = new THREE.Color(color);
  mat.opacity = opacity;
  return new THREE.LineLoop(geo, mat);
}

// Create a faint elliptical orbit for comets (semi-major a, eccentricity e).
export function createEllipseLine(a, e, segments = 256, color = 0x3a5a7a, opacity = 0.18) {
  const aa = Math.max(0.01, a);
  const b = aa * Math.sqrt(Math.max(0, 1 - e * e));
  const center = -aa * e; // shift so the sun (origin) is at a focus
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(center + aa * Math.cos(t), 0, b * Math.sin(t)));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = orbitMat.clone();
  mat.color = new THREE.Color(color);
  mat.opacity = opacity;
  return new THREE.LineLoop(geo, mat);
}
