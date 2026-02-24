import * as THREE from 'https://esm.sh/three';
import { OrbitControls } from 'https://esm.sh/three/examples/jsm/controls/OrbitControls.js';
import { vertexShader, fragmentShader } from './shaders.js';

const container = document.getElementById('globeViz');
const width  = container.clientWidth  || 500;
const height = container.clientHeight || 450;

// Scene, camera, renderer
const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 4000);
camera.position.set(0, 0, 300);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setSize(width, height);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.logarithmicDepthBuffer = true;
container.appendChild(renderer.domElement);

// OrbitControls — rotate only, no zoom or pan
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.08;
orbitControls.rotateSpeed   = 0.6;
orbitControls.enableZoom    = false;
orbitControls.enablePan     = false;

// Helper to build a shader material with the right shellRadius and planeType
const MAX_MODES = 6;

function makeMaterial(shellRadius, planeType, vShader = vertexShader) {
  return new THREE.ShaderMaterial({
    uniforms: {
      time:               { value: 0 },
      oscSpeed:           { value: 1.0 },
      nModes:             { value: 1 },
      n:                  { value: new Float32Array(MAX_MODES) },
      l:                  { value: new Float32Array(MAX_MODES) },
      m:                  { value: new Float32Array(MAX_MODES) },
      amp:                { value: new Float32Array(MAX_MODES) },
      omega0:             { value: new Float32Array(MAX_MODES) },
      phase:              { value: new Float32Array(MAX_MODES) },
      Omega:              { value: 0.0 },
      Cnl:                { value: 0.03 },
      shellRadius:        { value: shellRadius },
      planeType:          { value: planeType },
      starGroupRotationY: { value: 0.0 },
      enableCutaway:      { value: false },
      cutDir:             { value: new THREE.Vector3(1, 0, 0) },
    },
    vertexShader: vShader,
    fragmentShader,
    side: THREE.DoubleSide,
  });
}

// Vertex shader variant for planes: keep geometry flat, only compute colour
const planeVertexShader = vertexShader.replace(
  'pos *= (r + 5.0 * dr) / r;',
  '// pos *= (r + 5.0 * dr) / r;'
);

const starGroup = new THREE.Group();
scene.add(starGroup);

// Main sphere
const material = makeMaterial(1.0, 0);
material.depthWrite = true;
starGroup.add(new THREE.Mesh(new THREE.SphereGeometry(100, 256, 256), material));

// Inner cross-section planes
const planeDepth = 260;

function makePlaneMat(planeType) {
  const mat = makeMaterial(0.5, planeType, planeVertexShader);
  mat.transparent         = true;
  mat.depthWrite          = false;
  mat.depthTest           = true;
  mat.polygonOffset       = true;
  mat.polygonOffsetFactor = -2;
  mat.polygonOffsetUnits  = -2;
  return mat;
}

const equatorialMat  = makePlaneMat(3);
const meridional1Mat = makePlaneMat(1);
const meridional2Mat = makePlaneMat(2);

const equatorialPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(planeDepth, planeDepth, 256, 256), equatorialMat
);
equatorialPlane.rotation.x  = Math.PI / 2;
equatorialPlane.visible     = false;
equatorialPlane.renderOrder = 1;
starGroup.add(equatorialPlane);

const meridional1Plane = new THREE.Mesh(
  new THREE.PlaneGeometry(planeDepth, planeDepth, 256, 256), meridional1Mat
);
meridional1Plane.visible     = false;
meridional1Plane.renderOrder = 1;
starGroup.add(meridional1Plane);

const meridional2Plane = new THREE.Mesh(
  new THREE.PlaneGeometry(planeDepth, planeDepth, 256, 256), meridional2Mat
);
meridional2Plane.rotation.y  = -Math.PI / 2;
meridional2Plane.visible     = false;
meridional2Plane.renderOrder = 1;
starGroup.add(meridional2Plane);

