// ── OBSTACLE BUILDERS ────────────────────────────────────────────────────────
// All obstacle factory functions. Each returns { mesh, r, h, type }.
// They rely on THREE (global) and srng() (from rng.js).

function buildBasket() {
  const g = new THREE.Group();
  // If a GLB override exists for "basket", load it asynchronously
  // and swap into g once loaded. g is returned immediately with procedural mesh.
  if (typeof loadModel === "function" && MODEL_OVERRIDES && MODEL_OVERRIDES.basket) {
    loadModel("basket", function(glbGroup) {
      if (!glbGroup) return;  // load failed — keep procedural
      while (g.children.length) g.remove(g.children[0]);
      g.add(glbGroup);
    });
  }
  const mPole  = new THREE.MeshPhongMaterial({ color: 0xbbbbbb, shininess: 80 });
  const mOrg   = new THREE.MeshPhongMaterial({ color: 0xff6600, shininess: 60 });
  const mYel   = new THREE.MeshPhongMaterial({ color: 0xffdd00, shininess: 60 });
  const mChain = new THREE.LineBasicMaterial({ color: 0xaaaaaa });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.044, 3.2, 10), mPole);
  pole.position.y = 1.6; pole.castShadow = true; g.add(pole);
  const topcap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 16), mPole);
  topcap.position.y = 3.22; g.add(topcap);
  const upRim = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.038, 8, 32), mOrg);
  upRim.rotation.x = Math.PI / 2; upRim.position.y = 2.92; upRim.castShadow = true; g.add(upRim);
  const loRim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.038, 8, 32), mYel);
  loRim.rotation.x = Math.PI / 2; loRim.position.y = 1.75; loRim.castShadow = true; g.add(loRim);

  const chainCount = 24;
  for (let i = 0; i < chainCount; i++) {
    const a = (i / chainCount) * Math.PI * 2;
    const px = Math.cos(a), pz = Math.sin(a);
    const sag = 0.3 + Math.random() * 0.4;
    const pts = [];
    for (let s = 0; s <= 8; s++) {
      const t2 = s / 8;
      const cx = px * (0.44 - t2 * (0.44 - 0.36));
      const cz = pz * (0.44 - t2 * (0.44 - 0.36));
      const cy = 2.92 - t2 * (2.92 - 1.75) - Math.sin(t2 * Math.PI) * sag;
      pts.push(new THREE.Vector3(cx, cy, cz));
    }
    const chainGeo = new THREE.BufferGeometry().setFromPoints(pts);
    g.add(new THREE.Line(chainGeo, mChain));
  }
  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.3, 0.35, 16, 1, true),
    new THREE.MeshPhongMaterial({ color: 0xffcc44, side: THREE.DoubleSide, transparent: true, opacity: 0.18 })
  );
  cup.position.y = 1.58; g.add(cup);
  const glow = new THREE.PointLight(0xffaa44, 0.7, 4);
  glow.position.y = 1.8; g.add(glow);
  return g;
}

function buildTractor() {
  const g = new THREE.Group();
  const mRed   = new THREE.MeshLambertMaterial({ color: 0xcc1122 });
  const mBlk   = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const mGrey  = new THREE.MeshLambertMaterial({ color: 0x888888 });
  const mYel   = new THREE.MeshLambertMaterial({ color: 0xffdd00 });
  const mGlass = new THREE.MeshLambertMaterial({ color: 0x88ccff, transparent: true, opacity: 0.5 });
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 4.2), mRed);
  chassis.position.set(0, 1.5, 0); chassis.castShadow = true; g.add(chassis);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 1.8), mRed);
  hood.position.set(0, 1.85, 1.8); hood.castShadow = true; g.add(hood);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.6, 1.8), mRed);
  cab.position.set(0, 2.85, -0.8); cab.castShadow = true; g.add(cab);
  const winF = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.06), mGlass);
  winF.position.set(0, 2.95, 0.11); g.add(winF);
  const winR = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.06), mGlass);
  winR.position.set(0, 2.95, -1.71); g.add(winR);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.18, 1.9), mGrey);
  roof.position.set(0, 3.72, -0.8); roof.castShadow = true; g.add(roof);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.8, 8), mBlk);
  pipe.position.set(0.7, 3.2, 1.2); pipe.castShadow = true; g.add(pipe);
  const pipeCap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.1, 0.15, 8), mBlk);
  pipeCap.position.set(0.7, 4.05, 1.2); g.add(pipeCap);
  for (let side of [-1, 1]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.55, 16), mBlk);
    wheel.rotation.z = Math.PI / 2; wheel.position.set(side * 1.45, 1.0, -1.2); wheel.castShadow = true; g.add(wheel);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.58, 8), mGrey);
    hub.rotation.z = Math.PI / 2; hub.position.set(side * 1.5, 1.0, -1.2); g.add(hub);
    for (let t = 0; t < 8; t++) {
      const tr = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.96, 0.15), mGrey);
      tr.rotation.z = Math.PI / 2; tr.rotation.y = (t / 8) * Math.PI * 2;
      tr.position.set(side * 1.73, 1.0, -1.2); g.add(tr);
    }
    const fw = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 12), mBlk);
    fw.rotation.z = Math.PI / 2; fw.position.set(side * 1.28, 0.6, 1.5); fw.castShadow = true; g.add(fw);
    const fhub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.42, 8), mGrey);
    fhub.rotation.z = Math.PI / 2; fhub.position.set(side * 1.3, 0.6, 1.5); g.add(fhub);
  }
  for (let side of [-0.55, 0.55]) {
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), mYel);
    hl.position.set(side, 1.85, 2.72); g.add(hl);
  }
  const hitch = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), mBlk);
  hitch.position.set(0, 1.05, -2.2); g.add(hitch);
  return { mesh: g, r: 2.5, h: 4.2, type: "tractor" };
}

function buildAxeTarget() {
  const g = new THREE.Group();
  const mWood  = new THREE.MeshLambertMaterial({ color: 0x6b3a1f });
  const mRing  = new THREE.MeshLambertMaterial({ color: 0x4a2a10 });
  const mSteel = new THREE.MeshLambertMaterial({ color: 0x99bbcc });
  const mEdge  = new THREE.MeshLambertMaterial({ color: 0xddeeee });
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 1.2, 16), mWood);
  stump.position.y = 0.6; stump.castShadow = true; g.add(stump);
  for (let ri = 1; ri <= 3; ri++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(ri * 0.3, 0.04, 4, 16), mRing);
    ring.rotation.x = Math.PI / 2; ring.position.y = 1.21; g.add(ring);
  }
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 2.8, 10), mWood);
  handle.position.set(0.3, 2.6, 0); handle.rotation.z = -0.25; handle.castShadow = true; g.add(handle);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 0.72), mSteel);
  head.position.set(0.3, 3.7, 0); head.rotation.z = -0.25; head.castShadow = true; g.add(head);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.85, 0.72), mEdge);
  edge.position.set(0.42, 3.7, 0); edge.rotation.z = -0.25; g.add(edge);
  const poll = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.3), mSteel);
  poll.position.set(0.18, 3.7, 0); poll.rotation.z = -0.25; g.add(poll);
  const score = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 1.4), mRing);
  score.position.set(0, 1.22, 0); g.add(score);
  const score2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.08), mRing);
  score2.position.set(0, 1.22, 0); g.add(score2);
  return { mesh: g, r: 1.4, h: 4.2, type: "axe" };
}

function buildFurryTail(seed) {
  const g = new THREE.Group();
  const baseCol   = seed > 0.5 ? 0x00ffee : 0xff00dd;
  const accentCol = seed > 0.5 ? 0x0088bb : 0xaa0088;
  const mFur    = new THREE.MeshLambertMaterial({ color: baseCol });
  const mAccent = new THREE.MeshLambertMaterial({ color: accentCol });
  const mEye    = new THREE.MeshLambertMaterial({ color: 0xff3300 });
  const mNose   = new THREE.MeshLambertMaterial({ color: 0x220011 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), mFur);
  body.scale.y = 1.25; body.position.y = 1.0; body.castShadow = true; g.add(body);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const t = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5), i % 2 ? mFur : mAccent);
    t.position.set(Math.cos(a) * 0.88, 0.9 + Math.sin(a * 2) * 0.2, Math.sin(a) * 0.88); g.add(t);
  }
  const headM = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), mFur);
  headM.position.set(0, 2.3, 0.4); headM.castShadow = true; g.add(headM);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), mAccent);
  snout.scale.set(1, 0.7, 1.1); snout.position.set(0, 2.2, 0.88); g.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), mNose);
  nose.position.set(0, 2.28, 1.1); g.add(nose);
  for (let side of [-0.3, 0.3]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), mEye);
    eye.position.set(side, 2.45, 0.85); g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), mNose);
    pupil.position.set(side, 2.45, 0.97); g.add(pupil);
  }
  for (let side of [-0.45, 0.45]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 8), mFur);
    ear.position.set(side, 2.9, 0.3); ear.rotation.z = side > 0 ? -0.3 : 0.3; ear.castShadow = true; g.add(ear);
    const innerEar = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 8), mAccent);
    innerEar.position.set(side, 2.9, 0.3); innerEar.rotation.z = side > 0 ? -0.3 : 0.3; g.add(innerEar);
  }
  for (let i = 0; i < 8; i++) {
    const t = new THREE.Mesh(new THREE.SphereGeometry(0.32 - i * 0.03, 8, 6), i % 2 ? mFur : mAccent);
    t.position.set(-0.8 + Math.sin(i * 0.9) * 0.4, 0.5 + i * 0.28, Math.cos(i * 0.9) * 0.4); g.add(t);
  }
  for (let side of [-0.55, 0.55]) {
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mFur);
    paw.position.set(side, 0.18, 0.4); g.add(paw);
    for (let t2 = 0; t2 < 3; t2++) {
      const toe = new THREE.Mesh(new THREE.SphereGeometry(0.07, 4, 3), mAccent);
      toe.position.set(side + (t2 - 1) * 0.1, 0.1, 0.62); g.add(toe);
    }
  }
  return { mesh: g, r: 1.1, h: 3.4, type: "furry" };
}

