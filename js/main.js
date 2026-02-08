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
const planeDepth = 200;

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
  opacity: 1.0,
  depthWrite: true,
  side: THREE.DoubleSide
});
equatorialMat.uniforms.shellRadius.value = 0.5;  // Mark as plane
oscillationMaterials.push(equatorialMat);

const equatorialPlane = new THREE.Mesh(equatorialGeo, equatorialMat);
// Default plane is XY, rotate to XZ
equatorialPlane.rotation.x = Math.PI / 2;
equatorialPlane.visible = false;
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
  opacity: 1.0,
  depthWrite: true,
  side: THREE.DoubleSide
});
meridional1Mat.uniforms.shellRadius.value = 0.5;
oscillationMaterials.push(meridional1Mat);

const meridional1Plane = new THREE.Mesh(meridional1Geo, meridional1Mat);
meridional1Plane.visible = false;
planes.push(meridional1Plane);
starGroup.add(meridional1Plane);

// Plane at phi=90deg (YZ plane, normal along +X)  
const meridional2Geo = new THREE.PlaneGeometry(planeDepth, planeDepth, 256, 256);
const meridional2Mat = new THREE.ShaderMaterial({
  uniforms: THREE.UniformsUtils.clone(material.uniforms),
  vertexShader: planeVertexShader,
  fragmentShader: fragmentShader,
  transparent: true,
  opacity: 1.0,
  depthWrite: true,
  side: THREE.DoubleSide
});
meridional2Mat.uniforms.shellRadius.value = 0.5;
oscillationMaterials.push(meridional2Mat);

const meridional2Plane = new THREE.Mesh(meridional2Geo, meridional2Mat);
// Rotate 90deg around Y to get YZ plane (normal along X)
meridional2Plane.rotation.y = - Math.PI / 2;
meridional2Plane.visible = false;
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

// Wedge edge lines
// We'll create them as thin spherical geometry that gets clipped by shader
const edgeGroup = new THREE.Group();
starGroup.add(edgeGroup);

// Create thin tube geometries for wedge edges that will oscillate with the sphere
const edgeMaterial = material.clone();
edgeMaterial.uniforms.shellRadius.value = 1.0; // On surface
edgeMaterial.uniforms.enableCutaway.value = false;

// Create a custom fragment shader that renders black but keeps oscillation
const blackFragmentShader = `
uniform bool enableCutaway;
uniform vec3 cutDir;
uniform float shellRadius;

varying vec3 vDir;
varying float vDisp;
varying float vAngle;
varying vec3 vWorldPos;
varying float vSphereRadius;

void main() {
  gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); // Always black
}
`;

const blackEdgeMaterial = new THREE.ShaderMaterial({
  uniforms: edgeMaterial.uniforms,
  vertexShader: vertexShader,
  fragmentShader: blackFragmentShader,
  side: THREE.DoubleSide
});

// Edge 1: Equatorial arc
const equatorialEdgePoints = [];
for (let angle = 0; angle <= Math.PI / 2; angle += 0.02) {
  equatorialEdgePoints.push(new THREE.Vector3(
    100 * Math.cos(angle),  // X
    0,                       // Y = 0 (equator)
    100 * Math.sin(angle)   // Z
  ));
}
const equatorialEdgeCurve = new THREE.CatmullRomCurve3(equatorialEdgePoints);
const equatorialEdgeGeo = new THREE.TubeGeometry(equatorialEdgeCurve, 64, 0.5, 8, false);
const equatorialEdgeMesh = new THREE.Mesh(equatorialEdgeGeo, blackEdgeMaterial);
equatorialEdgeMesh.visible = false;
edgeGroup.add(equatorialEdgeMesh);

// Edge 2: Meridional arc at phi=0 (north pole to equator along +X, contains Y-axis)
const meridional1EdgePoints = [];
for (let theta = 0; theta <= Math.PI / 2; theta += 0.02) {
  meridional1EdgePoints.push(new THREE.Vector3(
    100 * Math.sin(theta),  // X varies
    100 * Math.cos(theta),  // Y: from 100 (north) to 0 (equator)
    0                        // Z = 0 (phi = 0)
  ));
}
const meridional1EdgeCurve = new THREE.CatmullRomCurve3(meridional1EdgePoints);
const meridional1EdgeGeo = new THREE.TubeGeometry(meridional1EdgeCurve, 64, 0.5, 8, false);
const meridional1EdgeMesh = new THREE.Mesh(meridional1EdgeGeo, blackEdgeMaterial);
meridional1EdgeMesh.visible = false;
edgeGroup.add(meridional1EdgeMesh);

// Edge 3: Meridional arc at phi=90 (north pole to equator along +Z, contains Y-axis)
const meridional2EdgePoints = [];
for (let theta = 0; theta <= Math.PI / 2; theta += 0.02) {
  meridional2EdgePoints.push(new THREE.Vector3(
    0,                       // X = 0 (phi = 90)
    100 * Math.cos(theta),  // Y: from 100 (north) to 0 (equator)
    100 * Math.sin(theta)   // Z varies
  ));
}
const meridional2EdgeCurve = new THREE.CatmullRomCurve3(meridional2EdgePoints);
const meridional2EdgeGeo = new THREE.TubeGeometry(meridional2EdgeCurve, 64, 0.5, 8, false);
const meridional2EdgeMesh = new THREE.Mesh(meridional2EdgeGeo, blackEdgeMaterial);
meridional2EdgeMesh.visible = false;
edgeGroup.add(meridional2EdgeMesh);

// Intersection lines
const intersectionMaterial = new THREE.LineBasicMaterial({
  color: 0x000000,
  linewidth: 1,
  transparent: true,
  opacity: 0.7
});

const xAxisPoints = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(100, 0, 0)  // Along +X in equatorial plane
];
const xAxisGeo = new THREE.BufferGeometry().setFromPoints(xAxisPoints);
const xAxisLine = new THREE.Line(xAxisGeo, intersectionMaterial);
xAxisLine.visible = false;
edgeGroup.add(xAxisLine);

const zAxisPoints = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0, 100)  // Along +Z in equatorial plane
];
const zAxisGeo = new THREE.BufferGeometry().setFromPoints(zAxisPoints);
const zAxisLine = new THREE.Line(zAxisGeo, intersectionMaterial);
zAxisLine.visible = false;
edgeGroup.add(zAxisLine);

const yAxisPoints = [
  new THREE.Vector3(0, 0, 0),      // Center/equator
  new THREE.Vector3(0, 100, 0)     // North pole
];
const yAxisGeo = new THREE.BufferGeometry().setFromPoints(yAxisPoints);
const yAxisLine = new THREE.Line(yAxisGeo, intersectionMaterial);
yAxisLine.visible = false;
edgeGroup.add(yAxisLine);

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