const planes       = [equatorialPlane, meridional1Plane, meridional2Plane];
const allMaterials = [material, equatorialMat, meridional1Mat, meridional2Mat];

// Grid
const gridGroup      = new THREE.Group();
starGroup.add(gridGroup);

const gridMat        = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 });
const equatorLineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });

function makeLatitudeRing(latDeg, radius = 105) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const y   = radius * Math.sin(lat);
  const r   = radius * Math.cos(lat);
  const pts = [];
  for (let lon = 0; lon <= Math.PI * 2; lon += 0.05)
    pts.push(new THREE.Vector3(r * Math.cos(lon), y, r * Math.sin(lon)));
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat);
}

function makeLongitudeLine(lonDeg, radius = 105) {
  const lon = THREE.MathUtils.degToRad(lonDeg);
  const pts = [];
  for (let theta = 0; theta <= Math.PI; theta += 0.02)
    pts.push(new THREE.Vector3(
      radius * Math.sin(theta) * Math.cos(lon),
      radius * Math.cos(theta),
      radius * Math.sin(theta) * Math.sin(lon)
    ));
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat);
}

const equatorPts = [];
for (let lon = 0; lon <= Math.PI * 2; lon += 0.05)
  equatorPts.push(new THREE.Vector3(105 * Math.cos(lon), 0, 105 * Math.sin(lon)));
gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(equatorPts), equatorLineMat));

[30, -30, 60, -60].forEach(lat => gridGroup.add(makeLatitudeRing(lat)));
for (let lon = 0; lon < 360; lon += 30) gridGroup.add(makeLongitudeLine(lon));

// Rotation axis arrow
starGroup.add(new THREE.ArrowHelper(
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -120, 0),
  264, 0xff4444, 14, 8
));

// --- Edge lines (black outline of the cutaway) ---
const edgeGroup = new THREE.Group();
edgeGroup.renderOrder = 2;
starGroup.add(edgeGroup);

const edgeLineMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
const intersectionMat = new THREE.LineBasicMaterial({
  color: 0x000000, linewidth: 1,
  transparent: true, opacity: 0.7,
  depthTest: true, depthWrite: false
});

const numEdgePoints = 100;

function makeLineGeo(n) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  return geo;
}

const equatorialEdgeGeo  = makeLineGeo(numEdgePoints);
const meridional1EdgeGeo = makeLineGeo(numEdgePoints);
const meridional2EdgeGeo = makeLineGeo(numEdgePoints);
const xAxisGeo           = makeLineGeo(2);
const zAxisGeo           = makeLineGeo(2);
const yAxisGeo           = makeLineGeo(2);

const equatorialEdgeLine  = new THREE.Line(equatorialEdgeGeo,  edgeLineMat);
const meridional1EdgeLine = new THREE.Line(meridional1EdgeGeo, edgeLineMat);
const meridional2EdgeLine = new THREE.Line(meridional2EdgeGeo, edgeLineMat);
const xAxisLine           = new THREE.Line(xAxisGeo,           intersectionMat);
const zAxisLine           = new THREE.Line(zAxisGeo,           intersectionMat);
const yAxisLine           = new THREE.Line(yAxisGeo,           intersectionMat);

[equatorialEdgeLine, meridional1EdgeLine, meridional2EdgeLine,
 xAxisLine, zAxisLine, yAxisLine].forEach(line => {
  line.visible = false;
  edgeGroup.add(line);
});

// --- JS math (mirrors the GLSL, needed for edge line displacement) ---
function factorial(n) {
  let f = 1.0;
  for (let i = 1; i <= n; i++) f *= i;
  return f;
}

function legendreP(l, m, x) {
  let pmm = 1.0;
  if (m > 0) {
    const somx2 = Math.sqrt((1.0 - x) * (1.0 + x));
    let fact = 1.0;
    for (let i = 1; i <= m; i++) { pmm *= -fact * somx2; fact += 2.0; }
  }
  if (l === m) return pmm;
  let pmmp1 = x * (2.0 * m + 1.0) * pmm;
  if (l === m + 1) return pmmp1;
  let pll = 0.0;
  for (let ll = m + 2; ll <= l; ll++) {
    pll = ((2.0 * ll - 1.0) * x * pmmp1 - (ll + m - 1) * pmm) / (ll - m);
    pmm = pmmp1; pmmp1 = pll;
  }
  return pll;
}