function buildEerieEntity() {
  const g = new THREE.Group();
  const mVoid = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const mRed  = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const mGlow = new THREE.MeshBasicMaterial({ color: 0xff4400 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.2, 0.7), mVoid);
  torso.position.y = 2.1; g.add(torso);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.5, 8), mVoid);
  neck.position.y = 3.45; g.add(neck);
  const headM = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.9, 0.6), mVoid);
  headM.position.y = 4.1; g.add(headM);
  for (let side of [-0.18, 0.18]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), mRed);
    eye.scale.set(1, 0.7, 0.5); eye.position.set(side, 4.15, 0.31); g.add(eye);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), mGlow);
    glow.position.set(side, 4.15, 0.33); g.add(glow);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.04, 0.06), mRed);
  mouth.position.set(0, 3.82, 0.31); g.add(mouth);
  for (let side of [-1, 1]) {
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.5, 0.22), mVoid);
    upper.position.set(side * 0.68, 2.2, 0); upper.rotation.z = side * 0.18; upper.castShadow = true; g.add(upper);
    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.8, 0.16), mVoid);
    lower.position.set(side * 0.85, 1.0, 0); lower.rotation.z = side * 0.38; lower.castShadow = true; g.add(lower);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 5), mVoid);
    hand.position.set(side * 1.1, 0.08, 0); g.add(hand);
    for (let f = 0; f < 3; f++) {
      const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.35, 5), mVoid);
      fin.position.set(side * 1.1 + (f - 1) * 0.08, -0.2, 0); fin.rotation.z = side * (0.5 + f * 0.2); g.add(fin);
    }
  }
  for (let side of [-0.28, 0.28]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.4, 0.28), mVoid);
    leg.position.set(side, 0.7, 0); leg.castShadow = true; g.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.6), mVoid);
    foot.position.set(side, 0.0, 0.15); g.add(foot);
  }
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.9, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; g.add(shadow);
  return { mesh: g, r: 0.6, h: 4.8, type: "entity" };
}

function buildFoot() {
  const g = new THREE.Group();
  const mSkin = new THREE.MeshLambertMaterial({ color: 0xffcca8 });
  const mNail = new THREE.MeshLambertMaterial({ color: 0xffddbb });
  const mSole = new THREE.MeshLambertMaterial({ color: 0xf0aa80 });
  const heel = new THREE.Mesh(new THREE.SphereGeometry(0.65, 10, 8), mSkin);
  heel.scale.set(1, 0.65, 1); heel.position.set(0, 0.42, -1.1); heel.castShadow = true; g.add(heel);
  const arch = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 2.0), mSkin);
  arch.position.set(0, 0.38, 0.1); arch.castShadow = true; g.add(arch);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), mSkin);
  ball.scale.set(1.2, 0.55, 0.9); ball.position.set(0, 0.4, 1.0); ball.castShadow = true; g.add(ball);
  const sole = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 2.8), mSole);
  sole.position.set(0, 0.04, 0); g.add(sole);
  for (let side of [-0.8, 0.8]) {
    const ankle = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), mSkin);
    ankle.position.set(side, 1.0, -0.9); g.add(ankle);
  }
  const toeData = [
    { x: -0.72, r: 0.28, l: 0.5 }, { x: -0.36, r: 0.22, l: 0.58 },
    { x: 0.0, r: 0.2, l: 0.62 },   { x: 0.36, r: 0.17, l: 0.52 }, { x: 0.68, r: 0.14, l: 0.38 }
  ];
  toeData.forEach((td) => {
    const toe = new THREE.Mesh(new THREE.SphereGeometry(td.r, 8, 6), mSkin);
    toe.scale.z = td.l / td.r; toe.position.set(td.x, 0.46, 1.55); toe.castShadow = true; g.add(toe);
    const nail = new THREE.Mesh(new THREE.BoxGeometry(td.r * 1.4, 0.06, td.r * 0.9), mNail);
    nail.position.set(td.x, 0.74, 1.6); nail.rotation.x = 0.3; g.add(nail);
  });
  return { mesh: g, r: 1.4, h: 1.5, type: "foot" };
}

function buildBunny() {
  const g = new THREE.Group();
  const mWhite = new THREE.MeshLambertMaterial({ color: 0xfcfcfc });
  const mPink  = new THREE.MeshLambertMaterial({ color: 0xffaabb });
  const mNose  = new THREE.MeshLambertMaterial({ color: 0xff88aa });
  const mEye   = new THREE.MeshLambertMaterial({ color: 0x220022 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.0, 14, 12), mWhite);
  body.scale.set(1, 1.15, 1); body.position.y = 1.05; body.castShadow = true; g.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), mPink);
  belly.scale.set(1, 1.2, 0.6); belly.position.set(0, 0.95, 0.72); g.add(belly);
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8), mWhite);
  tail.position.set(0, 1.1, -1.0); g.add(tail);
  const headM = new THREE.Mesh(new THREE.SphereGeometry(0.65, 12, 10), mWhite);
  headM.position.set(0, 2.28, 0.45); headM.castShadow = true; g.add(headM);
  for (let s of [-0.42, 0.42]) {
    const ch = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), mWhite);
    ch.position.set(s, 2.18, 0.82); g.add(ch);
  }
  const noseM = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mNose);
  noseM.scale.set(1.2, 0.8, 0.9); noseM.position.set(0, 2.2, 1.08); g.add(noseM);
  const mouthL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.04), mNose);
  mouthL.position.set(0, 2.08, 1.07); g.add(mouthL);
  for (let s of [-0.26, 0.26]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), mEye);
    eye.position.set(s, 2.35, 0.98); g.add(eye);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    shine.position.set(s + 0.04, 2.39, 1.06); g.add(shine);
  }
  for (let side of [-0.32, 0.32]) {
    const earOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 1.55, 10), mWhite);
    earOuter.position.set(side, 3.45, 0.35); earOuter.rotation.z = side * 0.18; earOuter.rotation.x = -0.2; earOuter.castShadow = true; g.add(earOuter);
    const earInner = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 1.45, 10), mPink);
    earInner.position.set(side, 3.45, 0.35); earInner.rotation.z = side * 0.18; earInner.rotation.x = -0.2; g.add(earInner);
  }
  for (let s of [-0.5, 0.5]) {
    const leg = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 6), mWhite);
    leg.scale.set(1, 0.7, 1.5); leg.position.set(s, 0.28, 0.5); leg.castShadow = true; g.add(leg);
  }
  for (let s of [-0.38, 0.38]) {
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mWhite);
    paw.position.set(s, 0.6, 0.9); g.add(paw);
  }
  return { mesh: g, r: 1.1, h: 4.0, type: "bunny" };
}

function buildSkyscraper() {
  const g = new THREE.Group();
  const H = 22 + srng() * 28, W = 4 + srng() * 3, D = 4 + srng() * 3;
  const mCon   = new THREE.MeshLambertMaterial({ color: 0x2a2e33 });
  const mGlass = new THREE.MeshLambertMaterial({ color: 0x1a3a55, transparent: true, opacity: 0.75 });
  const mLit   = new THREE.MeshBasicMaterial({ color: 0xffee88 });
  const mMetal = new THREE.MeshLambertMaterial({ color: 0x445566 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), mCon);
  body.position.y = H / 2; body.castShadow = true; g.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(W * 0.7, H * 0.25, D * 0.7), mMetal);
  top.position.y = H + H * 0.125; top.castShadow = true; g.add(top);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, H * 0.3, 6), mMetal);
  ant.position.y = H + H * 0.25 + H * 0.15; g.add(ant);
  // Every other floor only — halves window draw calls without losing the look
  const floorsN = Math.floor(H / 2.2);
  for (let fl = 0; fl < floorsN; fl += 2) {
    for (let side = 0; side < 4; side++) {
      if (srng() > 0.35) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.06), srng() > 0.2 ? mGlass : mLit);
        const a = (side * Math.PI) / 2,
          wx = side % 2 === 0 ? (srng() - 0.5) * (W - 1) : ((side === 1 ? 1 : -1) * W) / 2,
          wz = side % 2 === 1 ? (srng() - 0.5) * (D - 1) : ((side === 0 ? 1 : -1) * D) / 2;
        win.position.set(wx, 1.2 + fl * 2.1, wz); win.rotation.y = a; g.add(win);
      }
    }
  }
  const lobby = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 2.2, D + 0.3), mMetal);
  lobby.position.y = 1.1; g.add(lobby);
  return { mesh: g, r: Math.max(W, D) / 2 + 0.5, h: H + H * 0.55, type: "skyscraper" };
}

function buildCar() {
  const g = new THREE.Group();
  const cols = [0xdd2211, 0x2244dd, 0x22aa44, 0xddaa00, 0x222222, 0xee8800];
  const bodyCol = cols[Math.floor(srng() * cols.length)];
  const mBody  = new THREE.MeshLambertMaterial({ color: bodyCol });
  const mBlk   = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const mChrom = new THREE.MeshLambertMaterial({ color: 0xcccccc });
  const mGlass = new THREE.MeshLambertMaterial({ color: 0x7ab0d0, transparent: true, opacity: 0.6 });
  const mLamp  = new THREE.MeshBasicMaterial({ color: 0xffffcc });
  const mBrake = new THREE.MeshBasicMaterial({ color: 0xff2200 });
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.7, 2.0), mBody);
  chassis.position.y = 0.72; chassis.castShadow = true; g.add(chassis);
  const bodyL = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.65, 1.9), mBody);
  bodyL.position.y = 1.2; bodyL.castShadow = true; g.add(bodyL);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 1.82), mBody);
  cabin.position.set(-0.1, 1.85, 0); cabin.castShadow = true; g.add(cabin);
  const windF = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.72, 0.06), mGlass);
  windF.position.set(0.9, 1.88, 0); windF.rotation.x = 0.2; g.add(windF);
  const windR = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.72, 0.06), mGlass);
  windR.position.set(-1.1, 1.88, 0); windR.rotation.x = -0.2; g.add(windR);
  for (let s of [-1, 1]) {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 1.3), mGlass);
    sw.position.set(-0.1, 1.88, s * 0.92); g.add(sw);
  }
  const bumpF = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.4, 0.2), mChrom);
  bumpF.position.set(0, 0.6, 1.12); g.add(bumpF);
  const bumpR = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.4, 0.2), mChrom);
  bumpR.position.set(0, 0.6, -1.12); g.add(bumpR);
  for (let s of [-1.3, 1.3]) {
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), mLamp);
    hl.position.set(s, 0.88, 1.08); g.add(hl);
    const tl = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), mBrake);
    tl.position.set(s, 0.88, -1.06); g.add(tl);
  }
  [[1.5, 0.38, 1.05], [1.5, 0.38, -1.05], [-1.4, 0.38, 1.05], [-1.4, 0.38, -1.05]].forEach(([x, y, z]) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 16), mBlk);
    w.rotation.x = Math.PI / 2; w.position.set(x, y, z); w.castShadow = true; g.add(w);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 8), mChrom);
    rim.rotation.x = Math.PI / 2; rim.position.set(x, y, z); g.add(rim);
    for (let sp = 0; sp < 3; sp++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.05), mChrom);
      spoke.rotation.z = (sp / 3) * Math.PI * 2; spoke.rotation.x = Math.PI / 2;
      spoke.position.set(x, y, z); g.add(spoke);
    }
  });
  const aerial = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4), mChrom);
  aerial.position.set(-0.6, 2.28, 0.5); g.add(aerial);
  return { mesh: g, r: 2.2, h: 2.3, type: "car" };
}

