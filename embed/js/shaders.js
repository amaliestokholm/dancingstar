
export const vertexShader = `
#define MAX_MODES 6
#define PI 3.14159265359

uniform float time;
uniform float oscSpeed;
uniform int nModes;

// Using float arrays for safety; will cast to int inside GLSL
uniform float n[MAX_MODES];
uniform float l[MAX_MODES];
uniform float m[MAX_MODES];
uniform float amp[MAX_MODES];
uniform float omega0[MAX_MODES];
uniform float phase[MAX_MODES];

uniform float Omega;   // rotation rate
uniform float Cnl;     // Ledoux constant
uniform float shellRadius;
uniform int planeType;  // 0=sphere, 1=meridional1, 2=meridional2, 3=equatorial
uniform float starGroupRotationY;  // Current Y rotation of starGroup

uniform bool enableCutaway;
uniform vec3 cutDir;

varying float vDisp;
varying vec3 vDir;
varying float vAngle;
varying vec3 vWorldPos;
varying float vSphereRadius;

/* ---------- Math utilities ---------- */

float factorial(int n) {
  float f = 1.0;
  for (int i = 1; i <= 20; i++) {
    if (i > n) break;
    f *= float(i);
  }
  return f;
}

/* ---------- Associated Legendre P_l^m(x) ---------- */

float legendreP(int l, int m, float x) {
  float pmm = 1.0;

  if (m > 0) {
    float somx2 = sqrt((1.0 - x) * (1.0 + x));
    float fact = 1.0;
    for (int i = 1; i <= 20; i++) {
      if (i > m) break;
      pmm *= -fact * somx2;
      fact += 2.0;
    }
  }
  if (l == m) return pmm;

  float pmmp1 = x * (2.0 * float(m) + 1.0) * pmm;
  if (l == m + 1) return pmmp1;

  float pll = 0.0;
  for (int ll = m + 2; ll <= 20; ll++) {
    if (ll > l) break;
    pll = ((2.0 * float(ll) - 1.0) * x * pmmp1 -
           (float(ll + m - 1)) * pmm) / float(ll - m);
    pmm = pmmp1;
    pmmp1 = pll;
  }

  return pll;
}

/* ---------- Normalization ---------- */

/* returns sqrt((2l+1)/(4pi) * (l-m)!/(l+m)!) */
float norm(int l, int m) {
  return sqrt(
    (2.0 * float(l) + 1.0) / (4.0 * PI) *
    factorial(l - m) / factorial(l + m)
  );
}

/* ---------- Radial modes ---------- */
float radialMode(int n, float rNorm) {
  return sin((float(n) + 0.5) * PI * rNorm);
}

/* ---------- Real spherical harmonics Y_l^m ---------- */

float Ylm(int l, int m, float theta, float phi) {
  float x = cos(theta);
  int mm = abs(m);

  float P = legendreP(l, mm, x);
  float N = norm(l, mm);

  if (m > 0)
    return sqrt(2.0) * N * P * cos(float(mm) * phi);
  else if (m < 0)
    return sqrt(2.0) * N * P * sin(float(mm) * phi);
  else
    return N * P;
}

/* ---------- Rotational splitting ---------- */

float splitFrequency(float omega, int m, float Omega, float Cnl) {
  return omega + float(m) * Omega * (1.0 - Cnl);
}

/* ---------- main ---------- */

void main() {
  vec3 pos = position;
  vec3 dir;
  float rRadial;
  float rNorm;

  bool isPlane = shellRadius < 0.9;

  float theta, phi;
  
  // Transform normal using only the model matrix (mesh rotation), not view
  // normalMatrix includes view matrix and can cause flickering
  // We only care about the mesh's orientation, not camera view
  vec3 transformedNormal = normalize(mat3(modelMatrix) * normal);

  // Get world-space position (includes both plane rotation and starGroup rotation)
  vec3 worldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
  
  // Undo the starGroup Y-axis rotation to get position in star-local frame
  // Rotation matrix for rotation around Y axis by angle theta:
  // [ cos(theta)  0  sin(theta) ]
  // [     0       1      0      ]
  // [-sin(theta)  0  cos(theta) ]
  // 
  // To undo rotation by starGroupRotationY, we rotate by -starGroupRotationY
  float c = cos(-starGroupRotationY);
  float s = sin(-starGroupRotationY);
  
  vec3 starLocalPos = vec3(
    c * worldPos.x + s * worldPos.z,
    worldPos.y,
    -s * worldPos.x + c * worldPos.z
  );
  
  rRadial = length(starLocalPos);
  rNorm = rRadial / 100.0;
  dir = normalize(starLocalPos);
  theta = acos(clamp(dir.y, -1.0, 1.0));
  phi = atan(starLocalPos.z, starLocalPos.x);

  float dr = 0.0;

  for (int i = 0; i < MAX_MODES; i++) {
    if (i >= nModes) break;

    int n_i = int(n[i]);
    int l_i = int(l[i]);
    int m_i = int(m[i]);

    float omega = splitFrequency(omega0[i], m_i, Omega, Cnl);

    float R_nl = radialMode(n_i, rNorm);
    // Pattern rotation: the azimuthal pattern drifts at rate proportional to m*Omega
    // In the inertial frame, the pattern appears at phiInertial - m*Omega*time*(1-Cnl)
    float phiRotating = phi + float(m_i) * Omega * (1.0 - Cnl) * time * oscSpeed;
    float Y_lm = Ylm(l_i, m_i, theta, phiRotating);

    dr += amp[i] * R_nl * Y_lm *
        cos(omega0[i] * time * oscSpeed + phase[i]);
  }

  vDisp = dr;

  // Don't displace the planes - they stay flat
  // Only displace the sphere
  if (!isPlane) {
    // For sphere: pos is in mesh-local coords (same as star-local for sphere)
    // Displace along the original position direction
    vec3 meshDir = normalize(pos);
    float meshRadius = length(pos);
    pos = meshDir * (meshRadius + 5.0 * dr);
  }

  // vWorldPos should be the actual world position for fragment shader clipping
  // For sphere: need to recalculate world pos after displacement
  // For planes: use the original worldPos
  if (!isPlane) {
    vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
  } else {
    vWorldPos = worldPos;
  }
  
  vDir = dir;
  vSphereRadius = 100.0 + 5.0 * dr;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

export const fragmentShader = `
uniform bool enableCutaway;
uniform vec3 cutDir;
uniform float shellRadius;
uniform int planeType;