function norm(l, m) {
  return Math.sqrt((2.0 * l + 1.0) / (4.0 * Math.PI) * factorial(l - m) / factorial(l + m));
}

function sphericalHarmonic(l, m, theta, phi) {
  const x  = Math.cos(theta);
  const mm = Math.abs(m);
  const P  = legendreP(l, mm, x);
  const N  = norm(l, mm);
  if (m > 0) return Math.sqrt(2.0) * N * P * Math.cos(mm * phi);
  if (m < 0) return Math.sqrt(2.0) * N * P * Math.sin(mm * phi);
  return N * P;
}

function calculateDisplacement(position) {
  const dir   = position.clone().normalize();
  const rNorm = position.length() / 100.0;
  const theta = Math.acos(Math.max(-1, Math.min(1, dir.y)));
  const phi   = Math.atan2(dir.z, dir.x);

  let dr = 0.0;
  const t       = material.uniforms.time.value;
  const Omega   = material.uniforms.Omega.value;
  const Cnl     = material.uniforms.Cnl.value;

  for (const mode of modes) {
    const R_nl        = Math.sin((mode.n + 0.5) * Math.PI * rNorm);
    const phiRotating = phi + mode.m * Omega * (1.0 - Cnl) * t;
    const Y_lm        = sphericalHarmonic(mode.l, mode.m, theta, phiRotating);
    dr += mode.amp * R_nl * Y_lm * Math.cos(mode.omega * t + mode.phase);
  }
  return dr;
}

function updateEdgeLines() {
  // Equatorial arc: phi 0 → 90°, y = 0
  const eqPos = equatorialEdgeGeo.attributes.position.array;
  for (let i = 0; i < numEdgePoints; i++) {
    const angle  = (i / (numEdgePoints - 1)) * Math.PI / 2;
    const base   = new THREE.Vector3(100 * Math.cos(angle), 0, 100 * Math.sin(angle));
    const dr     = calculateDisplacement(base);
    const newPos = base.normalize().multiplyScalar(100 + 5.0 * dr + 0.2);
    eqPos[i * 3] = newPos.x; eqPos[i * 3 + 1] = newPos.y; eqPos[i * 3 + 2] = newPos.z;
  }
  equatorialEdgeGeo.attributes.position.needsUpdate = true;

  // Meridional arc at phi = 0 (north pole → equator)
  const m1Pos = meridional1EdgeGeo.attributes.position.array;
  for (let i = 0; i < numEdgePoints; i++) {
    const theta  = (i / (numEdgePoints - 1)) * Math.PI / 2;
    const base   = new THREE.Vector3(100 * Math.sin(theta), 100 * Math.cos(theta), 0);
    const dr     = calculateDisplacement(base);
    const newPos = base.normalize().multiplyScalar(100 + 5.0 * dr + 0.2);
    m1Pos[i * 3] = newPos.x; m1Pos[i * 3 + 1] = newPos.y; m1Pos[i * 3 + 2] = newPos.z;
  }
  meridional1EdgeGeo.attributes.position.needsUpdate = true;

  // Meridional arc at phi = 90° (north pole → equator)
  const m2Pos = meridional2EdgeGeo.attributes.position.array;
  for (let i = 0; i < numEdgePoints; i++) {
    const theta  = (i / (numEdgePoints - 1)) * Math.PI / 2;
    const base   = new THREE.Vector3(0, 100 * Math.cos(theta), 100 * Math.sin(theta));
    const dr     = calculateDisplacement(base);
    const newPos = base.normalize().multiplyScalar(100 + 5.0 * dr + 0.2);
    m2Pos[i * 3] = newPos.x; m2Pos[i * 3 + 1] = newPos.y; m2Pos[i * 3 + 2] = newPos.z;
  }
  meridional2EdgeGeo.attributes.position.needsUpdate = true;

  // Axis lines from centre to oscillating surface
  function updateAxisLine(geo, baseVec) {
    const dr     = calculateDisplacement(baseVec);
    const end    = baseVec.clone().normalize().multiplyScalar(100 + 5.0 * dr);
    const pos    = geo.attributes.position.array;
    pos[0] = 0; pos[1] = 0; pos[2] = 0;
    pos[3] = end.x; pos[4] = end.y; pos[5] = end.z;
    geo.attributes.position.needsUpdate = true;
  }

  updateAxisLine(xAxisGeo, new THREE.Vector3(100, 0,   0));
  updateAxisLine(zAxisGeo, new THREE.Vector3(0,   0, 100));
  updateAxisLine(yAxisGeo, new THREE.Vector3(0, 100,   0));
}