function buildTree(s = 1, theme) {
  if (theme === "neon") return { mesh: new THREE.Group(), r: 0, h: 0, type: "none" };
  const g = new THREE.Group();
  const cLog = theme === "funny" ? 0xcc8855 : 0x221133;
  const cL1  = theme === "funny" ? 0xff66cc : 0x00ff88;
  const cL2  = theme === "funny" ? 0xff99dd : 0x00cc66;
  const tr = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15 * s, 0.25 * s, 2.5 * s, 7),
    new THREE.MeshLambertMaterial({ color: cLog })
  );
  tr.position.y = 1.25 * s; tr.castShadow = true; g.add(tr);
  [[1.5, 0.8, 3.5], [1.2, 1.8, 3.0], [0.9, 2.7, 2.4], [0.6, 3.5, 1.8]].forEach(([h, y, r], i) => {
    const c = new THREE.Mesh(
      new THREE.ConeGeometry(r * 0.35 * s, h * s, 8),
      new THREE.MeshLambertMaterial({ color: i % 2 ? cL2 : cL1 })
    );
    c.position.y = y * s; c.castShadow = true; g.add(c);
  });
  return { mesh: g, r: 0.8 * s, h: 5 * s, type: "tree" };
}

// ── THEME-SPECIFIC OBSTACLE BUILDERS ─────────────────────────────────────────

function buildSock() {
  const g = new THREE.Group();
  const cols = [0xff6688, 0xffaa00, 0x88ddff, 0x99ff66, 0xffdd44, 0xcc88ff];
  const mSock   = new THREE.MeshLambertMaterial({ color: cols[Math.floor(srng() * cols.length)] });
  const mDark   = new THREE.MeshLambertMaterial({ color: 0x664455 });
  const mStripe = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 2.8, 12), mSock);
  tube.position.y = 2.2; tube.castShadow = true; g.add(tube);
  const ankle = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.55, 12), mSock);
  ankle.position.y = 0.85; ankle.castShadow = true; g.add(ankle);
  const heel = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), mDark);
  heel.scale.set(1, 0.7, 1.1); heel.position.set(0, 0.36, -0.32); heel.castShadow = true; g.add(heel);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.58, 1.5), mSock);
  foot.position.set(0, 0.3, 0.55); foot.castShadow = true; g.add(foot);
  const toe = new THREE.Mesh(new THREE.SphereGeometry(0.44, 10, 8), mSock);
  toe.scale.set(1, 0.65, 1); toe.position.set(0, 0.3, 1.25); g.add(toe);
  for (let i = 0; i < 3; i++) {
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.05, 6, 16), mDark);
    cuff.rotation.x = Math.PI / 2; cuff.position.y = 3.5 - i * 0.22; g.add(cuff);
  }
  for (let i = 0; i < 4; i++) {
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.435, 0.445, 0.1, 12), mStripe);
    stripe.position.y = 1.0 + i * 0.65; g.add(stripe);
  }
  for (let i = 0; i < 3; i++) {
    const stink = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4),
      new THREE.MeshBasicMaterial({ color: 0xaaff00, transparent: true, opacity: 0.55 }));
    stink.position.set((i - 1) * 0.28, 4.2 + i * 0.1, 0); g.add(stink);
  }
  return { mesh: g, r: 0.8, h: 4.2, type: "sock" };
}

function buildLaundryBasket() {
  const g = new THREE.Group();
  const mWicker = new THREE.MeshLambertMaterial({ color: 0xc8a060 });
  const mDark   = new THREE.MeshLambertMaterial({ color: 0x8a6030 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.2, 2.2, 14), mWicker);
  body.position.y = 1.1; body.castShadow = true; g.add(body);
  for (let i = 0; i < 8; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(1.36 - i * 0.02, 0.04, 4, 18), mDark);
    r.rotation.x = Math.PI / 2; r.position.y = 0.25 + i * 0.24; g.add(r);
  }
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.08, 6, 18), mDark);
  rim.rotation.x = Math.PI / 2; rim.position.y = 2.25; g.add(rim);
  for (let s of [-1, 1]) {
    const h2 = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.08, 6, 10), mDark);
    h2.rotation.z = Math.PI / 2; h2.position.set(s * 1.5, 1.8, 0); g.add(h2);
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2, r2 = 0.8 + srng() * 0.5;
    const slump = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.2, 8),
      new THREE.MeshLambertMaterial({ color: [0xff6688, 0xffaa00, 0x88ddff, 0x99ff66, 0xcc88ff][i] }));
    slump.position.set(Math.cos(a) * r2, 2.7, Math.sin(a) * r2);
    slump.rotation.z = (srng() - 0.5) * 1.8; slump.rotation.x = (srng() - 0.5) * 0.8;
    slump.castShadow = true; g.add(slump);
  }
  return { mesh: g, r: 1.8, h: 3.8, type: "laundry" };
}

function buildBackroomsPillar() {
  const g = new THREE.Group();
  const mYellow = new THREE.MeshLambertMaterial({ color: 0xd4b840 });
  const mCeiling = new THREE.MeshLambertMaterial({ color: 0xc8b030, transparent: true, opacity: 0.9 });
  const mLight  = new THREE.MeshBasicMaterial({ color: 0xffffdd });
  const mStain  = new THREE.MeshLambertMaterial({ color: 0xa09020, transparent: true, opacity: 0.6 });
  const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6.0, 1.2),
    new THREE.MeshLambertMaterial({ color: 0xb0a028 }));
  pillar.position.y = 3.0; pillar.castShadow = true; g.add(pillar);
  for (let tx = -1; tx <= 1; tx++) for (let tz = -1; tz <= 1; tz++) {
    const tile = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 1.0), tx + tz === 0 ? mStain : mYellow);
    tile.position.set(tx * 1.0, 0.02, tz * 1.0); g.add(tile);
  }
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.8, 8),
    new THREE.MeshLambertMaterial({ color: 0x888888 }));
  tube.rotation.z = Math.PI / 2; tube.position.y = 5.85; g.add(tube);
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.8, 8), mLight);
  glow.rotation.z = Math.PI / 2; glow.position.y = 5.85; g.add(glow);
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.12, 3.5), mCeiling);
  ceiling.position.y = 6.05; g.add(ceiling);
  for (let i = 0; i < 4; i++) {
    const stain = new THREE.Mesh(new THREE.BoxGeometry(0.8 + srng() * 0.6, 0.05, 0.6 + srng() * 0.5), mStain);
    stain.position.set((srng() - 0.5) * 2.5, 6.12, (srng() - 0.5) * 2.5); g.add(stain);
  }
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.06),
    new THREE.MeshBasicMaterial({ color: 0xff0000 }));
  sign.position.set(0, 4.8, 0.64); g.add(sign);
  return { mesh: g, r: 1.0, h: 6.2, type: "pillar" };
}

function buildBackroomsWall() {
  const g = new THREE.Group();
  const mWall = new THREE.MeshLambertMaterial({ color: 0xc8b020 });
  const mTrim = new THREE.MeshLambertMaterial({ color: 0xa09010 });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 5.5, 6.0), mWall);
  wall.position.y = 2.75; wall.castShadow = true; g.add(wall);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.35, 6.05), mTrim);
  base.position.y = 0.17; g.add(base);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 6.05), mTrim);
  crown.position.y = 5.4; g.add(crown);
  for (let i = 0; i < 5; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 4.5, 0.35),
      new THREE.MeshLambertMaterial({ color: 0x998810, transparent: true, opacity: 0.5 }));
    stripe.position.set(0.16, 2.75, i * 1.1 - 2.2); g.add(stripe);
  }
  const fl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 2.5),
    new THREE.MeshBasicMaterial({ color: 0xffffcc }));
  fl.position.set(0, 5.55, 0); g.add(fl);
  return { mesh: g, r: 0.4, h: 5.8, type: "wall" };
}

function buildToilet() {
  const g = new THREE.Group();
  const mPorcelain = new THREE.MeshLambertMaterial({ color: 0xeeeedd });
  const mMetal     = new THREE.MeshLambertMaterial({ color: 0x999988 });
  const mWater     = new THREE.MeshLambertMaterial({ color: 0x7aabbb, transparent: true, opacity: 0.7 });
  const tank = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, 0.55), mPorcelain);
  tank.position.set(0, 2.45, -0.7); tank.castShadow = true; g.add(tank);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.1, 0.57), mPorcelain);
  lid.position.set(0, 3.22, -0.7); g.add(lid);
  const seat = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.12, 6, 16), mMetal);
  seat.rotation.x = Math.PI / 2; seat.position.set(0, 1.72, 0.06); g.add(seat);
  const bowlOut = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.52, 1.1, 14), mPorcelain);
  bowlOut.position.y = 0.98; bowlOut.castShadow = true; g.add(bowlOut);
  const bowlIn = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.38, 0.55, 14),
    new THREE.MeshLambertMaterial({ color: 0xc8c8b0 }));
  bowlIn.position.y = 1.22; g.add(bowlIn);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.08, 14), mWater);
  water.position.y = 1.5; g.add(water);
  const fh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), mMetal);
  fh.position.set(0.45, 3.1, -0.45); fh.rotation.z = 0.4; g.add(fh);
  const base2 = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.45, 0.7), mPorcelain);
  base2.position.set(0, 0.22, 0.05); base2.castShadow = true; g.add(base2);
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.38, 6), mMetal);
  hinge.rotation.z = Math.PI / 2; hinge.position.set(0, 1.75, -0.45); g.add(hinge);
  return { mesh: g, r: 0.9, h: 3.4, type: "toilet" };
}