varying vec3 vDir;
varying float vDisp;
varying vec3 vWorldPos;
varying float vSphereRadius;

void main() {
  // Deternube if this is plane or the main sphere
  bool isPlane = shellRadius < 0.9;
  
  // For planes: clip to oscillating spherical boundary and wedge region
  if (isPlane) {
    // Clip to the sphere
    if (length(vWorldPos) > vSphereRadius) discard;

    if (vDir.y < -0.01) discard;

    // meridional1
    if (planeType == 1) {
      if (vDir.x < 0.0) discard;
    }

    // meridional2
    if (planeType == 2) {
      if (vDir.z < 0.0) discard;
    }

    // equatorial
    if (planeType == 3) {
      if (vDir.x < 0.0 || vDir.z < 0.0) discard;
    }
  }
  
  // For the main sphere: cut a hole
  if (enableCutaway && !isPlane) {
    bool aboveEquator = vDir.y > 0.0;
    
    float phi = atan(vDir.z, vDir.x);
    if (phi < 0.0) phi += 6.28318530718;
    
    bool inAzimuthRange = (phi >= 0.0 && phi <= 1.57079632679);
    
    if (aboveEquator && inAzimuthRange) {
      discard;
    }
  }

  // Normal oscillation coloring
  float x = 0.5 + 0.5 * tanh(3.0 * vDisp);
  vec3 inward  = vec3(0.2, 0.3, 0.9);
  vec3 outward = vec3(1.0, 0.4, 0.1);
  vec3 color = mix(inward, outward, x);

  gl_FragColor = vec4(color, 1.0);
}
`;

