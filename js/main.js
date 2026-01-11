import * as THREE from 'https://esm.sh/three';
import { OrbitControls } from 'https://esm.sh/three/examples/jsm/controls/OrbitControls.js';
import { vertexShader, fragmentShader } from './shaders.js';

const container = document.getElementById('globeViz');
const width = window.innerWidth;
const height = window.innerHeight;

// Scene, camera, renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 4000);
// This is the position of the camera. The last number is the distance to the star
camera.position.set(0, 0, 300);

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
const skyGeometry = new THREE.SphereGeometry(1000, 64, 64);
const loader = new THREE.TextureLoader();
const skyMaterial = new THREE.MeshBasicMaterial({
  map: loader.load('/assets/night-sky.png'),
  side: THREE.BackSide,
  depthWrite: false
});
const skySphere = new THREE.Mesh(skyGeometry, skyMaterial);
scene.add(skySphere);

// Shader material
const MAX_MODES = 6;
const material = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
    nModes: { value: 1 },
    n: { value: new Float32Array(MAX_MODES) },
    l: { value: new Float32Array(MAX_MODES) },
    m: { value: new Float32Array(MAX_MODES) },
    amp: { value: new Float32Array(MAX_MODES) },
    omega0: { value: new Float32Array(MAX_MODES) },
    phase: { value: new Float32Array(MAX_MODES) },
    Omega: { value: 0.3 },
    Cnl: { value: 0.03 },
    enableCutaway: { value: false },
    cutDir: { value: new THREE.Vector3(1, 0, 0) },
    cutAngle: { value: Math.PI / 6 }
  },
  vertexShader,
  fragmentShader
});

// Create star group for rotating elements
const starGroup = new THREE.Group();
scene.add(starGroup);

// Sphere
const sphereGeo = new THREE.SphereGeometry(100, 256, 256);
const sphere = new THREE.Mesh(sphereGeo, material);
starGroup.add(sphere);

// Sliders
const nSlider = document.getElementById('n');
const lSlider = document.getElementById('l');
const mSlider = document.getElementById('m');
const ampSlider = document.getElementById('amp');
const rotSlider = document.getElementById('rot');
const nVal = document.getElementById('nVal');
const lVal = document.getElementById('lVal');
const mVal = document.getElementById('mVal');
const ampVal = document.getElementById('ampVal');
const rotVal = document.getElementById('rotVal');
const cutAngleVal = document.getElementById('cutAngleVal');
const modeItems = document.getElementById('modeItems');

const modes = [
  {n:2, l: 0, m: 0, amp: 1.0, omega: 1.0, phase: 0.0, enabled: true}
];

function uploadModes() {
  const activeModes = modes.filter(m => m.enabled);

  material.uniforms.nModes.value = activeModes.length;

  activeModes.forEach((mode, i) => {
    material.uniforms.n.value[i] = mode.n;
    material.uniforms.l.value[i] = mode.l;
    material.uniforms.m.value[i] = mode.m;
    material.uniforms.amp.value[i] = mode.amp;
    material.uniforms.omega0.value[i] = mode.omega;
    material.uniforms.phase.value[i] = mode.phase;
  });
  updateModeList();
  material.uniforms.enableCutaway.value =
    document.getElementById('cutawayToggle').checked;
}


function updateMode() {
  modes[0] = {
    n: +nSlider.value,
    l: +lSlider.value,
    m: +mSlider.value,
    amp: +ampSlider.value,
    omega: 1.0,
    phase: 0.0,
    enabled: true
  };
  material.uniforms.Omega.value = +rotSlider.value;
  uploadModes();
}

function clampMSlider() {
  const l = +lSlider.value;
  mSlider.min = -l;
  mSlider.max = l;
  if (+mSlider.value < -l) mSlider.value = -l;
  if (+mSlider.value > l) mSlider.value = l;
}

function updateSliderDisplay() {
  nVal.textContent = nSlider.value;
  lVal.textContent = lSlider.value;
  mVal.textContent = mSlider.value;
  rotVal.textContent = (+rotSlider.value).toFixed(2);
  ampVal.textContent = (+ampSlider.value).toFixed(2);
}

// Update mode list display

function updateModeList() {
  modeItems.innerHTML = '';

  modes.forEach((mode, i) => {
    const li = document.createElement('li');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = mode.enabled;
    checkbox.onchange = () => {
      mode.enabled = checkbox.checked;
      uploadModes();
    };

    const label = document.createElement('span');
    label.style.marginLeft = '6px';
    const mSign = mode.m >= 0 ? '+' : '−';
    label.textContent =
      `Mode ${i + 1}: n=${mode.n}, ℓ=${mode.l}, m=${mSign}${Math.abs(mode.m)}, ` +
      `A=${mode.amp.toFixed(2)}, ω=${mode.omega.toFixed(2)}`;

    const remove = document.createElement('button');
    remove.textContent = 'x';
    remove.style.marginLeft = '8px';
    remove.onclick = () => {
      modes.splice(i, 1);
      uploadModes();
      updateModeList();
    };

    li.appendChild(checkbox);
    li.appendChild(label);
    li.appendChild(remove);
    modeItems.appendChild(li);
  });
}

lSlider.addEventListener('input', () => {
  clampMSlider();
  updateMode();
  updateSliderDisplay();
});

[nSlider, mSlider, ampSlider, rotSlider].forEach(el =>
  el.addEventListener('input', () => {
    updateMode();
    updateSliderDisplay();
  })
);

document.getElementById('addMode').onclick = () => {
  if (modes.length >= MAX_MODES) return;
  modes.push({
    n: +nSlider.value,
    l: +lSlider.value,
    m: +mSlider.value,
    amp: +ampSlider.value,
    omega: 1.0 + 0.2 * modes.length,
    phase: Math.random() * Math.PI * 2,
    enabled: true
  });
  uploadModes();
};

document.getElementById('clearModes').onclick = () => {
  modes.length = 1;
  modes[0] = {
    n: +nSlider.value,
    l: +lSlider.value,
    m: +mSlider.value,
    amp: +ampSlider.value,
    omega: 1.0,
    phase: 0.0,
    enabled: true
  };
  uploadModes();
};

// Grid elements
const gridGroup = new THREE.Group();
starGroup.add(gridGroup);

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
gridGroup.add(equator);

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
latLines.forEach(r => gridGroup.add(r));

const equatorToggle = document.getElementById('toggleEquator');
equatorToggle.addEventListener('change', e => {
  gridGroup.visible = e.target.checked;
  axisArrow.visible = e.target.checked;
});

// Rotation arrow
const axisArrow = new THREE.ArrowHelper(
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -120, 0),
  240,
  0xff4444,
  14,
  8
);
starGroup.add(axisArrow);

// Cone cut-away
document.getElementById('cutawayToggle').onchange = e => {
  material.uniforms.enableCutaway.value = e.target.checked;
};

document.getElementById('cutAngle').oninput = e => {
  const angle = +e.target.value;
  cutAngleVal.textContent = angle;
  material.uniforms.cutAngle.value = THREE.MathUtils.degToRad(angle);
};

// Initialize
clampMSlider();
updateMode();
updateSliderDisplay();

// Animation loop
function animate() {
  material.uniforms.time.value += 0.02;
  starGroup.rotation.y += 0.001;

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
