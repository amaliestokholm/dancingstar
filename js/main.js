import * as THREE from 'https://esm.sh/three';
import { OrbitControls } from 'https://esm.sh/three/examples/jsm/controls/OrbitControls.js';
import { vertexShader, fragmentShader } from './shaders.js';

const container = document.getElementById('globeViz');
const width = window.innerWidth;
const height = window.innerHeight;

// Scene, camera, renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 4000);
// The position of the camera. The last number is the distance to the star
camera.position.set(0, 0, 300);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.sortObjects = true;
renderer.setSize(width, height);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.logarithmicDepthBuffer = true;
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
  map: loader.load('assets/night-sky.png'),
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
    oscSpeed: { value: 1.0 },
    nModes: { value: 1 },
    n: { value: new Float32Array(MAX_MODES) },
    l: { value: new Float32Array(MAX_MODES) },
    m: { value: new Float32Array(MAX_MODES) },
    amp: { value: new Float32Array(MAX_MODES) },
    omega0: { value: new Float32Array(MAX_MODES) },
    phase: { value: new Float32Array(MAX_MODES) },
    Omega: { value: 0.3 },
    Cnl: { value: 0.03 },
    shellRadius: {value: 1 },
    enableCutaway: { value: false },
    cutDir: { value: new THREE.Vector3(1, 0, 0) },
  },
  vertexShader,
  fragmentShader
});
material.uniforms.shellRadius.value = 1.0;
material.transparent = true;
material.opacity = 1.0;
material.depthWrite = true;
material.side = THREE.DoubleSide;

const starGroup = new THREE.Group();
scene.add(starGroup);

// Sphere
const sphereGeo = new THREE.SphereGeometry(100, 256, 256);
const sphere = new THREE.Mesh(sphereGeo, material);
// sphere.renderOrder = 10;
starGroup.add(sphere);

// Inner planes, cross-sections showing radial oscillation patterns
const oscillationMaterials = [];
oscillationMaterials.push(material);

const planes = [];
const planeDepth = 240;

const planeVertexShader = vertexShader.replace(
  'pos *= (r + 5.0 * dr) / r;',
  '// pos *= (r + 5.0 * dr) / r; // Keep plane flat, just calculate color'
);

// Plane 1: Equatorial plane
const equatorialGeo = new THREE.PlaneGeometry(planeDepth, planeDepth, 256, 256);
const equatorialMat = new THREE.ShaderMaterial({
  uniforms: THREE.UniformsUtils.clone(material.uniforms),
  vertexShader: planeVertexShader,
  fragmentShader: fragmentShader,
  transparent: true,
  depthWrite: false,
  depthTest: true,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
  side: THREE.DoubleSide
});
equatorialMat.uniforms.shellRadius.value = 0.5;  // Mark as plane
oscillationMaterials.push(equatorialMat);

const equatorialPlane = new THREE.Mesh(equatorialGeo, equatorialMat);
equatorialPlane.rotation.x = Math.PI / 2;
equatorialPlane.visible = false;
equatorialPlane.renderOrder = 1;
planes.push(equatorialPlane);
starGroup.add(equatorialPlane);

// Plane 2 & 3: Two meridional planes showing radial patterns
// Plane at phi=0deg (XY plane, normal along +Z)
const meridional1Geo = new THREE.PlaneGeometry(planeDepth, planeDepth, 256, 256);
const meridional1Mat = new THREE.ShaderMaterial({
  uniforms: THREE.UniformsUtils.clone(material.uniforms),
  vertexShader: planeVertexShader,
  fragmentShader: fragmentShader,
  transparent: true,
  depthWrite: false,
  depthTest: true,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
  side: THREE.FrontSide
});
meridional1Mat.uniforms.shellRadius.value = 0.5;
oscillationMaterials.push(meridional1Mat);

const meridional1Plane = new THREE.Mesh(meridional1Geo, meridional1Mat);
meridional1Plane.visible = false;
meridional1Plane.renderOrder = 1;
planes.push(meridional1Plane);
starGroup.add(meridional1Plane);

