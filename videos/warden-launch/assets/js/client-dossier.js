/* Original, synthetic client dossier. Geometry is centered, front faces +Z.
   This asset owns no renderer, network requests or animation clock. */
(function (global) {
  'use strict';
  global.createWardenClientDossier = function ({ THREE: T, fontFamily = 'WardenDisplay' }) {
    const root = new T.Group();
    root.name = 'Client dossier — illustrative record';
    const palette = { cream: 0xf6f0e3, navy: 0x17244d, coral: 0xfa795e, metal: 0xc8b697 };
    const paper = new T.MeshPhysicalMaterial({ color: palette.cream, roughness: .75, metalness: .01 });
    const edgePaper = new T.MeshPhysicalMaterial({ color: 0xddd4c2, roughness: .77 });
    const cover = new T.MeshPhysicalMaterial({ color: palette.navy, roughness: .32, metalness: .25, clearcoat: .45 });
    const coral = new T.MeshPhysicalMaterial({ color: palette.coral, roughness: .26, metalness: .22, clearcoat: .5, emissive: palette.coral, emissiveIntensity: .04 });

    function roundedShape(w, h, r) {
      const s = new T.Shape(), x = -w / 2, y = -h / 2;
      s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
      s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
      s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
      return s;
    }
    function slab(parent, w, h, depth, mat, xyz, radius = .04) {
      const bevel = Math.min(depth * .2, .015);
      const geometry = new T.ExtrudeGeometry(roundedShape(w, h, radius), {
        depth: depth - 2 * bevel, bevelEnabled: true, bevelThickness: bevel,
        bevelSize: bevel, bevelSegments: 3, steps: 1, curveSegments: 12
      });
      geometry.center();
      const mesh = new T.Mesh(geometry, mat); mesh.position.set(...xyz);
      mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    }
    // Navy folder and individually visible paper edges are actual geometry.
    slab(root, 6.86, 5.64, .055, cover, [0, -.015, -.135], .08);
    for (let i = 0; i < 6; i++) {
      slab(root, 6.78, 5.54, .018, i % 2 ? paper : edgePaper,
        [.006 * i, -.009 * i, -.100 + .019 * i], .035);
    }
    slab(root, 6.8, 5.56, .032, paper, [0, 0, .025], .045);

    const canvas = document.createElement('canvas'); canvas.width = 2040; canvas.height = 1680;
    const c = canvas.getContext('2d');
    const ink = '#17244d', muted = '#6b6d79', cream = '#f6f0e3', orange = '#fa795e';
    function text(str, x, y, size, fill = ink, weight = 550) {
      c.font = `${weight} ${size}px ${fontFamily}, sans-serif`; c.fillStyle = fill; c.fillText(str, x, y);
    }
    function roundRect(x, y, w, h, r, fill) {
      c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill();
    }
    c.fillStyle = cream; c.fillRect(0, 0, 2040, 1680);
    c.fillStyle = ink; c.fillRect(0, 0, 2040, 337);
    // Solid geometric folio icon, visibly a record rather than a generic card.
    c.strokeStyle = '#e1e5f1'; c.lineWidth = 9; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(112, 85); c.lineTo(190, 85); c.lineTo(225, 122); c.lineTo(225, 240); c.lineTo(112, 240); c.closePath(); c.stroke();
    c.beginPath(); c.moveTo(188, 87); c.lineTo(188, 124); c.lineTo(224, 124); c.moveTo(139, 166); c.lineTo(198, 166); c.moveTo(139, 197); c.lineTo(182, 197); c.stroke();
    text('CLIENT RECORD', 295, 171, 105, '#f6f0e3', 680);
    text('CLIENT 014', 301, 262, 54, '#c3cbe0', 520);
    // The front of the raised confidentiality tab is mapped separately below.
    roundRect(119, 423, 482, 562, 28, '#d4dae9');
    c.save(); c.beginPath(); c.roundRect(119, 423, 482, 562, 28); c.clip();
    // Vector portrait: deliberate silhouette, jacket, collar and simple face.
    c.fillStyle = '#b4bfd4'; c.beginPath(); c.arc(360, 650, 214, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#263b63'; c.beginPath(); c.moveTo(116, 985); c.bezierCurveTo(116, 862, 231, 788, 361, 788); c.bezierCurveTo(492, 788, 602, 862, 604, 985); c.closePath(); c.fill();
    c.fillStyle = '#c78e71'; c.fillRect(321, 735, 79, 111);
    c.fillStyle = '#e9b593'; c.beginPath(); c.ellipse(359, 644, 112, 142, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#333142'; c.beginPath(); c.moveTo(248, 657); c.bezierCurveTo(203, 469, 462, 448, 478, 629); c.lineTo(449, 660); c.lineTo(436, 558); c.bezierCurveTo(382, 597, 320, 565, 281, 600); c.lineTo(270, 674); c.closePath(); c.fill();
    c.strokeStyle = '#845945'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(308, 649); c.lineTo(326, 649); c.moveTo(390, 649); c.lineTo(408, 649); c.moveTo(340, 724); c.quadraticCurveTo(360, 737, 382, 724); c.stroke();
    c.fillStyle = '#f9f4e9'; c.beginPath(); c.moveTo(315, 800); c.lineTo(361, 853); c.lineTo(405, 800); c.lineTo(398, 985); c.lineTo(321, 985); c.closePath(); c.fill();
    c.fillStyle = '#54709a'; c.beginPath(); c.moveTo(316, 800); c.lineTo(361, 853); c.lineTo(305, 888); c.lineTo(266, 812); c.closePath(); c.moveTo(405, 800); c.lineTo(361, 853); c.lineTo(419, 888); c.lineTo(456, 812); c.closePath(); c.fill(); c.restore();

    text('Alex Morgan', 698, 568, 148, ink, 650);
    text('CLIENT CONTACT', 706, 684, 46, muted, 650);
    text('alex@client.example', 703, 789, 86, ink, 570);
    c.strokeStyle = '#d7d2c8'; c.lineWidth = 3; c.beginPath(); c.moveTo(708, 839); c.lineTo(1914, 839); c.stroke();
    text('PRIVATE CLIENT INFORMATION', 706, 930, 43, muted, 570);
    roundRect(118, 1080, 919, 349, 26, '#e6e3da');
    roundRect(1084, 1080, 838, 349, 26, '#e6e3da');
    text('CONTRACT VALUE', 159, 1162, 45, muted, 650);
    text('$240,000', 156, 1340, 145, ink, 680);
    text('BANK ACCOUNT', 1125, 1162, 45, muted, 650);
    text('•••• 4821', 1123, 1340, 116, ink, 630);
    text('INTERNAL NOTES', 128, 1530, 43, muted, 650);
    text('Pricing terms · renewal strategy', 129, 1610, 57, ink, 500);

    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 8;
    const faceMaterial = new T.MeshBasicMaterial({ map: texture, toneMapped: false });
    const face = new T.Mesh(new T.PlaneGeometry(6.77, 5.535), faceMaterial); face.position.z = .045; root.add(face);

    // A physical foil tab overhangs the top sheet; typography remains crisp.
    const seal = new T.Group(); seal.name = 'Raised CONFIDENTIAL tab'; root.add(seal);
    seal.position.set(2.535, 2.595, .087);
    slab(seal, 1.82, .52, .075, coral, [0, 0, 0], .045);
    const sealCanvas = document.createElement('canvas'); sealCanvas.width = 1100; sealCanvas.height = 300;
    const sc = sealCanvas.getContext('2d'); sc.fillStyle = '#17244d'; sc.font = `750 103px ${fontFamily}, sans-serif`;
    sc.textAlign = 'center'; sc.textBaseline = 'middle'; sc.fillText('CONFIDENTIAL', 550, 151);
    const sealTexture = new T.CanvasTexture(sealCanvas); sealTexture.colorSpace = T.SRGBColorSpace; sealTexture.anisotropy = 8;
    const sealFace = new T.Mesh(new T.PlaneGeometry(1.77, .48), new T.MeshBasicMaterial({ map: sealTexture, transparent: true, alphaTest: .01, depthWrite: false, toneMapped: false }));
    sealFace.position.z = .041; seal.add(sealFace);
    // One plain folder spine. The decorative clip jaws read as duplicate padlocks.
    slab(root, .07, 5.41, .09, cover, [-3.357, -.028, -.034], .018);

    const highlights = new T.Group(); highlights.name = 'Sensitive field callouts'; root.add(highlights);
    const frames = [];
    function highlight(name, x, y, w, h) {
      const g = new T.Group(); g.name = name; highlights.add(g);
      const mat = new T.MeshBasicMaterial({ color: palette.coral, transparent: true, opacity: 0, toneMapped: false, depthWrite: false });
      const outer = roundedShape(w, h, .09), inner = roundedShape(w - .055, h - .055, .07);
      const hole = new T.Path(inner.getPoints(20)); outer.holes.push(hole);
      const border = new T.Mesh(new T.ShapeGeometry(outer, 20), mat); border.position.z = .058; g.add(border);
      g.position.set(x, y, .003); frames.push({ g, mat });
      g.userData = { field: name, center: [x, y, .065], width: w, height: h };
      return g;
    }
    // Coordinates match the printed fields exactly, including oblique close-ups.
    highlights.contact = highlight('Client email', 1.0, .322, 4.23, .68);
    highlights.contract = highlight('Contract value', -1.474, -1.394, 3.06, 1.164);
    highlights.bank = highlight('Bank account', 1.62, -1.394, 2.792, 1.164);
    function setSensitiveFocus(value) {
      const a = Math.min(1, Math.max(0, Number(value) || 0));
      for (const frame of frames) { frame.mat.opacity = a; frame.g.visible = a > .001; }
      coral.emissiveIntensity = .04 + a * .25;
    }
    setSensitiveFocus(0);
    root.userData = {
      illustrative: true, dimensions: [6.98, 5.71, .30], front: '+Z',
      contactPoint: [1, .322, .065], contractPoint: [-1.474, -1.394, .065],
      portraitPoint: [-2.20, .45, .065]
    };
    return { root, highlights, seal, texture, setSensitiveFocus };
  };
})(window);
