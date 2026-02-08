
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
  float r = length(pos);
  float rNorm = r / 100.0;

  // Y is the polar axis (north-south), XZ is the equatorial plane
  float theta = acos(pos.y / r);  // Angle from north pole (Y-axis)
  float phi = atan(pos.z, pos.x); // Azimuthal angle in XZ plane

  float dr = 0.0;

  for (int i = 0; i < MAX_MODES; i++) {
    if (i >= nModes) break;

    int n_i = int(n[i]);
    int l_i = int(l[i]);
    int m_i = int(m[i]);

    float omega = splitFrequency(omega0[i], m_i, Omega, Cnl);

    float R_nl = radialMode(n_i, rNorm);
    float Y_lm = Ylm(l_i, m_i, theta, phi);

    dr += amp[i] * R_nl * Y_lm *
	  cos(omega * time * oscSpeed + phase[i]);
  }

  vDisp = dr;
  // pos *= (r + dr) / r;
  // Exaggerate radial displacement
  pos *= (r + 5.0 * dr) / r;

  vWorldPos = pos; // Store world position for clipping
  vDir = normalize(pos);
  vAngle = acos(clamp(dot(vDir, cutDir), -1.0, 1.0));
  
  // Calculate the sphere's radius at this direction (for plane clipping)
  vSphereRadius = 100.0 + 5.0 * dr;  // Base radius + exaggerated displacement

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

export const fragmentShader = `
uniform bool enableCutaway;
uniform vec3 cutDir;
uniform float shellRadius;

varying vec3 vDir;
varying float vDisp;
varying float vAngle;
varying vec3 vWorldPos;
varying float vSphereRadius;

void main() {
  // Check if this is a plane (shellRadius < 1) or the main sphere (shellRadius = 1)
  bool isPlane = shellRadius < 0.99;
  
  // For planes: clip to oscillating spherical boundary and wedge region
  // Planes are flat, so vWorldPos is the true flat position
  if (isPlane) {
    float distFromCenter = length(vWorldPos);
    
    // vSphereRadius is the oscillating sphere radius at this point's direction
    // Clip if plane extends beyond the oscillating sphere
    if (distFromCenter > vSphereRadius) {
      discard;
    }
    
    // Clip to wedge region
    // Y is polar axis, XZ is equatorial plane
    
    // Check if above equator (northern hemisphere)
    bool aboveEquator = vWorldPos.y > -2.0;
    
    // Calculate azimuthal angle in XZ plane
    float phi = atan(vWorldPos.z, vWorldPos.x);
    if (phi < 0.0) phi += 6.28318530718; // Normalize to 0 to 2π
    
    bool nearPhi0 = abs(vWorldPos.z) < 2.0 && vWorldPos.x > 0.0;
    bool nearPhi90 = abs(vWorldPos.x) < 2.0 && vWorldPos.z > 0.0;
    
    // Check if within 90-degree azimuthal range - generous tolerance
    // phi=0 is at 0, phi=90deg is at π/2 ≈ 1.5708
    bool inAzimuthRange = nearPhi0 || nearPhi90 || (phi >= -0.15 && phi <= 1.72);
    
    // Discard if outside the wedge region
    if (!aboveEquator || !inAzimuthRange) {
      discard;
    }
  }
  
  // For the main sphere: cut a wedge-shaped hole
  if (enableCutaway && !isPlane) {
    // The wedge is defined by:
    // 1. Above the equatorial plane (Y > 0, northern hemisphere)
    // 2. Within 90 degrees azimuthally (0deg to 90 in XZ plane)
    
    // Check if above equator
    bool aboveEquator = vDir.y > 0.0;
    
    // Calculate azimuthal angle in XZ plane
    float phi = atan(vDir.z, vDir.x);
    if (phi < 0.0) phi += 6.28318530718; // Normalize to 0 to 2π
    
    // Check if within 90-degree azimuthal range
    bool inAzimuthRange = (phi >= 0.0 && phi <= 1.5708); // 0 to π/2 (90 degrees)
    
    // If both conditions met, this is inside the wedge hole - discard it
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