// Plane at phi=90deg (YZ plane, normal along +X)  
const meridional2Geo = new THREE.PlaneGeometry(planeDepth, planeDepth, 256, 256);
const meridional2Mat = new THREE.ShaderMaterial({
  uniforms: THREE.UniformsUtils.clone(material.uniforms),
  vertexShader: planeVertexShader,
  fragmentShader: fragmentShader,
  transparent: true,
  depthWrite: false,
  depthTest: true,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
  side: THREE.DoubleSide
});
meridional2Mat.uniforms.shellRadius.value = 0.5;
oscillationMaterials.push(meridional2Mat);

const meridional2Plane = new THREE.Mesh(meridional2Geo, meridional2Mat);
// Rotate 90deg around Y to get YZ plane (normal along X)
meridional2Plane.rotation.y = - Math.PI / 2;
meridional2Plane.visible = false;
meridional2Plane.renderOrder = 1;
planes.push(meridional2Plane);
starGroup.add(meridional2Plane);

// Sliders
const nSlider = document.getElementById('n');
const lSlider = document.getElementById('l');
const mSlider = document.getElementById('m');
const ampSlider = document.getElementById('amp');
const rotSlider = document.getElementById('rot');
const starRotSlider = document.getElementById('starRot');
const oscSpeedSlider = document.getElementById('oscSpeed');
const nVal = document.getElementById('nVal');
const lVal = document.getElementById('lVal');
const mVal = document.getElementById('mVal');
const ampVal = document.getElementById('ampVal');
const rotVal = document.getElementById('rotVal');
const starRotVal = document.getElementById('starRotVal');
const oscSpeedVal = document.getElementById('oscSpeedVal');
const modeItems = document.getElementById('modeItems');

const modes = [
  {n:2, l: 0, m: 0, amp: 1.0, omega: 1.0, phase: 0.0, enabled: true}
];

function uploadModes() {
  const activeModes = modes.filter(m => m.enabled);

  oscillationMaterials.forEach(mat => {
    mat.uniforms.nModes.value = activeModes.length;
    
    activeModes.forEach((mode, i) => {
      mat.uniforms.n.value[i] = mode.n;
      mat.uniforms.l.value[i] = mode.l;
      mat.uniforms.m.value[i] = mode.m;
      mat.uniforms.amp.value[i] = mode.amp;
      mat.uniforms.omega0.value[i] = mode.omega;
      mat.uniforms.phase.value[i] = mode.phase;
    });
  });
  updateModeList();
  oscillationMaterials.forEach(mat => {
    mat.uniforms.enableCutaway.value = document.getElementById('cutawayToggle').checked;
  });
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
  oscillationMaterials.forEach(mat => {
    mat.uniforms.Omega.value = +rotSlider.value;
  });
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
  starRotVal.textContent = (+starRotSlider.value).toFixed(4);
  oscSpeedVal.textContent = (+oscSpeedSlider.value).toFixed(2);
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
    const mSign = mode.m >= 0 ? '+' : '-';
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

starRotSlider.addEventListener('input', () => {
  updateSliderDisplay();
});

oscSpeedSlider.addEventListener('input', () => {
  oscillationMaterials.forEach(mat => {
    mat.uniforms.oscSpeed.value = +oscSpeedSlider.value;
  });
  updateSliderDisplay();
});


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

// Grid
const gridGroup = new THREE.Group();
starGroup.add(gridGroup);

const gridMaterial = new THREE.LineBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.25
});

// Latitude lines (circles parallel to equator)
const gridRadius = 105;
function makeLatitudeRing(latDeg, radius = gridRadius) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const y = radius * Math.sin(lat);  // Height above/below equator
  const ringRadius = radius * Math.cos(lat);  // Radius of the circle at this latitude
  
  const points = [];
  for (let lon = 0; lon <= Math.PI * 2; lon += 0.05) {
    points.push(new THREE.Vector3(
      ringRadius * Math.cos(lon),
      y,
      ringRadius * Math.sin(lon)
    ));
  }
  const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(lineGeo, gridMaterial);
}

// Equator
const equatorMat = new THREE.LineBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.9
});
const equatorPoints = [];
for (let lon = 0; lon <= Math.PI * 2; lon += 0.05) {
  equatorPoints.push(new THREE.Vector3(
    gridRadius * Math.cos(lon),
    0,
    gridRadius * Math.sin(lon)
  ));
}
const equatorGeo = new THREE.BufferGeometry().setFromPoints(equatorPoints);
const equator = new THREE.Line(equatorGeo, equatorMat);
gridGroup.add(equator);