function buildPoo() {
  const g = new THREE.Group();
  const mPoo   = new THREE.MeshLambertMaterial({ color: 0x5a2a00 });
  const mShiny = new THREE.MeshLambertMaterial({ color: 0x3d1a00 });
  const mEye   = new THREE.MeshLambertMaterial({ color: 0x000000 });
  const mSmile = new THREE.MeshLambertMaterial({ color: 0x2a0f00 });
  let yOff = 0;
  [[1.1, 0.4], [0.9, 0.5], [0.7, 0.55], [0.5, 0.5]].forEach(([r, h], i) => {
    const coil = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), i % 2 ? mPoo : mShiny);
    coil.scale.y = h / r; coil.position.y = yOff + ((r * h) / r) * 0.6; coil.castShadow = true; g.add(coil);
    yOff += r * 0.9;
  });
  const peak = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 8), mPoo);
  peak.position.y = yOff + 0.7; g.add(peak);
  for (let s of [-0.22, 0.22]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), mEye);
    eye.position.set(s, 1.35, 0.82); g.add(eye);
  }
  for (let i = 0; i < 6; i++) {
    const a = -0.5 + (i / 5) * 1.0;
    const sp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 3), mSmile);
    sp.position.set(Math.sin(a) * 0.3, 1.08 + Math.cos(a) * 0.1, 0.82); g.add(sp);
  }
  for (let i = 0; i < 3; i++) {
    const fly = new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 3),
      new THREE.MeshBasicMaterial({ color: 0x222200 }));
    fly.position.set((i - 1) * 0.5, 3.5 + i * 0.15, 0.5 * (1 - (i % 2))); g.add(fly);
  }
  for (let i = 0; i < 4; i++) {
    const sv = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 4, 10, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0x66aa00, transparent: true, opacity: 0.5 }));
    sv.position.set((i - 1.5) * 0.35, 3.6, 0); sv.rotation.x = Math.PI / 2 + (i % 2) * Math.PI; g.add(sv);
  }
  return { mesh: g, r: 1.2, h: 4.2, type: "poo" };
}

function buildScreamingFace() {
  const g = new THREE.Group();
  const mSkin   = new THREE.MeshLambertMaterial({ color: 0xff9977 });
  const mDark   = new THREE.MeshLambertMaterial({ color: 0x880000 });
  const mEye    = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mPupil  = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const mMouth  = new THREE.MeshBasicMaterial({ color: 0x220000 });
  const mTongue = new THREE.MeshLambertMaterial({ color: 0xff4466 });
  const mTeeth  = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const headM = new THREE.Mesh(new THREE.SphereGeometry(1.0, 14, 12), mSkin);
  headM.scale.set(1.1, 1.3, 0.9); headM.position.y = 3.5; headM.castShadow = true; g.add(headM);
  for (let s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), mSkin);
    ear.scale.set(0.5, 1, 0.6); ear.position.set(s * 1.08, 3.5, 0); g.add(ear);
  }
  for (let s of [-0.42, 0.42]) {
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), mEye);
    white.scale.set(1, 1.3, 0.7); white.position.set(s, 3.7, 0.82); g.add(white);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), mPupil);
    pupil.position.set(s, 3.7, 1.02); g.add(pupil);
    for (let v = 0; v < 3; v++) {
      const vein = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.04),
        new THREE.MeshBasicMaterial({ color: 0xff3300 }));
      vein.position.set(s + (v - 1) * 0.1, 3.6, 0.9); vein.rotation.z = (v - 1) * 0.5; g.add(vein);
    }
  }
  for (let s of [-0.42, 0.42]) {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.07), mDark);
    brow.position.set(s, 4.1, 0.82); brow.rotation.z = s > 0 ? 0.6 : -0.6; g.add(brow);
  }
  const mouthOuter = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.12, 8, 16), mDark);
  mouthOuter.position.set(0, 2.95, 0.82); g.add(mouthOuter);
  const mouthHole = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16), mMouth);
  mouthHole.position.set(0, 2.95, 0.9); g.add(mouthHole);
  for (let i = 0; i < 6; i++) {
    const a = -0.5 + (i / 5) * 1.0;
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.06), mTeeth);
    t.position.set(Math.sin(a) * 0.32, 3.1 + Math.cos(a) * 0.1, 0.9); g.add(t);
  }
  for (let i = 0; i < 5; i++) {
    const a = -0.4 + (i / 4) * 0.8;
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.06), mTeeth);
    t.position.set(Math.sin(a) * 0.28, 2.82 + Math.cos(a) * 0.06, 0.9); g.add(t);
  }
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mTongue);
  tongue.scale.set(1.2, 0.5, 1.4); tongue.position.set(0, 2.85, 0.94); g.add(tongue);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const hair = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.55 + srng() * 0.4, 5), mDark);
    hair.position.set(Math.cos(a) * 0.9, 4.5 + Math.sin(a * 3) * 0.2, Math.sin(a) * 0.5);
    hair.rotation.z = Math.cos(a) * 0.8; hair.rotation.x = Math.sin(a) * 0.4; g.add(hair);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.2, 10), mSkin);
  neck.position.y = 2.1; neck.castShadow = true; g.add(neck);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.0, 0.8), mSkin);
  body.position.y = 0.9; body.castShadow = true; g.add(body);
  for (let s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 1.6, 8), mSkin);
    arm.position.set(s * 1.1, 1.8, 0); arm.rotation.z = s * (Math.PI / 2 - 0.4); arm.castShadow = true; g.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), mSkin);
    hand.position.set(s * 1.9, 2.6, 0); g.add(hand);
  }
  return { mesh: g, r: 1.2, h: 5.0, type: "screamer" };
}

function buildChaosSpike() {
  const g = new THREE.Group();
  const cols = [0xff0000, 0xff4400, 0xff8800, 0xff0044];
  const mSpike = new THREE.MeshLambertMaterial({ color: cols[Math.floor(srng() * cols.length)] });
  const mGlow  = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.4 });
  const main = new THREE.Mesh(new THREE.ConeGeometry(0.5, 4.0, 8), mSpike);
  main.position.y = 2.0; main.castShadow = true; g.add(main);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.22, 2.2, 6), mSpike);
    sp.position.set(Math.cos(a) * 0.9, 0.8, Math.sin(a) * 0.9);
    sp.rotation.z = Math.cos(a) * 0.6; sp.rotation.x = Math.sin(a) * 0.6; sp.castShadow = true; g.add(sp);
  }
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.0, 8, 6), mGlow);
  halo.scale.y = 0.35; halo.position.y = 0.3; g.add(halo);
  return { mesh: g, r: 1.3, h: 4.5, type: "spike" };
}

function buildDiscoball() {
  const g = new THREE.Group();
  const mMirror = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1.0, roughness: 0.0 });
  const mPole   = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.0, 6), mPole);
  pole.position.y = 4.5; g.add(pole);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 12), mMirror);
  ball.position.y = 2.8; ball.castShadow = true; g.add(ball);
  for (let lat = 0; lat < 8; lat++) for (let lon = 0; lon < 16; lon++) {
    const tile = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.06),
      new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(lon / 16, 1, 0.6), metalness: 1, roughness: 0 }));
    const phi = (lat / 8) * Math.PI, theta = (lon / 16) * Math.PI * 2;
    tile.position.set(0.92 * Math.sin(phi) * Math.cos(theta), 2.8 + 0.92 * Math.cos(phi), 0.92 * Math.sin(phi) * Math.sin(theta));
    tile.lookAt(0, 2.8, 0); g.add(tile);
  }
  [0xff0088, 0x00ffff, 0xffff00, 0xff4400].forEach((c, i) => {
    const spot = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.8, 6),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55 }));
    spot.position.set(Math.cos((i / 4) * Math.PI * 2) * 0.5, 2.8, Math.sin((i / 4) * Math.PI * 2) * 0.5);
    spot.rotation.z = (i / 4) * Math.PI * 2; g.add(spot);
  });
  return { mesh: g, r: 1.1, h: 4.2, type: "discoball" };
}

function buildDaftPunkHelmet() {
  const g = new THREE.Group();
  const mGold  = new THREE.MeshStandardMaterial({ color: 0xddaa00, metalness: 0.9, roughness: 0.1 });
  const mVisor = new THREE.MeshStandardMaterial({ color: 0x001122, metalness: 0.5, roughness: 0.0, transparent: true, opacity: 0.85 });
  const mLed   = new THREE.MeshBasicMaterial({ color: 0xff6600 });
  const mBot   = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 0.7), mBot);
  torso.position.y = 0.85; torso.castShadow = true; g.add(torso);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.4, 8), mGold);
  neck.position.y = 1.8; g.add(neck);
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 10), mGold);
  helm.scale.set(1, 1.15, 0.92); helm.position.y = 2.55; helm.castShadow = true; g.add(helm);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.28, 0.08), mVisor);
  visor.position.set(0, 2.55, 0.56); g.add(visor);
  for (let i = 0; i < 8; i++) {
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.06), mLed);
    led.position.set(-0.35 + i * 0.1, 2.35, 0.56); g.add(led);
  }
  for (let s of [-1, 1]) {
    const ep = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.42), mGold);
    ep.position.set(s * 0.63, 2.52, 0); g.add(ep);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.1, 0.22), mBot);
    arm.position.set(s * 0.82, 0.85, 0); arm.castShadow = true; g.add(arm);
  }
  return { mesh: g, r: 0.9, h: 3.3, type: "helmet" };
}

function buildDiscoBooth() {
  const g = new THREE.Group();
  const mBase = new THREE.MeshLambertMaterial({ color: 0x1a0033 });
  const mTop  = new THREE.MeshLambertMaterial({ color: 0x330066 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.0, 1.2), mBase);
  box.position.y = 1.0; box.castShadow = true; g.add(box);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.15, 1.3), mTop);
  top.position.y = 2.08; g.add(top);
  [0xff0088, 0x00ffff, 0xffff00, 0xff4400, 0x00ff88, 0xff00ff].forEach((c, i) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.05),
      new THREE.MeshBasicMaterial({ color: c }));
    p.position.set(-0.62 + i * 0.25, 1.0, 0.63); g.add(p);
  });
  const tl = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff }));
  tl.position.y = 2.3; g.add(tl);
  return { mesh: g, r: 1.4, h: 2.5, type: "booth" };
}

