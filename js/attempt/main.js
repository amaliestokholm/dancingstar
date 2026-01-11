import * as THREE from 'https://esm.sh/three@0.128.0';
import { OrbitControls } from 'https://esm.sh/three@0.128.0/examples/jsm/controls/OrbitControls.js';

const container = document.getElementById('globeViz');
const width = window.innerWidth;
const height = window.innerHeight;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
camera.position.set(0, 0, 400);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(width, height);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.6;
controls.enableZoom = true;

// Lights
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(1, 1, 1);
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0x888888));

// Starfield background
const starsGeometry = new THREE.BufferGeometry();
const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 2 });
const starsVertices = [];
for (let i = 0; i < 3000; i++) {
  const x = (Math.random() - 0.5) * 2000;
  const y = (Math.random() - 0.5) * 2000;
  const z = (Math.random() - 0.5) * 2000;
  starsVertices.push(x, y, z);
}
starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
const stars = new THREE.Points(starsGeometry, starsMaterial);
scene.add(stars);

// Shader material
const MAX_MODES = 6;
const material = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
    nModes: { value: 1 },
    l: { value: new Float32Array(MAX_MODES) },
    m: { value: new Float32Array(MAX_MODES) },
    amp: { value: new Float32Array(MAX_MODES) },
    omega0: { value: new Float32Array(MAX_MODES) },
    phase: { value: new Float32Array(MAX_MODES) },
    Omega: { value: 0.3 },
    Cnl: { value: 0.03 }
  },
  vertexShader,
  fragmentShader
});

// Sphere
const sphereGeo = new THREE.SphereGeometry(100, 256, 256);
const sphere = new THREE.Mesh(sphereGeo, material);
scene.add(sphere);

// UI Elements
const lSlider = document.getElementById('l');
const mSlider = document.getElementById('m');
const ampSlider = document.getElementById('amp');
const rotSlider = document.getElementById('rot');
const lVal = document.getElementById('lVal');
const mVal = document.getElementById('mVal');
const ampVal = document.getElementById('ampVal');
const rotVal = document.getElementById('rotVal');

// Modes management
const modes = [
  { l: 3, m: 2, amp: 1.5, omega: 1.0, phase: 0.0 }
];

function uploadModes() {
  material.uniforms.nModes.value = modes.length;
  modes.forEach((mode, i) => {
    material.uniforms.l.value[i] = mode.l;
    material.uniforms.m.value[i] = mode.m;
    material.uniforms.amp.value[i] = mode.amp;
    material.uniforms.omega0.value[i] = mode.omega;
    material.uniforms.phase.value[i] = mode.phase;
  });
  updateModeSummary();
}

function updateModeSummary() {
  const summary = modes.map((m, i) => 
    `Mode ${i+1}: ℓ=${m.l}, m=${m.m}, A=${m.amp.toFixed(1)}`
  ).join('<br>');
  document.getElementById('modeSummary').innerHTML = summary;
}

function updateMode() {
  modes[0] = {
    l: +lSlider.value,
    m: +mSlider.value,
    amp: +ampSlider.value,
    omega: 1.0,
    phase: 0.0
  };
  material.uniforms.Omega.value = +rotSlider.value;
  uploadModes();
}

function updateSliderDisplay() {
  lVal.textContent = lSlider.value;
  mVal.textContent = mSlider.value;
  rotVal.textContent = (+rotSlider.value).toFixed(2);
  ampVal.textContent = (+ampSlider.value).toFixed(2);
}

[lSlider, mSlider, ampSlider, rotSlider].forEach(el =>
  el.addEventListener('input', () => {
    updateMode();
    updateSliderDisplay();
  })
);

document.getElementById('addMode').onclick = () => {
  if (modes.length >= MAX_MODES) return;
  modes.push({
    l: +lSlider.value,
    m: +mSlider.value,
    amp: +ampSlider.value,
    omega: 1.0 + 0.2 * modes.length,
    phase: Math.random() * Math.PI * 2
  });
  uploadModes();
};

document.getElementById('clearModes').onclick = () => {
  modes.length = 1;
  modes[0] = {
    l: +lSlider.value,
    m: +mSlider.value,
    amp: +ampSlider.value,
    omega: 1.0,
    phase: 0.0
  };
  uploadModes();
};

// Equator and latitude rings
const equatorRadius = 101;
const equatorGeo = new THREE.RingGeometry(equatorRadius - 0.2, equatorRadius + 0.2, 256);
const equatorMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.35
});
const equator = new THREE.Mesh(equatorGeo, equatorMat);
equator.rotation.x = Math.PI / 2;
scene.add(equator);

function makeLatitudeRing(latDeg, radius = 101) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const ringGeo = new THREE.RingGeometry(radius - 0.15, radius + 0.15, 256);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.25
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2 - lat;
  return ring;
}

const latLines = [
  makeLatitudeRing(30),
  makeLatitudeRing(-30),
  makeLatitudeRing(60),
  makeLatitudeRing(-60)
];
latLines.forEach(r => scene.add(r));

const equatorToggle = document.getElementById('toggleEquator');
equatorToggle.addEventListener('change', e => {
  const visible = e.target.checked;
  equator.visible = visible;
  latLines.forEach(r => r.visible = visible);
  axisArrow.visible = visible;
});

// Rotation arrow
const axisDir = new THREE.Vector3(0, 1, 0);
const axisOrigin = new THREE.Vector3(0, -120, 0);
const axisLength = 240;
const axisArrow = new THREE.ArrowHelper(axisDir, axisOrigin, axisLength, 0xff4444, 10, 6);
scene.add(axisArrow);

// Initialize
updateMode();
updateSliderDisplay();

// Animation loop
function animate() {
  material.uniforms.time.value += 0.02;
  sphere.rotation.y += 0.001;
  equator.rotation.y = sphere.rotation.y;
  latLines.forEach(r => r.rotation.y = sphere.rotation.y);
  axisArrow.rotation.y = sphere.rotation.y;
  
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// Resize handling
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