// --- Mode state ---
const modes = [{ n: 2, l: 0, m: 0, amp: 1.5, omega: 1.0, phase: 0.0 }];

function uploadModes() {
  allMaterials.forEach(mat => {
    mat.uniforms.nModes.value = modes.length;
    modes.forEach((mode, i) => {
      mat.uniforms.n.value[i]      = mode.n;
      mat.uniforms.l.value[i]      = mode.l;
      mat.uniforms.m.value[i]      = mode.m;
      mat.uniforms.amp.value[i]    = mode.amp;
      mat.uniforms.omega0.value[i] = mode.omega;
      mat.uniforms.phase.value[i]  = mode.phase;
    });
  });
}

// --- Sliders ---
const nSlider = document.getElementById('n');
const lSlider = document.getElementById('l');
const mSlider = document.getElementById('m');
const nVal    = document.getElementById('nVal');
const lVal    = document.getElementById('lVal');
const mVal    = document.getElementById('mVal');

function clampMSlider() {
  const l = +lSlider.value;
  mSlider.min = -l;
  mSlider.max =  l;
  if (+mSlider.value < -l) mSlider.value = -l;
  if (+mSlider.value >  l) mSlider.value =  l;
}

function updateMode() {
  modes[0] = { n: +nSlider.value, l: +lSlider.value, m: +mSlider.value, amp: 1.5, omega: 1.0, phase: 0.0 };
  uploadModes();
}

function updateDisplay() {
  nVal.textContent = nSlider.value;
  lVal.textContent = lSlider.value;
  mVal.textContent = mSlider.value;
}

lSlider.addEventListener('input', () => { clampMSlider(); updateMode(); updateDisplay(); });
[nSlider, mSlider].forEach(el => el.addEventListener('input', () => { updateMode(); updateDisplay(); }));

// --- Cutaway toggle ---
document.getElementById('cutawayToggle').onchange = e => {
  const enabled = e.target.checked;
  allMaterials.forEach(mat => { mat.uniforms.enableCutaway.value = enabled; });
  planes.forEach(plane => { plane.visible = enabled; });
  edgeGroup.children.forEach(line => { line.visible = enabled; });
};

// Initialise
clampMSlider();
updateMode();
updateDisplay();

// --- Animation loop ---
let animationId = null;

function animate() {
  allMaterials.forEach(mat => {
    mat.uniforms.time.value += 0.02;
    mat.uniforms.starGroupRotationY.value = starGroup.rotation.y;
  });
  if (document.getElementById('cutawayToggle').checked) {
    updateEdgeLines();
  }
  orbitControls.update();
  renderer.render(scene, camera);
  animationId = requestAnimationFrame(animate);
}

// Pause/resume messages from Reveal.js parent slide
window.addEventListener('message', e => {
  if (e.data === 'slide-active'   && !animationId) animate();
  if (e.data === 'slide-inactive') { cancelAnimationFrame(animationId); animationId = null; }
});

animate();

// Resize
window.addEventListener('resize', () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});
