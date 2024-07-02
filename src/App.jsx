import { useEffect } from 'react';

import * as THREE from 'three';

import SceneInit from './lib/SceneInit';

function App() {
  useEffect(() => {
    const solarSystem = new SceneInit('myThreeJsCanvas');
    solarSystem.initialize();
    solarSystem.animate();

    const axesHelper = new THREE.AxesHelper(16);
    solarSystem.scene.add(axesHelper);

    const sunTexture = new THREE.TextureLoader().load('./assets/sun.jpeg');
    const mercuryTexture = new THREE.TextureLoader().load(
      './assets/mercury.jpg'
    );
    const venusTexture = new THREE.TextureLoader().load('./assets/venus.jpg');
    const moonTexture = new THREE.TextureLoader().load('./assets/moon.jpeg');
    const earthTexture = new THREE.TextureLoader().load('./assets/earth.jpeg');
    const marsTexture = new THREE.TextureLoader().load('./assets/mars.jpg');
    const jupiterTexture = new THREE.TextureLoader().load(
      './assets/jupiter.jpg'
    );
    const saturnTexture = new THREE.TextureLoader().load('./assets/saturn.jpg');
    const saturnRingTexture = new THREE.TextureLoader().load(
      './assets/saturn_ring.png'
    );
    const uranusTexture = new THREE.TextureLoader().load('./assets/uranus.jpg');
    const neptuneTexture = new THREE.TextureLoader().load(
      './assets/neptune.jpg'
    );

    const solarSystemGroup = new THREE.Group();

    const sunGeometry = new THREE.SphereGeometry(20);
    const sunMaterial = new THREE.MeshStandardMaterial({
      map: sunTexture,
    });
    const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
    solarSystemGroup.add(sunMesh);
    solarSystem.scene.add(solarSystemGroup);

    const mercuryOrbit = new THREE.Group();
    const mercuryGeometry = new THREE.SphereGeometry(2);
    const mercuryMaterial = new THREE.MeshStandardMaterial({
      map: mercuryTexture,
    });
    const mercuryMesh = new THREE.Mesh(mercuryGeometry, mercuryMaterial);
    mercuryOrbit.add(mercuryMesh);
    mercuryMesh.position.x = 45;
    solarSystem.scene.add(mercuryOrbit);

    const venusOrbit = new THREE.Group();
    const venusGeometry = new THREE.SphereGeometry(3);
    const venusMaterial = new THREE.MeshStandardMaterial({
      map: venusTexture,
    });
    const venusMesh = new THREE.Mesh(venusGeometry, venusMaterial);
    venusOrbit.add(venusMesh);
    venusMesh.position.x = 80;
    solarSystem.scene.add(venusOrbit);

    const earthOrbit = new THREE.Group();
    const earthGeometry = new THREE.SphereGeometry(4);
    const earthMaterial = new THREE.MeshStandardMaterial({
      map: earthTexture,
    });
    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    earthMesh.position.x = 115;
    earthOrbit.add(earthMesh);
    solarSystem.scene.add(earthOrbit);

    const moonOrbit = new THREE.Group();
    const moonGeometry = new THREE.SphereGeometry(1);
    const moonMaterial = new THREE.MeshStandardMaterial({
      map: moonTexture,
    });
    const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
    moonOrbit.add(moonMesh);
    moonOrbit.position.x = 115;
    moonMesh.position.x = 7;
    earthOrbit.add(moonOrbit);

    const marsOrbit = new THREE.Group();
    const marsGeometry = new THREE.SphereGeometry(3);
    const marsMaterial = new THREE.MeshStandardMaterial({
      map: marsTexture,
    });
    const marsMesh = new THREE.Mesh(marsGeometry, marsMaterial);
    marsOrbit.add(marsMesh);
    marsMesh.position.x = 185;
    solarSystem.scene.add(marsOrbit);

    const jupiterOrbit = new THREE.Group();
    const jupiterGeometry = new THREE.SphereGeometry(10);
    const jupiterMaterial = new THREE.MeshStandardMaterial({
      map: jupiterTexture,
    });
    const jupiterMesh = new THREE.Mesh(jupiterGeometry, jupiterMaterial);
    jupiterOrbit.add(jupiterMesh);
    jupiterMesh.position.x = 220;
    solarSystem.scene.add(jupiterOrbit);

    const saturnOrbit = new THREE.Group();
    const saturnGeometry = new THREE.SphereGeometry(5);
    const saturnMaterial = new THREE.MeshStandardMaterial({
      map: saturnTexture,
    });
    const saturnMesh = new THREE.Mesh(saturnGeometry, saturnMaterial);
    
    saturnOrbit.add(saturnMesh);
    saturnMesh.position.x = 255;
    solarSystem.scene.add(saturnOrbit);

    const saturnRingOrbit = new THREE.Group();
    const saturnRingGeometry = new THREE.TorusGeometry(10, 1.8, 2, 200); // Ajuste dos parâmetros conforme necessário
    const saturnRingMaterial = new THREE.MeshBasicMaterial({
      map:saturnRingTexture
    });
    const saturnRingMesh = new THREE.Mesh(saturnRingGeometry, saturnRingMaterial);
    saturnRingMesh.rotation.x = Math.PI / 2;
    saturnRingOrbit.add(saturnRingMesh);
    saturnRingOrbit.position.x = 255;

    saturnOrbit.add(saturnRingOrbit);

    const uranusOrbit = new THREE.Group();
    const uranusGeometry = new THREE.SphereGeometry(6);
    const uranusMaterial = new THREE.MeshStandardMaterial({
      map: uranusTexture,
    });
    const uranusMesh = new THREE.Mesh(uranusGeometry, uranusMaterial);
    uranusOrbit.add(uranusMesh);
    uranusMesh.position.x = 325;
    solarSystem.scene.add(uranusOrbit);

    const neptuneOrbit = new THREE.Group();
    const neptuneGeometry = new THREE.SphereGeometry(7);
    const neptuneMaterial = new THREE.MeshStandardMaterial({
      map: neptuneTexture,
    });
    const neptuneMesh = new THREE.Mesh(neptuneGeometry, neptuneMaterial);
    neptuneOrbit.add(neptuneMesh);
    neptuneMesh.position.x = 360;
    solarSystem.scene.add(neptuneOrbit);


    moonOrbit.rotation.y += 0.01;
    mercuryOrbit.rotation.y += 0.008;
    venusOrbit.rotation.y += 0.005;
    earthOrbit.rotation.y += 0.003;
    marsOrbit.rotation.y += 0.002;
    jupiterOrbit.rotation.y += 0.1;
    saturnOrbit.rotation.y += 0.2;
    saturnRingOrbit.rotation.y += 0.3;
    uranusOrbit.rotation.y += 0.5;

    neptuneOrbit.rotation.y += 0.0001;

    const animate = () => {
      sunMesh.rotation.y += 0.003;
      moonOrbit.rotation.y += 0.01;
      moonMesh.rotation.y += 0.01;
      moonMesh.rotation.x += 0.007;
      mercuryOrbit.rotation.y += 0.008;
      mercuryMesh.rotation.y += 0.01;
      mercuryMesh.rotation.x += 0.007;
      venusOrbit.rotation.y += 0.005;
      venusMesh.rotation.y += 0.01;
      venusMesh.rotation.x += 0.007;
      earthOrbit.rotation.y += 0.003;
      earthMesh.rotation.y += 0.01;
      earthMesh.rotation.x += 0.007;
      marsOrbit.rotation.y += 0.002;
      marsMesh.rotation.y += 0.01;
      marsMesh.rotation.x += 0.007;
      jupiterOrbit.rotation.y += 0.001;
      jupiterMesh.rotation.y += 0.01;
      jupiterMesh.rotation.x += 0.007;
      saturnOrbit.rotation.y += 0.0006;
      saturnMesh.rotation.y += 0.01;
      saturnMesh.rotation.x += 0.007;
      saturnRingOrbit.rotation.y += 0.01;
      uranusOrbit.rotation.y += 0.0003;
      uranusMesh.rotation.y += 0.01;
      uranusMesh.rotation.x += 0.007;
      neptuneOrbit.rotation.y += 0.0001;
      neptuneMesh.rotation.y += 0.01;
      neptuneMesh.rotation.x += 0.007;
      window.requestAnimationFrame(animate);
    };
    animate();
  }, []);

  return (
    <div>
      <canvas id="myThreeJsCanvas" />
    </div>
  );
}

export default App;