// Latitude lines every 30 degrees
const latLines = [
  makeLatitudeRing(30),
  makeLatitudeRing(-30),
  makeLatitudeRing(60),
  makeLatitudeRing(-60)
];
latLines.forEach(line => gridGroup.add(line));

// Longitude lines (meridians from pole to pole)
function makeLongitudeLine(lonDeg, radius = gridRadius) {
  const lon = THREE.MathUtils.degToRad(lonDeg);
  const points = [];
  // From south pole to north pole
  for (let theta = 0; theta <= Math.PI; theta += 0.02) {
    points.push(new THREE.Vector3(
      radius * Math.sin(theta) * Math.cos(lon),  // X
      radius * Math.cos(theta),                   // Y (polar axis)
      radius * Math.sin(theta) * Math.sin(lon)   // Z
    ));
  }
  const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(lineGeo, gridMaterial);
}

// Longitude lines every 30 degrees
const lonLines = [];
for (let lon = 0; lon < 360; lon += 30) {
  lonLines.push(makeLongitudeLine(lon));
}
lonLines.forEach(line => gridGroup.add(line));

const equatorToggle = document.getElementById('toggleEquator');
equatorToggle.addEventListener('change', e => {
  gridGroup.visible = e.target.checked;
  axisArrow.visible = e.target.checked;
});

// Rotation arrow
const axisArrow = new THREE.ArrowHelper(
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -120, 0),
  264,
  0xff4444,
  14,
  8
);
starGroup.add(axisArrow);

const edgeGroup = new THREE.Group();
edgeGroup.renderOrder = 2;
starGroup.add(edgeGroup);

const edgeLineMaterial = new THREE.LineBasicMaterial({
  color: 0x000000,
  linewidth: 2,
  depthTest: true,
  depthWrite: false
});

const numEdgePoints = 100;

// Edge 1: Equatorial arc (from phi=0 to phi=90 at y=0)
const equatorialEdgeGeo = new THREE.BufferGeometry();
const equatorialEdgePositions = new Float32Array(numEdgePoints * 3);
equatorialEdgeGeo.setAttribute('position', new THREE.BufferAttribute(equatorialEdgePositions, 3));
const equatorialEdgeLine = new THREE.Line(equatorialEdgeGeo, edgeLineMaterial);
equatorialEdgeLine.visible = false;
edgeGroup.add(equatorialEdgeLine);

// Edge 2: Meridional arc at phi=0 (from north pole to equator)
const meridional1EdgeGeo = new THREE.BufferGeometry();
const meridional1EdgePositions = new Float32Array(numEdgePoints * 3);
meridional1EdgeGeo.setAttribute('position', new THREE.BufferAttribute(meridional1EdgePositions, 3));
const meridional1EdgeLine = new THREE.Line(meridional1EdgeGeo, edgeLineMaterial);
meridional1EdgeLine.visible = false;
edgeGroup.add(meridional1EdgeLine);

// Edge 3: Meridional arc at phi=90 (from north pole to equator)
const meridional2EdgeGeo = new THREE.BufferGeometry();
const meridional2EdgePositions = new Float32Array(numEdgePoints * 3);
meridional2EdgeGeo.setAttribute('position', new THREE.BufferAttribute(meridional2EdgePositions, 3));
const meridional2EdgeLine = new THREE.Line(meridional2EdgeGeo, edgeLineMaterial);
meridional2EdgeLine.visible = false;
edgeGroup.add(meridional2EdgeLine);


// Intersection lines
const intersectionMaterial = new THREE.LineBasicMaterial({
  color: 0x000000,
  linewidth: 1,
  transparent: true,
  opacity: 0.7,
  depthTest: true,
  depthWrite: false
});

const xAxisGeo = new THREE.BufferGeometry();
const xAxisPositions = new Float32Array(2 * 3);
xAxisGeo.setAttribute('position', new THREE.BufferAttribute(xAxisPositions, 3));
const xAxisLine = new THREE.Line(xAxisGeo, intersectionMaterial);
xAxisLine.visible = false;
edgeGroup.add(xAxisLine);

const zAxisGeo = new THREE.BufferGeometry();
const zAxisPositions = new Float32Array(2 * 3);
zAxisGeo.setAttribute('position', new THREE.BufferAttribute(zAxisPositions, 3));
const zAxisLine = new THREE.Line(zAxisGeo, intersectionMaterial);
zAxisLine.visible = false;
edgeGroup.add(zAxisLine);