function buildRock(sc = 1) {
  const g = new THREE.Group();
  const cols = [0x8a8a8a, 0x9a9a9a, 0x7a7a8a, 0x888898];
  const mRock = new THREE.MeshLambertMaterial({ color: cols[Math.floor(srng() * cols.length)] });
  const mainR = 0.8 + srng() * 0.7;
  const main = new THREE.Mesh(new THREE.SphereGeometry(mainR * sc, 8, 7), mRock);
  main.scale.set(1, 0.7 + srng() * 0.4, 0.85 + srng() * 0.3); main.castShadow = true; g.add(main);
  for (let i = 0; i < 4; i++) {
    const r2 = 0.3 + srng() * 0.35;
    const lump = new THREE.Mesh(new THREE.SphereGeometry(r2 * sc, 6, 5), mRock);
    const a = srng() * Math.PI * 2;
    lump.position.set(Math.cos(a) * mainR * sc * 0.7, (-0.1 + srng() * 0.4) * sc, Math.sin(a) * mainR * sc * 0.7);
    lump.castShadow = true; g.add(lump);
  }
  const snow = new THREE.Mesh(new THREE.ConeGeometry(mainR * sc * 0.55, mainR * sc * 0.6, 7),
    new THREE.MeshLambertMaterial({ color: 0xeeeeff }));
  snow.position.y = mainR * sc * 0.45; g.add(snow);
  return { mesh: g, r: (mainR + 0.3) * sc, h: mainR * sc * 1.4, type: "rock" };
}

function buildPineTree(sc = 1) {
  const g = new THREE.Group();
  const mTrunk = new THREE.MeshLambertMaterial({ color: 0x5c3311 });
  const mSnow  = new THREE.MeshLambertMaterial({ color: 0xeeeeff });
  const mLeaf  = new THREE.MeshLambertMaterial({ color: 0x225522 });
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * sc, 0.18 * sc, 2.5 * sc, 7), mTrunk);
  tr.position.y = 1.25 * sc; tr.castShadow = true; g.add(tr);
  [[1.4, 0.8, 3.2], [1.1, 1.9, 2.7], [0.8, 2.8, 2.1], [0.55, 3.5, 1.5]].forEach(([h, y, r], i) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 0.32 * sc, h * sc, 8), mLeaf);
    cone.position.y = y * sc; cone.castShadow = true; g.add(cone);
    const scone = new THREE.Mesh(new THREE.ConeGeometry(r * 0.28 * sc, h * sc * 0.4, 8), mSnow);
    scone.position.y = (y + h * 0.35) * sc; g.add(scone);
  });
  return { mesh: g, r: 0.9 * sc, h: 4.5 * sc, type: "pinetree" };
}

function buildMountainPeak() {
  const g = new THREE.Group();
  const mRock = new THREE.MeshLambertMaterial({ color: 0x888898 });
  const mSnow = new THREE.MeshLambertMaterial({ color: 0xeeeeff });
  const mDark = new THREE.MeshLambertMaterial({ color: 0x667788 });
  const peak = new THREE.Mesh(new THREE.ConeGeometry(2.5, 6.0, 8), mRock);
  peak.position.y = 3.0; peak.castShadow = true; g.add(peak);
  const snow = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.0, 8), mSnow);
  snow.position.y = 5.5; g.add(snow);
  for (let i = 0; i < 3; i++) {
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(1.2 + i * 0.5, 0.25, 0.6), mDark);
    ledge.position.set(i % 2 ? 0.5 : -0.5, 1.5 + i * 1.5, 0.8); ledge.rotation.y = (i % 2) * 0.3; g.add(ledge);
  }
  return { mesh: g, r: 2.8, h: 7.0, type: "mtnpeak" };
}

function buildGeoSpike() {
  const g = new THREE.Group();
  const col   = new THREE.Color().setHSL(srng(), 1, 0.55);
  const mSpike = new THREE.MeshLambertMaterial({ color: col });
  const mGlow  = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35 });
  const h2 = 2.5 + srng() * 2.0;
  const spike = new THREE.Mesh(new THREE.ConeGeometry(0.55, h2, 4), mSpike);
  spike.position.y = h2 / 2; spike.castShadow = true; g.add(spike);
  const halo = new THREE.Mesh(new THREE.ConeGeometry(0.8, h2 * 1.1, 4), mGlow);
  halo.position.y = (h2 / 2) * 1.05; g.add(halo);
  return { mesh: g, r: 0.65, h: h2, type: "geospike" };
}

function buildGeoBlock() {
  const g = new THREE.Group();
  const col    = new THREE.Color().setHSL(srng(), 1, 0.45);
  const mBlock = new THREE.MeshLambertMaterial({ color: col });
  const mEdge  = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
  const s = 1.5 + srng() * 1.5;
  const box = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mBlock);
  box.position.y = s / 2; box.castShadow = true; g.add(box);
  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(s + 0.05, s + 0.05, s + 0.05)), mEdge);
  edge.position.y = s / 2; g.add(edge);
  return { mesh: g, r: s / 2 + 0.2, h: s, type: "geoblock" };
}

function buildGeoPortal() {
  const g = new THREE.Group();
  const cols = [0x00ffff, 0xff00ff];
  const mRing = new THREE.MeshBasicMaterial({ color: cols[Math.floor(srng() * 2)], transparent: true, opacity: 0.8 });
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2 - i * 0.3, 0.08, 8, 24), mRing);
    ring.position.y = 2.0; ring.rotation.x = Math.PI / 2; g.add(ring);
  }
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.06, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 }));
  inner.position.y = 2.0; g.add(inner);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.0, 6),
    new THREE.MeshLambertMaterial({ color: 0x333333 }));
  pole.position.y = 1.0; g.add(pole);
  return { mesh: g, r: 1.3, h: 3.2, type: "geoportal" };
}

function buildEmojiPillar() {
  const g = new THREE.Group();
  const emojiFaces = [
    { eyes: 0xffd700, mouth: 0xff4400 }, { eyes: 0x00aaff, mouth: 0xff0055 },
    { eyes: 0xff0000, mouth: 0xff6600 }, { eyes: 0x00ff88, mouth: 0xffdd00 }
  ];
  const ef    = emojiFaces[Math.floor(srng() * emojiFaces.length)];
  const mFace = new THREE.MeshLambertMaterial({ color: 0xffdd44 });
  const mEye  = new THREE.MeshBasicMaterial({ color: ef.eyes });
  const mMouth = new THREE.MeshBasicMaterial({ color: ef.mouth });
  const face = new THREE.Mesh(new THREE.SphereGeometry(1.0, 14, 12), mFace);
  face.position.y = 2.5; face.castShadow = true; g.add(face);
  for (let s of [-0.35, 0.35]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), mEye);
    eye.position.set(s, 2.65, 0.9); g.add(eye);
  }
  for (let i = 0; i < 7; i++) {
    const a = -0.5 + (i / 6) * 1.0;
    const mp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 5, 4), mMouth);
    mp.position.set(Math.sin(a) * 0.55, 2.22 + Math.cos(a) * 0.12, 0.88); g.add(mp);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.8, 8), mFace);
  neck.position.y = 1.3; g.add(neck);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), mFace);
  body.scale.set(1.1, 0.8, 0.9); body.position.y = 0.5; g.add(body);
  return { mesh: g, r: 1.1, h: 3.8, type: "emojipillar" };
}

function buildDancingArrow() {
  const g = new THREE.Group();
  const col  = new THREE.Color().setHSL(srng(), 1, 0.55);
  const mArr = new THREE.MeshLambertMaterial({ color: col });
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.5, 0.4), mArr);
  shaft.position.y = 1.25; shaft.castShadow = true; g.add(shaft);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.2, 4), mArr);
  head.position.y = 3.1; head.castShadow = true; g.add(head);
  const glow = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 6, 16),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6 }));
  glow.rotation.x = Math.PI / 2; glow.position.y = 1.25; g.add(glow);
  return { mesh: g, r: 0.9, h: 4.2, type: "arrow" };
}

function buildGlitchPillar() {
  const g = new THREE.Group();
  const mMain  = new THREE.MeshLambertMaterial({ color: 0x00ff44 });
  const mGlitch = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mDark  = new THREE.MeshLambertMaterial({ color: 0x002200 });
  const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 5.0, 1.0), mMain);
  pillar.position.y = 2.5; pillar.castShadow = true; g.add(pillar);
  for (let i = 0; i < 6; i++) {
    const slice = new THREE.Mesh(new THREE.BoxGeometry(1.05 + srng() * 0.4, 0.12, 1.05),
      srng() > 0.5 ? mGlitch : mDark);
    slice.position.set((srng() - 0.5) * 0.3, 0.5 + i * 0.8, (srng() - 0.5) * 0.2); g.add(slice);
  }
  const mBin = new THREE.MeshBasicMaterial({ color: 0x00ff44, transparent: true, opacity: 0.7 });
  for (let i = 0; i < 5; i++) {
    const digit = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, 0.06), mBin);
    digit.position.set((srng() - 0.5) * 2.5, srng() * 5.0, (srng() - 0.5) * 2.5); g.add(digit);
  }
  return { mesh: g, r: 0.8, h: 5.2, type: "glitchpillar" };
}

function buildDataNode() {
  const g = new THREE.Group();
  const mNode = new THREE.MeshStandardMaterial({ color: 0x00ff88, metalness: 0.6, roughness: 0.2, transparent: true, opacity: 0.85 });
  const mWire = new THREE.MeshBasicMaterial({ color: 0x00ff44, transparent: true, opacity: 0.5 });
  const node = new THREE.Mesh(new THREE.OctahedronGeometry(0.9), mNode);
  node.position.y = 2.2; node.castShadow = true; g.add(node);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4 + i * 0.3, 0.05, 4, 20), mWire);
    ring.position.y = 2.2; ring.rotation.set(i * 0.5, i * 0.7, i * 0.3); g.add(ring);
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), mWire);
  stem.position.y = 1.1; g.add(stem);
  return { mesh: g, r: 1.0, h: 3.6, type: "datanode" };
}

function buildSnowman() {
  const g = new THREE.Group();
  const mSnow  = new THREE.MeshLambertMaterial({ color: 0xeeeeff });
  const mBtn   = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const mNose  = new THREE.MeshLambertMaterial({ color: 0xff6600 });
  const mHat   = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const mScarf = new THREE.MeshLambertMaterial({ color: 0xdd2222 });
  const bot = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), mSnow);
  bot.position.y = 0.9; bot.castShadow = true; g.add(bot);
  const mid = new THREE.Mesh(new THREE.SphereGeometry(0.68, 12, 10), mSnow);
  mid.position.y = 2.3; mid.castShadow = true; g.add(mid);
  const headM = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), mSnow);
  headM.position.y = 3.35; headM.castShadow = true; g.add(headM);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.1, 14), mHat);
  brim.position.y = 3.88; g.add(brim);
  const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.65, 14), mHat);
  hatTop.position.y = 4.22; g.add(hatTop);
  const noseM = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.45, 7), mNose);
  noseM.rotation.x = Math.PI / 2; noseM.position.set(0, 3.38, 0.52); g.add(noseM);
  for (let s of [-0.18, 0.18]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), mBtn);
    eye.position.set(s, 3.52, 0.46); g.add(eye);
  }
  for (let i = 0; i < 3; i++) {
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), mBtn);
    btn.position.set(0, 2.55 - i * 0.28, 0.65); g.add(btn);
  }
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.1, 6, 14), mScarf);
  scarf.rotation.x = Math.PI / 2; scarf.position.y = 2.72; g.add(scarf);
  for (let s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 5), mBtn);
    arm.position.set(s * 0.9, 2.35, 0); arm.rotation.z = s * 0.55; arm.castShadow = true; g.add(arm);
    for (let f = 0; f < 2; f++) {
      const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4), mBtn);
      twig.position.set(s * 1.35, 2.55 + f * 0.1, 0.1 * (f * 2 - 1));
      twig.rotation.z = s * (0.9 + f * 0.3); twig.rotation.x = 0.3 * f; g.add(twig);
    }
  }
  return { mesh: g, r: 1.0, h: 4.9, type: "snowman" };
}

