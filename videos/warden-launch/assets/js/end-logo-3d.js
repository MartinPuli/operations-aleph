/* One physical Warden symbol, extruded from the official SVG contours.
 * The host owns the background and typography. renderAt takes OUTPUT seconds.
 * Every pose and lighting cue is seek-safe; there is no running animation loop. */
(function (global) {
  'use strict';

  global.createWardenEndLogo = function ({ THREE: T, canvas, width = 1920, height = 1080 }) {
    if (!Array.isArray(global.WARDEN_SYMBOL_PATHS) || global.WARDEN_SYMBOL_PATHS.length !== 2) {
      throw new Error('Load brand-paths.js before the Warden end logo.');
    }

    const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(35, width / height, 1, 5000);
    camera.position.set(0, 0, 1080 / (2 * Math.tan(35 * Math.PI / 360)));
    camera.lookAt(0, 0, 0);
    const hero = new T.Group();
    scene.add(hero);
    const clamp = n => Math.max(0, Math.min(1, n));
    const smooth = n => { const p = clamp(n); return p * p * (3 - 2 * p); };
    const mix = (a, b, p) => a + (b - a) * p;

    // Absolute M/L/C/Z contours only: preserve the official curves, never replace
    // the mark with a generic shield, a texture plane, or an approximate W.
    const unit = 638 / (869.477 - 473.076);
    function officialContours(svg) {
      const tokens = svg.match(/[MLCZmlcz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g);
      const paths = [];
      let i = 0, path;
      const point = () => [
        (Number(tokens[i++]) - 535.75) * unit,
        (671.2765 - Number(tokens[i++])) * unit
      ];
      while (i < tokens.length) {
        const command = tokens[i++];
        if (command === 'M') {
          path = new T.Shape(); paths.push(path); path.moveTo(...point());
        } else if (command === 'L') path.lineTo(...point());
        else if (command === 'C') path.bezierCurveTo(...point(), ...point(), ...point());
        else if (command === 'Z' || command === 'z') path.closePath();
        else throw new Error(`Unsupported official symbol command: ${command}`);
      }
      return paths;
    }
    const ringContours = officialContours(global.WARDEN_SYMBOL_PATHS[0]);
    const letterContours = officialContours(global.WARDEN_SYMBOL_PATHS[1]);
    if (ringContours.length !== 2 || letterContours.length !== 1) throw new Error('Unexpected Warden symbol contours.');
    const ringShape = ringContours[0];
    ringShape.holes.push(ringContours[1]);

    const silverFace = new T.MeshPhysicalMaterial({
      color: 0xd9e9e0, metalness: .91, roughness: .22,
      clearcoat: .38, clearcoatRoughness: .16, envMapIntensity: 1.22
    });
    const mintEdge = new T.MeshPhysicalMaterial({
      color: 0x477b6e, metalness: .86, roughness: .25,
      clearcoat: .24, clearcoatRoughness: .15, envMapIntensity: 1.1
    });
    const letterFace = new T.MeshPhysicalMaterial({
      color: 0xc1eed6, metalness: .87, roughness: .20,
      clearcoat: .42, clearcoatRoughness: .13, envMapIntensity: 1.24
    });
    function extrude(shape, depth, bevelSize, bevelThickness, faceMaterial, z) {
      const geometry = new T.ExtrudeGeometry(shape, {
        depth, curveSegments: 40, steps: 1,
        bevelEnabled: true, bevelSegments: 8, bevelSize, bevelThickness,
        material: 0, extrudeMaterial: 1
      });
      geometry.translate(0, 0, z);
      geometry.computeBoundingBox();
      const mesh = new T.Mesh(geometry, [faceMaterial, mintEdge]);
      hero.add(mesh);
      return mesh;
    }
    const ring = extrude(ringShape, 62, 7, 10, silverFace, -31);
    const letter = extrude(letterContours[0], 43, 5.3, 8, letterFace, -12);

    // A local HDR studio gives the bevels actual reflected light. The environment
    // is generated once; neither network assets nor new PMREMs are needed per frame.
    const studio = new T.Scene();
    studio.background = new T.Color(0x0d1821);
    function softbox(position, boxWidth, boxHeight, color, intensity) {
      const material = new T.MeshBasicMaterial({ color, side: T.DoubleSide });
      material.color.multiplyScalar(intensity);
      const light = new T.Mesh(new T.PlaneGeometry(boxWidth, boxHeight), material);
      light.position.set(...position); light.lookAt(0, 0, 0); studio.add(light);
    }
    softbox([-5, 4, 7], 3.1, 10, 0xffffff, 4.0);
    softbox([5, 1, 4], 1.35, 9, 0xc9ffe0, 3.0);
    softbox([0, 7, 2], 10, 1.8, 0xe4edff, 4.4);
    softbox([-2, -5, 3], 6, 1.0, 0xb6dbc7, 1.4);
    softbox([3, 3, -5], 2.0, 9, 0xbdceec, 2.5);
    const pmrem = new T.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(studio, .02, .1, 60);
    scene.environment = environment.texture;
    pmrem.dispose();
    studio.traverse(node => { if (node.isMesh) { node.geometry.dispose(); node.material.dispose(); } });

    scene.add(new T.HemisphereLight(0xf1f8f5, 0x0b1820, .58));
    const key = new T.DirectionalLight(0xffffff, 2.4);
    key.position.set(-600, 850, 1200); scene.add(key);
    const rim = new T.DirectionalLight(0xa7d6c8, 2.0);
    rim.position.set(1100, 250, -700); scene.add(rim);
    const sweepLight = new T.PointLight(0xe1fff0, 0, 0, 2);
    scene.add(sweepLight);

    function renderAt(outputTime) {
      const t = Number.isFinite(outputTime) ? outputTime : 24.1;
      const intro = smooth((t - 24.1) / .65);
      // Preserve the original metal turn. Position and scale now form a brand
      // lockup: 100 ms anticipation, 150 ms fast travel, then a 320 ms tail.
      const settle = Math.sin(Math.PI * intro) * Math.sin(Math.PI * 1.7 * intro) * .032;
      hero.visible = t >= 24.1;
      const anticipation = smooth((t - 24.1) / .10);
      const travelTime = clamp((t - 24.2) / .47);
      const travel = 1 - (1 - travelTime) ** 3;
      const launchX = -28.56444 + 18 * anticipation;
      const launchY = 69.31765 + 8 * anticipation;
      const launchScale = 1.17324759 * (1 + .015 * anticipation);
      hero.position.set(mix(launchX, -464.30825, travel), mix(launchY, 169.75097, travel), 0);
      hero.scale.setScalar(mix(launchScale, .69496079, travel));
      hero.rotation.set(mix(.14, .055, intro), mix(-1.34, -.29, intro) + settle, mix(-.15, -.025, intro));

      // One soft reflected-light passage after the object has settled. Its final
      // environment orientation stays put; there is no return pass or late reset.
      const sweep = smooth((t - 25.25) / 1.30);
      scene.environmentRotation.set(0, mix(-.14, -.44, sweep), 0);
      sweepLight.position.set(460 + mix(-750, 720, sweep), mix(480, -120, sweep), 700);
      sweepLight.intensity = t >= 25.25 && t <= 26.55 ? Math.sin(Math.PI * sweep) ** 2 * 350000 : 0;
      renderer.render(scene, camera);
    }

    function projectedBounds() {
      hero.updateMatrixWorld(true);
      const box = new T.Box3().setFromObject(hero), pixels = [];
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const point = new T.Vector3(x, y, z).project(camera);
        pixels.push([(point.x * .5 + .5) * width, (.5 - point.y * .5) * height]);
      }
      return { left: Math.min(...pixels.map(p => p[0])), right: Math.max(...pixels.map(p => p[0])), top: Math.min(...pixels.map(p => p[1])), bottom: Math.max(...pixels.map(p => p[1])) };
    }
    function dispose() {
      ring.geometry.dispose(); letter.geometry.dispose();
      silverFace.dispose(); letterFace.dispose(); mintEdge.dispose();
      environment.dispose(); renderer.dispose();
    }
    return { renderAt, projectedBounds, dispose, renderer, scene, camera, hero,
      geometryInfo: { source: 'WARDEN_SYMBOL_PATHS', ringHoles: 1, extrudedContours: 3 } };
  };
})(window);