const yAxisGeo = new THREE.BufferGeometry();
const yAxisPositions = new Float32Array(2 * 3);
yAxisGeo.setAttribute('position', new THREE.BufferAttribute(yAxisPositions, 3));
const yAxisLine = new THREE.Line(yAxisGeo, intersectionMaterial);
yAxisLine.visible = false;
edgeGroup.add(yAxisLine);


// Function to calculate displacement at a given position
function calculateDisplacement(position) {
  const dir = new THREE.Vector3(position.x, position.y, position.z).normalize();
  const rRadial = position.length();
  const rNorm = rRadial / 100.0;

  const theta = Math.acos(Math.max(-1, Math.min(1, dir.y)));
  const phi = Math.atan2(dir.z, dir.x);

  let dr = 0.0;
  const activeModes = modes.filter(m => m.enabled);
  const currentTime = material.uniforms.time.value;
  const oscSpeed = material.uniforms.oscSpeed.value;
  const Omega = material.uniforms.Omega.value;
  const Cnl = material.uniforms.Cnl.value;

  for (const mode of activeModes) {
    const omega = mode.omega + mode.m * Omega * (1.0 - Cnl);
    const R_nl = Math.sin((mode.n + 0.5) * Math.PI * rNorm);
    const Y_lm = calculateSphericalHarmonic(mode.l, mode.m, theta, phi);
    dr += mode.amp * R_nl * Y_lm * Math.cos(omega * currentTime * oscSpeed + mode.phase);
  }

  return dr;
}

function factorial(n) {
  let f = 1.0;
  for (let i = 1; i <= n; i++) {
    f *= i;
  }
  return f;
}

function legendreP(l, m, x) {
  let pmm = 1.0;

  if (m > 0) {
    const somx2 = Math.sqrt((1.0 - x) * (1.0 + x));
    let fact = 1.0;
    for (let i = 1; i <= m; i++) {
      pmm *= -fact * somx2;
      fact += 2.0;
    }
  }
  if (l === m) return pmm;

  let pmmp1 = x * (2.0 * m + 1.0) * pmm;
  if (l === m + 1) return pmmp1;

  let pll = 0.0;
  for (let ll = m + 2; ll <= l; ll++) {
    pll = ((2.0 * ll - 1.0) * x * pmmp1 - (ll + m - 1) * pmm) / (ll - m);
    pmm = pmmp1;
    pmmp1 = pll;
  }

  return pll;
}

function norm(l, m) {
  return Math.sqrt(
    (2.0 * l + 1.0) / (4.0 * Math.PI) *
    factorial(l - m) / factorial(l + m)
  );
}

// Simplified spherical harmonic calculation (Y_0^0 and Y_2^0 for common modes)
function calculateSphericalHarmonic(l, m, theta, phi) {
  const x = Math.cos(theta);
  const mm = Math.abs(m);

  const P = legendreP(l, mm, x);
  const N = norm(l, mm);

  if (m > 0) {
    return Math.sqrt(2.0) * N * P * Math.cos(mm * phi);
  } else if (m < 0) {
    return Math.sqrt(2.0) * N * P * Math.sin(mm * phi);
  } else {
    return N * P;
  }
}