function buildIceCrystal() {
  const g = new THREE.Group();
  const mIce  = new THREE.MeshStandardMaterial({ color: 0xaaddff, metalness: 0.2, roughness: 0.0, transparent: true, opacity: 0.75 });
  const mCore = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
  const h2 = 1.5 + srng() * 2.0;
  const main = new THREE.Mesh(new THREE.ConeGeometry(0.5, h2, 6), mIce);
  main.position.y = h2 / 2; main.castShadow = true; g.add(main);
  const base = new THREE.Mesh(new THREE.ConeGeometry(0.4, h2 * 0.5, 6), mIce);
  base.rotation.x = Math.PI; base.position.y = h2 * 0.1; g.add(base);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const shard = new THREE.Mesh(new THREE.ConeGeometry(0.22, h2 * 0.6, 5), mIce);
    shard.position.set(Math.cos(a) * 0.6, h2 * 0.25, Math.sin(a) * 0.6);
    shard.rotation.z = Math.cos(a) * 0.5; shard.rotation.x = Math.sin(a) * 0.5; g.add(shard);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), mCore);
  core.position.y = h2 * 0.35; g.add(core);
  return { mesh: g, r: 0.8, h: h2 + 0.5, type: "icecrystal" };
}

function buildChristmasTree() {
  const g = new THREE.Group();
  const mTrunk = new THREE.MeshLambertMaterial({ color: 0x5c3311 });
  const mGreen = new THREE.MeshLambertMaterial({ color: 0x1a4d1a });
  const mSnow  = new THREE.MeshLambertMaterial({ color: 0xeeeeff });
  const mStar  = new THREE.MeshBasicMaterial({ color: 0xffdd00 });
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.2, 7), mTrunk);
  tr.position.y = 0.6; tr.castShadow = true; g.add(tr);
  [[2.0, 1.4, 3.8], [1.6, 2.6, 3.0], [1.2, 3.6, 2.2], [0.85, 4.4, 1.6]].forEach(([h2, y, r]) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 0.28, h2, 8), mGreen);
    cone.position.y = y; cone.castShadow = true; g.add(cone);
    const snow = new THREE.Mesh(new THREE.ConeGeometry(r * 0.22, h2 * 0.45, 8), mSnow);
    snow.position.y = y + h2 * 0.28; g.add(snow);
  });
  const ornCols = [0xff0000, 0xffdd00, 0x0000ff, 0xff00ff, 0x00ff88];
  for (let i = 0; i < 8; i++) {
    const a = srng() * Math.PI * 2, lv = 0.2 + srng() * 0.6, r2 = (1 - lv) * 3.0 * 0.28;
    const orn = new THREE.Mesh(new THREE.SphereGeometry(0.13, 7, 5),
      new THREE.MeshLambertMaterial({ color: ornCols[i % ornCols.length] }));
    orn.position.set(Math.cos(a) * r2, 1.4 + lv * 3.2, Math.sin(a) * r2); g.add(orn);
  }
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), mStar);
  star.position.y = 5.3; g.add(star);
  return { mesh: g, r: 1.0, h: 5.6, type: "xmastree" };
}

function buildCrater() {
  const g = new THREE.Group();
  const mRock = new THREE.MeshLambertMaterial({ color: 0x888888 });
  const mDark = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.3, 8, 16), mRock);
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.25; rim.castShadow = true; g.add(rim);
  const floor2 = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.15, 16), mDark);
  g.add(floor2);
  return { mesh: g, r: 2.2, h: 0.6, type: "crater" };
}

function buildMoonRock() {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: 0x999999 });
  const base = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 + Math.random() * 0.5, 0), m);
  base.castShadow = true; g.add(base);
  return { mesh: g, r: 0.9, h: 1.2, type: "moonrock" };
}

function buildOfficeDesk() {
  const g = new THREE.Group();
  const mDesk  = new THREE.MeshLambertMaterial({ color: 0xd4a862 });
  const mMetal = new THREE.MeshLambertMaterial({ color: 0x777788 });
  const mScreen = new THREE.MeshBasicMaterial({ color: 0x0a1628 });
  const mLit   = new THREE.MeshBasicMaterial({ color: 0x3a6fdd });
  const mPaper = new THREE.MeshLambertMaterial({ color: 0xf0eeea });
  const mChair = new THREE.MeshLambertMaterial({ color: 0x334466 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.09, 1.6), mDesk);
  top.position.y = 1.4; top.castShadow = true; g.add(top);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(3.24, 0.04, 1.64),
    new THREE.MeshLambertMaterial({ color: 0xaa8844 }));
  edge.position.y = 1.35; g.add(edge);
  for (let lx of [-1.5, 1.5]) for (let lz of [-0.7, 0.7]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.4, 0.06), mMetal);
    leg.position.set(lx, 0.7, lz); g.add(leg);
  }
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), mMetal);
  stand.position.set(0, 1.65, 0.4); g.add(stand);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.82, 0.06), mScreen);
  screen.position.set(0, 2.05, 0.42); g.add(screen);
  const scrFrame = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.88, 0.05), mMetal);
  scrFrame.position.set(0, 2.05, 0.45); g.add(scrFrame);
  const scrGlow = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.03), mLit);
  scrGlow.position.set(0, 2.05, 0.39); g.add(scrGlow);
  const kbd = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.25),
    new THREE.MeshLambertMaterial({ color: 0xdddddd }));
  kbd.position.set(0, 1.46, 0.1); g.add(kbd);
  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.4), mPaper);
  paper.position.set(-1.1, 1.46, -0.3); paper.rotation.y = 0.2; g.add(paper);
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.15, 10),
    new THREE.MeshLambertMaterial({ color: 0x993322 }));
  mug.position.set(1.1, 1.5, -0.3); g.add(mug);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.85), mChair);
  seat.position.set(0, 0.72, -1.4); g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.9, 0.08), mChair);
  back.position.set(0, 1.2, -1.82); g.add(back);
  const poleC = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8), mMetal);
  poleC.position.set(0, 0.35, -1.4); g.add(poleC);
  const baseC = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 12), mMetal);
  baseC.position.set(0, 0.04, -1.4); g.add(baseC);
  for (let wi = 0; wi < 5; wi++) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), mMetal);
    const a = (wi / 5) * Math.PI * 2;
    w.position.set(Math.cos(a) * 0.42, 0.04, Math.sin(a) * 0.42 - 1.4); w.rotation.x = Math.PI / 2; g.add(w);
  }
  return { mesh: g, r: 1.9, h: 2.8, type: "desk" };
}

function buildOfficeCubicleWall() {
  const g = new THREE.Group();
  const mWall  = new THREE.MeshLambertMaterial({ color: 0x7788aa });
  const mFrame = new THREE.MeshLambertMaterial({ color: 0x555566 });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.8, 0.1), mWall);
  panel.position.y = 0.95; panel.castShadow = true; g.add(panel);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(3.06, 1.86, 0.06), mFrame);
  frame.position.y = 0.95; g.add(frame);
  const cork = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.35, 0.06),
    new THREE.MeshLambertMaterial({ color: 0xb08040 }));
  cork.position.y = 1.8; g.add(cork);
  const note = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.04),
    new THREE.MeshLambertMaterial({ color: 0xffffcc }));
  note.position.set(0.5, 1.82, 0.07); note.rotation.z = 0.1; g.add(note);
  return { mesh: g, r: 1.6, h: 2.0, type: "cubicle" };
}

function buildOfficeLamp() {
  const g = new THREE.Group();
  const mMetal = new THREE.MeshLambertMaterial({ color: 0x999999 });
  const mShade = new THREE.MeshLambertMaterial({ color: 0xddcc88 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.0, 8), mMetal);
  pole.position.y = 1.0; g.add(pole);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.4, 12, 1, true), mShade);
  shade.position.y = 2.1; shade.rotation.x = Math.PI; g.add(shade);
  const pl = new THREE.PointLight(0xffffcc, 1.2, 6);
  pl.position.y = 2.15; g.add(pl);
  const base2 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 12), mMetal);
  base2.position.y = 0.04; g.add(base2);
  return { mesh: g, r: 0.5, h: 2.3, type: "lamp" };
}

function buildCabbage() {
  const g = new THREE.Group();
  const mLeaf = new THREE.MeshLambertMaterial({ color: 0x44bb44 });
  const mDark = new THREE.MeshLambertMaterial({ color: 0x228822 });
  const sc = 0.8 + Math.random();
  const base = new THREE.Mesh(new THREE.SphereGeometry(1.2 * sc, 10, 8), mLeaf);
  base.scale.y = 0.7; base.castShadow = true; g.add(base);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.7 * sc, 8, 6), i % 2 ? mLeaf : mDark);
    leaf.scale.set(0.6, 0.3, 1.0); leaf.position.set(Math.cos(a) * 0.8 * sc, 0.4 * sc, Math.sin(a) * 0.8 * sc);
    leaf.rotation.z = Math.cos(a) * 0.6; g.add(leaf);
  }
  return { mesh: g, r: 1.4 * sc, h: 1.6 * sc, type: "cabbage" };
}

