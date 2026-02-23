import * as THREE from 'https://esm.sh/three';
import { vertexShader, fragmentShader } from './shaders.js';

const container = document.getElementById('globeViz');
const width = container.clientWidth;
const height = container.clientHeight;

// Scene, camera, renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 4000);
camera.position.set(0, 0, 300);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0); // transparent background
renderer.setSize(width, height);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.logarithmicDepthBuffer = true;
container.appendChild(renderer.domElement);

// Shader material
const MAX_MODES = 6;
const material = new THREE.ShaderMaterial({
  uniforms: {
    time:                { value: 0 },
    oscSpeed:            { value: 1.0 },
    nModes:              { value: 1 },
    n:                   { value: new Float32Array(MAX_MODES) },
    l:                   { value: new Float32Array(MAX_MODES) },
    m:                   { value: new Float32Array(MAX_MODES) },
    amp:                 { value: new Float32Array(MAX_MODES) },
    omega0:              { value: new Float32Array(MAX_MODES) },
    phase:               { value: new Float32Array(MAX_MODES) },
    Omega:               { value: 0.0 },
    Cnl:                 { value: 0.03 },
    shellRadius:         { value: 1.0 },
    planeType:           { value: 0 },
    starGroupRotationY:  { value: 0.0 },
    enableCutaway:       { value: false },
    cutDir:              { value: new THREE.Vector3(1, 0, 0) },
  },
  vertexShader,
  fragmentShader,
  side: THREE.DoubleSide,
  depthWrite: true,
});

const starGroup = new THREE.Group();
scene.add(starGroup);

// Sphere
const sphereGeo = new THREE.SphereGeometry(100, 256, 256);
const sphere = new THREE.Mesh(sphereGeo, material);
starGroup.add(sphere);

// Grid
const gridGroup = new THREE.Group();
starGroup.add(gridGroup);

const gridMaterial = new THREE.LineBasicMaterial({
  color: 0xffffff, transparent: true, opacity: 0.25
});
const equatorMat = new THREE.LineBasicMaterial({
  color: 0xffffff, transparent: true, opacity: 0.9
});

function makeLatitudeRing(latDeg, radius = 105) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const y = radius * Math.sin(lat);
  const ringRadius = radius * Math.cos(lat);
  const points = [];
  for (let lon = 0; lon <= Math.PI * 2; lon += 0.05)
    points.push(new THREE.Vector3(ringRadius * Math.cos(lon), y, ringRadius * Math.sin(lon)));
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), gridMaterial);
}

function makeLongitudeLine(lonDeg, radius = 105) {
  const lon = THREE.MathUtils.degToRad(lonDeg);
  const points = [];
  for (let theta = 0; theta <= Math.PI; theta += 0.02)
    points.push(new THREE.Vector3(
      radius * Math.sin(theta) * Math.cos(lon),
      radius * Math.cos(theta),
      radius * Math.sin(theta) * Math.sin(lon)
    ));
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), gridMaterial);
}

// Equator
const equatorPoints = [];
for (let lon = 0; lon <= Math.PI * 2; lon += 0.05)
  equatorPoints.push(new THREE.Vector3(105 * Math.cos(lon), 0, 105 * Math.sin(lon)));
gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(equatorPoints), equatorMat));

[30, -30, 60, -60].forEach(lat => gridGroup.add(makeLatitudeRing(lat)));
for (let lon = 0; lon < 360; lon += 30) gridGroup.add(makeLongitudeLine(lon));

// Rotation axis arrow
const axisArrow = new THREE.ArrowHelper(
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -120, 0),
  264, 0xff4444, 14, 8
);
starGroup.add(axisArrow);

// --- Sliders ---
const nSlider  = document.getElementById('n');
const lSlider  = document.getElementById('l');
const mSlider  = document.getElementById('m');
const nVal     = document.getElementById('nVal');
const lVal     = document.getElementById('lVal');
const mVal     = document.getElementById('mVal');

const modes = [{ n: 2, l: 0, m: 0, amp: 1.5, omega: 1.0, phase: 0.0 }];

function uploadModes() {
  material.uniforms.nModes.value = modes.length;
  modes.forEach((mode, i) => {
    material.uniforms.n.value[i]      = mode.n;
    material.uniforms.l.value[i]      = mode.l;
    material.uniforms.m.value[i]      = mode.m;
    material.uniforms.amp.value[i]    = mode.amp;
    material.uniforms.omega0.value[i] = mode.omega;
    material.uniforms.phase.value[i]  = mode.phase;
  });
}

function clampMSlider() {
  const l = +lSlider.value;
  mSlider.min = -l;
  mSlider.max = l;
  if (+mSlider.value < -l) mSlider.value = -l;
  if (+mSlider.value >  l) mSlider.value =  l;
}

function updateMode() {
  modes[0] = {
    n:     +nSlider.value,
    l:     +lSlider.value,
    m:     +mSlider.value,
    amp:   1.5,
    omega: 1.0,
    phase: 0.0,
  };
  uploadModes();
}

function updateDisplay() {
  nVal.textContent = nSlider.value;
  lVal.textContent = lSlider.value;
  mVal.textContent = mSlider.value;
}

lSlider.addEventListener('input', () => { clampMSlider(); updateMode(); updateDisplay(); });
[nSlider, mSlider].forEach(el => el.addEventListener('input', () => { updateMode(); updateDisplay(); }));

// Initialise
clampMSlider();
updateMode();
updateDisplay();

// Animation loop
function animate() {
  material.uniforms.time.value += 0.02;
  material.uniforms.starGroupRotationY.value = starGroup.rotation.y;
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// Resize
window.addEventListener('resize', () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});