// Function to update edge line positions
function updateEdgeLines() {
  // Edge 1: Equatorial arc from phi=0 to phi=90
  const eqPositions = equatorialEdgeGeo.attributes.position.array;
  for (let i = 0; i < numEdgePoints; i++) {
    const angle = (i / (numEdgePoints - 1)) * Math.PI / 2;
    const basePos = new THREE.Vector3(
      100 * Math.cos(angle),
      0,
      100 * Math.sin(angle)
    );
    const dr = calculateDisplacement(basePos);
    const dir = basePos.clone().normalize();
    const newPos = dir.multiplyScalar(100 + 5.0 * dr + 0.2);

    eqPositions[i * 3] = newPos.x;
    eqPositions[i * 3 + 1] = newPos.y;
    eqPositions[i * 3 + 2] = newPos.z;
  }
  equatorialEdgeGeo.attributes.position.needsUpdate = true;

  // Edge 2: Meridional arc at phi=0 (north pole to equator)
  const m1Positions = meridional1EdgeGeo.attributes.position.array;
  for (let i = 0; i < numEdgePoints; i++) {
    const theta = (i / (numEdgePoints - 1)) * Math.PI / 2;
    const basePos = new THREE.Vector3(
      100 * Math.sin(theta),
      100 * Math.cos(theta),
      0
    );
    const dr = calculateDisplacement(basePos);
    const dir = basePos.clone().normalize();
    const newPos = dir.multiplyScalar(100 + 5.0 * dr + 0.2);

    m1Positions[i * 3] = newPos.x;
    m1Positions[i * 3 + 1] = newPos.y;
    m1Positions[i * 3 + 2] = newPos.z;
  }
  meridional1EdgeGeo.attributes.position.needsUpdate = true;

  // Edge 3: Meridional arc at phi=90 (north pole to equator)
  const m2Positions = meridional2EdgeGeo.attributes.position.array;
  for (let i = 0; i < numEdgePoints; i++) {
    const theta = (i / (numEdgePoints - 1)) * Math.PI / 2;
    const basePos = new THREE.Vector3(
      0,
      100 * Math.cos(theta),
      100 * Math.sin(theta)
    );
    const dr = calculateDisplacement(basePos);
    const dir = basePos.clone().normalize();
    const newPos = dir.multiplyScalar(100 + 5.0 * dr + 0.2);

    m2Positions[i * 3] = newPos.x;
    m2Positions[i * 3 + 1] = newPos.y;
    m2Positions[i * 3 + 2] = newPos.z;
  }
  meridional2EdgeGeo.attributes.position.needsUpdate = true;

  // Update intersection lines to connect to oscillating surface
  // X-axis line (from center to equator at phi=0)
  const xPos = xAxisGeo.attributes.position.array;
  const xEndBase = new THREE.Vector3(100, 0, 0);
  const xDr = calculateDisplacement(xEndBase);
  const xEnd = xEndBase.clone().normalize().multiplyScalar(100 + 5.0 * xDr);
  xPos[0] = 0; xPos[1] = 0; xPos[2] = 0;
  xPos[3] = xEnd.x; xPos[4] = xEnd.y; xPos[5] = xEnd.z;
  xAxisGeo.attributes.position.needsUpdate = true;
  
  // Z-axis line (from center to equator at phi=90)
  const zPos = zAxisGeo.attributes.position.array;
  const zEndBase = new THREE.Vector3(0, 0, 100);
  const zDr = calculateDisplacement(zEndBase);
  const zEnd = zEndBase.clone().normalize().multiplyScalar(100 + 5.0 * zDr);
  zPos[0] = 0; zPos[1] = 0; zPos[2] = 0;
  zPos[3] = zEnd.x; zPos[4] = zEnd.y; zPos[5] = zEnd.z;
  zAxisGeo.attributes.position.needsUpdate = true;
  
  // Y-axis line (from center to north pole)
  const yPos = yAxisGeo.attributes.position.array;
  const yEndBase = new THREE.Vector3(0, 100, 0);
  const yDr = calculateDisplacement(yEndBase);
  const yEnd = yEndBase.clone().normalize().multiplyScalar(100 + 5.0 * yDr);
  yPos[0] = 0; yPos[1] = 0; yPos[2] = 0;
  yPos[3] = yEnd.x; yPos[4] = yEnd.y; yPos[5] = yEnd.z;
  yAxisGeo.attributes.position.needsUpdate = true;
}

// Wedge cut-away
document.getElementById('cutawayToggle').onchange = e => {
  const cutawayEnabled = e.target.checked;
  
  oscillationMaterials.forEach(mat => {
    mat.uniforms.enableCutaway.value = cutawayEnabled;
  });
  
  // Hide/show inner planes based on cutaway state
  planes.forEach(plane => {
    plane.visible = cutawayEnabled;
  });
  
  // Show/hide edge lines
  edgeGroup.children.forEach(line => {
    line.visible = cutawayEnabled;
  });

  sphere.visible = true;
};

// Initialize
clampMSlider();
updateMode();
updateSliderDisplay();

// Animation loop
let starRotationSpeed = 0.001;

function animate() {
  oscillationMaterials.forEach(mat => {
    mat.uniforms.time.value += 0.02;
  });
  starRotationSpeed = +starRotSlider.value;
  starGroup.rotation.y += starRotationSpeed;

  if (document.getElementById('cutawayToggle').checked) {
    updateEdgeLines();
  }

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