function buildMinion() {
  const g = new THREE.Group();
  const mYel = new THREE.MeshLambertMaterial({ color: 0xffdd00 });
  const mBlu = new THREE.MeshLambertMaterial({ color: 0x2244bb });
  const mBlk = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const mWht = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.75, 1.5, 12), mYel);
  body.position.y = 0.75; body.castShadow = true; g.add(body);
  const headM = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 10), mYel);
  headM.position.y = 1.9; headM.castShadow = true; g.add(headM);
  const ov = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 0.8, 12), mBlu);
  ov.position.y = 0.5; g.add(ov);
  const gog = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 16),
    new THREE.MeshLambertMaterial({ color: 0x888888 }));
  gog.rotation.x = Math.PI / 2; gog.position.set(0, 2.0, 0.56); g.add(gog);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), mBlk);
  eye.position.set(0, 2.0, 0.65); g.add(eye);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), mWht);
  pupil.position.set(0.04, 2.02, 0.74); g.add(pupil);
  return { mesh: g, r: 0.9, h: 2.8, type: "minion" };
}

function buildGiantNumber(num) {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: 0x00ff88 });
  if (num === 6) {
    const vert = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6, 0.8), m);
    vert.position.set(-1, 3, 0); g.add(vert);
    const hTop = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 0.8), m);
    hTop.position.set(0, 5.6, 0); g.add(hTop);
    const hMid = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 0.8), m);
    hMid.position.set(0, 3.0, 0); g.add(hMid);
    const hBot = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 0.8), m);
    hBot.position.set(0, 0.4, 0); g.add(hBot);
    const vertR = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.8, 0.8), m);
    vertR.position.set(1.0, 1.8, 0); g.add(vertR);
  } else {
    const hTop = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.8, 0.8), m);
    hTop.position.set(0, 5.6, 0); g.add(hTop);
    const diag = new THREE.Mesh(new THREE.BoxGeometry(0.8, 5, 0.8), m);
    diag.position.set(0.5, 2.5, 0); diag.rotation.z = -0.3; g.add(diag);
  }
  return { mesh: g, r: 2.0, h: 7.0, type: "number" };
}

function buildTornadoFunnel() {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: 0x556677, transparent: true, opacity: 0.7 });
  for (let i = 0; i < 6; i++) {
    const y = i * 1.2, r = 0.4 + i * 0.6;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 6, 16), m);
    ring.rotation.x = Math.PI / 2; ring.position.y = y; g.add(ring);
  }
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2, 8), m);
  tip.position.y = 0; tip.rotation.x = Math.PI; g.add(tip);
  return { mesh: g, r: 1.5, h: 8.0, type: "tornado" };
}

function buildWaterfallRock() {
  const g = new THREE.Group();
  const m  = new THREE.MeshLambertMaterial({ color: 0x666688 });
  const mW = new THREE.MeshLambertMaterial({ color: 0xaaddee, transparent: true, opacity: 0.7 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.5, 4, 2), m);
  base.position.y = 2; base.castShadow = true; g.add(base);
  const fall = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4, 0.3), mW);
  fall.position.set(0, 2, -1.2); g.add(fall);
  const pool = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.2, 12), mW);
  pool.position.y = 0.1; g.add(pool);
  return { mesh: g, r: 1.8, h: 5.0, type: "waterfall" };
}

function buildCanyonWall() {
  const g = new THREE.Group();
  const m  = new THREE.MeshLambertMaterial({ color: 0xcc6633 });
  const m2 = new THREE.MeshLambertMaterial({ color: 0xaa4422 });
  const H = 8 + Math.random() * 6;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(4, H, 2), m);
  wall.position.y = H / 2; wall.castShadow = true; g.add(wall);
  for (let s = 0; s < 4; s++) {
    const layer = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.4, 2.1), s % 2 ? m : m2);
    layer.position.y = 1 + s * 2; g.add(layer);
  }
  return { mesh: g, r: 2.5, h: H, type: "canyon" };
}


// ─────────────────────────────────────────────────────────────────────────────
// ── NEW THEME OBSTACLE BUILDERS ──────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

function buildPoolroomPillar() {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: 0xd4c99a });
  const tile = new THREE.MeshLambertMaterial({ color: 0xccccaa });
  const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 8, 1.2), m);
  pillar.position.y = 4; pillar.castShadow = true; g.add(pillar);
  // Tile base
  const base2 = new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, 2), tile);
  base2.position.y = 0.2; g.add(base2);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, 2), tile);
  cap.position.y = 8.4; g.add(cap);
  return { mesh: g, r: 1.0, h: 9, type: "pillar" };
}

function buildPoolroomSignage() {
  const g = new THREE.Group();
  const postM = new THREE.MeshLambertMaterial({ color: 0x888866 });
  const signM = new THREE.MeshLambertMaterial({ color: 0xffffcc, transparent: true, opacity: 0.85 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 6), postM);
  post.position.y = 2.5; g.add(post);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.2, 0.1), signM);
  sign.position.y = 5.2; g.add(sign);
  // Fluorescent glow
  const fl = new THREE.PointLight(0xffffaa, 0.6, 8); fl.position.y = 5.5; g.add(fl);
  return { mesh: g, r: 1.2, h: 5.5, type: "wall" };
}

function buildHogwartsCandle() {
  const g = new THREE.Group();
  const waxM = new THREE.MeshLambertMaterial({ color: 0xeeddcc });
  const flameM = new THREE.MeshBasicMaterial({ color: 0xff9900, transparent: true, opacity: 0.9 });
  const H = 1.2 + srng() * 1.5;
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, H, 6), waxM);
  candle.position.y = H / 2; g.add(candle);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.22, 5, 3), flameM);
  flame.position.y = H + 0.22; g.add(flame);
  return { mesh: g, r: 0.4, h: H + 0.5, type: "pillar" };
}

function buildHogwartsStone() {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: 0x554433 });
  const H = 4 + srng() * 3;
  const stone = new THREE.Mesh(new THREE.BoxGeometry(1.8, H, 1.8), m);
  stone.position.y = H / 2; stone.rotation.y = srng() * 0.4;
  stone.castShadow = true; g.add(stone);
  // Ivy (green patches)
  const ivyM = new THREE.MeshLambertMaterial({ color: 0x336622 });
  const ivy = new THREE.Mesh(new THREE.BoxGeometry(2, 0.6, 2), ivyM);
  ivy.position.y = H * 0.7; g.add(ivy);
  return { mesh: g, r: 1.2, h: H, type: "wall" };
}

function buildHogwartsLantern() {
  const g = new THREE.Group();
  const metalM = new THREE.MeshLambertMaterial({ color: 0x333322 });
  const glowM = new THREE.MeshBasicMaterial({ color: 0xff8833, transparent: true, opacity: 0.7 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 4, 6), metalM);
  post.position.y = 2; g.add(post);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.7), metalM);
  box.position.y = 4.45; g.add(box);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.5), glowM);
  glow.position.y = 4.45; g.add(glow);
  return { mesh: g, r: 0.6, h: 5, type: "pillar" };
}

function buildVillageHaystack() {
  const g = new THREE.Group();
  const hayM = new THREE.MeshLambertMaterial({ color: 0xddaa44 });
  const darkM = new THREE.MeshLambertMaterial({ color: 0xcc9933 });
  const hay = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 2.5, 10), hayM);
  hay.position.y = 1.25; hay.castShadow = true; g.add(hay);
  const top = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.2, 10), darkM);
  top.position.y = 2.85; g.add(top);
  return { mesh: g, r: 1.8, h: 3.5, type: "wall" };
}

function buildVillageWell() {
  const g = new THREE.Group();
  const stoneM = new THREE.MeshLambertMaterial({ color: 0x887766 });
  const woodM = new THREE.MeshLambertMaterial({ color: 0x885533 });
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 1.2, 12, 1, true), stoneM);
  ring.position.y = 0.6; g.add(ring);
  const base3 = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.3, 12), stoneM);
  base3.position.y = 0.15; g.add(base3);
  // Roof posts
  [[-1,0,0],[1,0,0]].forEach(([x,y,z]) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,2.5,6), woodM);
    post.position.set(x*0.9, 2.45, 0); g.add(post);
  });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 0.25), woodM);
  beam.position.y = 3.7; g.add(beam);
  return { mesh: g, r: 1.5, h: 4, type: "wall" };
}

function buildMinecraftBlock() {
  const g = new THREE.Group();
  const cols = [0x559933, 0x6b4226, 0x888888, 0x5566dd, 0xddcc88];
  const m = new THREE.MeshLambertMaterial({ color: cols[Math.floor(srng() * cols.length)] });
  const sz = 1.5 + srng() * 1.5;
  const block = new THREE.Mesh(new THREE.BoxGeometry(sz, sz, sz), m);
  block.position.y = sz / 2; block.castShadow = true; g.add(block);
  // Stack 1-3 blocks
  if (srng() > 0.4) {
    const m2 = new THREE.MeshLambertMaterial({ color: cols[Math.floor(srng() * cols.length)] });
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(sz, sz, sz), m2);
    b2.position.y = sz * 1.5; g.add(b2);
  }
  return { mesh: g, r: sz * 0.6, h: sz * 2.5, type: "wall" };
}

function buildMinecraftTree() {
  const g = new THREE.Group();
  const woodM2 = new THREE.MeshLambertMaterial({ color: 0x8b6914 });
  const leafM2 = new THREE.MeshLambertMaterial({ color: 0x3a7d1e });
  const H2 = 4 + srng() * 3;
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1, H2, 1), woodM2);
  trunk.position.y = H2 / 2; trunk.castShadow = true; g.add(trunk);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3, 3.5), leafM2);
  crown.position.y = H2 + 1.5; g.add(crown);
  return { mesh: g, r: 1.5, h: H2 + 3, type: "tree" };
}

function buildMinecraftCreeper() {
  const g = new THREE.Group();
  const greenM = new THREE.MeshLambertMaterial({ color: 0x44aa33 });
  const darkM = new THREE.MeshLambertMaterial({ color: 0x226611 });
  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3, 1.2), greenM);
  body.position.y = 2.5; body.castShadow = true; g.add(body);
  // Head (bigger)
  const head = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), greenM);
  head.position.y = 5.1; g.add(head);
  // Face pixels
  [-0.4, 0.4].forEach(x => {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.1), darkM);
    eye.position.set(x, 5.4, 1.15); g.add(eye);
  });
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.1), darkM);
  mouth.position.set(0, 4.7, 1.15); g.add(mouth);
  return { mesh: g, r: 1.5, h: 6.5, type: "wall" };
}

function buildSkyblockCrate() {
  const g = new THREE.Group();
  const woodM3 = new THREE.MeshLambertMaterial({ color: 0x885533 });
  const metalM2 = new THREE.MeshLambertMaterial({ color: 0x888877 });
  const crate = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), woodM3);
  crate.position.y = 0.9; crate.castShadow = true; g.add(crate);
  // Metal bands
  [0.4, 1.4].forEach(y => {
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.2, 1.85), metalM2);
    band.position.y = y; g.add(band);
  });
  return { mesh: g, r: 1.0, h: 1.8, type: "wall" };
}

// ─────────────────────────────────────────────────────────────────────────────
// ── VET SCHOOL — ANIMATED ROAMING ENTITIES ───────────────────────────────────

function _swapToGLBWithClip(placeholderGroup, modelKey, clipName) {
  if (typeof loadModel !== "function") return;
  loadModel(modelKey, function(glbClone) {
    if (!glbClone) return;
    while (placeholderGroup.children.length) placeholderGroup.remove(placeholderGroup.children[0]);
    placeholderGroup.add(glbClone);
    // Strip PBR metalness so models don't look like chrome/metal under Lambert lighting
    glbClone.traverse(function(c) {
      if (!c.isMesh) return;
      var _isArr = Array.isArray(c.material);
      var _mats  = _isArr ? c.material : [c.material];
      var _fixed = _mats.map(function(m) {
        var mc = m.clone();
        if (mc.metalness !== undefined) mc.metalness = 0;
        if (mc.roughness !== undefined) mc.roughness = 0.85;
        return mc;
      });
      c.material = _isArr ? _fixed : _fixed[0];
    });
    // Override to the requested animation clip
    var clips = glbClone.userData.clipActions;
    if (!clips) return;
    Object.values(clips).forEach(function(a) { try { a.stop(); } catch(e) {} });
    // Case-insensitive search for the desired clip, fall back to first available
    var found = clips[clipName];
    if (!found) {
      var lc = clipName.toLowerCase();
      found = Object.keys(clips).reduce(function(acc, k) {
        return acc || (k.toLowerCase().indexOf(lc) >= 0 ? clips[k] : null);
      }, null);
    }
    if (!found) found = Object.values(clips)[0];
    if (found) found.reset().play();
  });
}

function buildVetDog() {
  var g = new THREE.Group();
  // Tiny placeholder box — replaced by Shiba Inu.glb async
  var ph = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.7),
    new THREE.MeshLambertMaterial({ color: 0xcc9944 }));
  ph.position.y = 0.21; ph.castShadow = true; g.add(ph);
  _swapToGLBWithClip(g, 'shiba_inu', 'Gallop');
  return { mesh: g, r: 0.5, h: 0.45, type: "dog" };
}

function buildVetWoman() {
  var g = new THREE.Group();
  // Placeholder capsule — replaced by Animated Woman.glb async
  var ph = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.72, 8),
    new THREE.MeshLambertMaterial({ color: 0xffaacc }));
  ph.position.y = 0.86; ph.castShadow = true; g.add(ph);
  _swapToGLBWithClip(g, 'animated_woman', 'Running');
  return { mesh: g, r: 0.38, h: 1.72, type: "woman" };
}

// ─────────────────────────────────────────────────────────────────────────────
// ── VET SCHOOL OBSTACLES ──────────────────────────────────────────────────────
function buildVetExamTable() {
  const g = new THREE.Group();
  const metalM = new THREE.MeshLambertMaterial({ color: 0xccddcc });
  const legM   = new THREE.MeshLambertMaterial({ color: 0xaabbaa });
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 1.2), metalM);
  tableTop.position.y = 1.05; tableTop.castShadow = true; g.add(tableTop);
  [[-0.9,-0.45],[0.9,-0.45],[-0.9,0.45],[0.9,0.45]].forEach(function(p) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,1.1,6), legM);
    leg.position.set(p[0], 0.55, p[1]); g.add(leg);
  });
  // Green surgical drape on top
  const drapeM = new THREE.MeshLambertMaterial({ color: 0x44aa66 });
  const drape  = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.06, 1.0), drapeM);
  drape.position.y = 1.17; g.add(drape);
  return { mesh: g, r: 1.3, h: 1.2, type: "wall" };
}

function buildVetCage() {
  const g = new THREE.Group();
  const frameM = new THREE.MeshLambertMaterial({ color: 0x888888 });
  const doorM  = new THREE.MeshBasicMaterial({ color: 0x99bbaa, transparent:true, opacity:0.4, side: THREE.DoubleSide });
  // Cage frame
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 1.6), new THREE.MeshBasicMaterial({wireframe:true, color:0x888888}));
  box.position.y = 0.8; g.add(box);
  // Solid bottom
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 1.6), frameM);
  base.position.y = 0.05; g.add(base);
  // Semi-transparent door
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.5), doorM);
  door.position.set(0, 0.8, 0.82); g.add(door);
  return { mesh: g, r: 1.0, h: 1.7, type: "wall" };
}

function buildVetSignPost() {
  const g = new THREE.Group();
  const postM  = new THREE.MeshLambertMaterial({ color: 0xeeeeff });
  const crossM = new THREE.MeshBasicMaterial({ color: 0x00bb55 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 3.8, 6), postM);
  post.position.y = 1.9; post.castShadow = true; g.add(post);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.12), crossM);
  crossH.position.y = 3.6; g.add(crossH);
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 0.12), crossM);
  crossV.position.y = 3.6; g.add(crossV);
  // Sign board below cross
  const boardM = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const board  = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 0.1), boardM);
  board.position.y = 2.4; g.add(board);
  return { mesh: g, r: 0.7, h: 4.0, type: "wall" };
}

// ─────────────────────────────────────────────────────────────────────────────
// ── DISPATCHER ────────────────────────────────────────────────────────────────
function getRandomThemeObj(theme) {
  let r = srng();
  if (theme === "feet_bunnies")       return r < 0.5 ? buildBunny() : buildFoot();
  if (theme === "city")               return r < 0.4 ? buildCar() : buildSkyscraper();
  if (theme === "neon") {
    if (r < 0.4) return buildFurryTail(srng());
    if (r < 0.8) return buildAxeTarget();
    return { mesh: new THREE.Group(), r: 0, h: 0, type: "none" };
  }
  if (theme === "funny") {
    if (r < 0.3) return buildTractor();
    if (r < 0.6) return buildBunny();
    return buildTree(0.8 + srng() * 0.8, theme);
  }
  if (theme === "terrifying") {
    if (r < 0.4) return buildEerieEntity();
    if (r < 0.7) return buildAxeTarget();
    return buildTree(0.8 + srng() * 0.8, theme);
  }
  if (theme === "socks_basket")       return r < 0.6 ? buildSock() : buildLaundryBasket();
  if (theme === "backrooms")          return r < 0.5 ? buildBackroomsPillar() : buildBackroomsWall();
  if (theme === "public_poo")         return r < 0.5 ? buildToilet() : buildPoo();
  if (theme === "screaming_mamamia")  return r < 0.6 ? buildScreamingFace() : buildChaosSpike();
  if (theme === "disco") {
    if (r < 0.4) return buildDiscoball();
    if (r < 0.7) return buildDaftPunkHelmet();
    return buildDiscoBooth();
  }
  if (theme === "mountains") {
    if (r < 0.35) return buildRock(0.8 + srng() * 0.6);
    if (r < 0.7)  return buildPineTree(0.7 + srng() * 0.6);
    return buildMountainPeak();
  }
  if (theme === "geometry_dash") {
    if (r < 0.45) return buildGeoSpike();
    if (r < 0.75) return buildGeoBlock();
    return buildGeoPortal();
  }
  if (theme === "emote")      return r < 0.6 ? buildEmojiPillar() : buildDancingArrow();
  if (theme === "sixtyseven") return r < 0.55 ? buildGlitchPillar() : buildDataNode();
  if (theme === "winter") {
    if (r < 0.4) return buildSnowman();
    if (r < 0.7) return buildIceCrystal();
    return buildChristmasTree();
  }
  if (theme === "moon")   return r < 0.5 ? buildCrater() : buildMoonRock();
  if (theme === "office") {
    if (r < 0.4) return buildOfficeDesk();
    if (r < 0.7) return buildOfficeCubicleWall();
    return buildOfficeLamp();
  }
  if (theme === "cabbage") return buildCabbage();
  if (theme === "minion")  return r < 0.6 ? buildMinion() : buildTree(0.8 + srng() * 0.8, "funny");
  if (theme === "map67")   return buildGiantNumber(r < 0.5 ? 6 : 7);
  if (theme === "grandcanyon") return r < 0.6 ? buildCanyonWall() : buildRock(1 + srng());
  if (theme === "tornado")     return r < 0.5 ? buildTornadoFunnel() : buildRock(0.5 + srng() * 0.5);
  if (theme === "waterfall")   return r < 0.6 ? buildWaterfallRock() : buildPineTree(0.7 + srng() * 0.5);
  if (theme === "poolrooms")   return r < 0.5 ? buildPoolroomPillar() : buildPoolroomSignage();
  if (theme === "hogwarts")    return r < 0.4 ? buildHogwartsCandle() : r < 0.7 ? buildHogwartsStone() : buildHogwartsLantern();
  if (theme === "village")     return r < 0.35 ? buildVillageHaystack() : r < 0.65 ? buildVillageWell() : buildTree(0.7+srng()*0.5,"village");
  if (theme === "minecraft")   return r < 0.4 ? buildMinecraftBlock() : r < 0.7 ? buildMinecraftTree() : buildMinecraftCreeper();
  if (theme === "skyblock")    return r < 0.5 ? buildSkyblockCrate() : buildPineTree(0.6+srng()*0.4);
  if (theme === "vetschool") {
    if (r < 0.30) return buildVetDog();
    if (r < 0.55) return buildVetWoman();
    if (r < 0.72) return buildVetExamTable();
    if (r < 0.88) return buildVetCage();
    return buildVetSignPost();
  }
  if (r < 0.3) return buildFurryTail(srng());
  if (r < 0.5) return buildEerieEntity();
  return buildTree(0.8 + srng() * 0.8, theme);
}

// ── GLB OBSTACLE WRAPPER ─────────────────────────────────────────────
// Calls getRandomThemeObj for procedural mesh, then async-swaps if override exists.
// The obstacle type key used for MODEL_OVERRIDES matches the type string on the returned object.
function getThemeObstacle(theme) {
  var obj = getRandomThemeObj(theme);
  if (!obj || !obj.mesh) return obj;
  var key = obj.type;  // e.g. "tree", "car", "basket", etc.
  if (typeof loadModel === "function" && MODEL_OVERRIDES && MODEL_OVERRIDES[key]) {
    var mesh = obj.mesh;
    loadModel(key, function(glbGroup) {
      if (!glbGroup) return;
      while (mesh.children.length) mesh.remove(mesh.children[0]);
      mesh.add(glbGroup);
    });
  }
  return obj;
}
