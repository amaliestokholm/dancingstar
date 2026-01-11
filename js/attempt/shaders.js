const vertexShader = `
#define MAX_MODES 6
#define PI 3.14159265359

uniform float time;
uniform int nModes;

uniform float l[MAX_MODES];
uniform float m[MAX_MODES];
uniform float amp[MAX_MODES];
uniform float omega0[MAX_MODES];
uniform float phase[MAX_MODES];

uniform float Omega;
uniform float Cnl;

varying float vDisp;

float factorial(int n) {
  float f = 1.0;
  for (int i = 1; i <= 20; i++) {
    if (i > n) break;
    f *= float(i);
  }
  return f;
}

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

float norm(int l, int m) {
  return sqrt(
    (2.0 * float(l) + 1.0) / (4.0 * PI) *
    factorial(l - m) / factorial(l + m)
  );
}

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

float splitFrequency(float omega, int m, float Omega, float Cnl) {
  return omega + float(m) * Omega * (1.0 - Cnl);
}

void main() {
  vec3 pos = position;
  float r = length(pos);

  float theta = acos(pos.z / r);
  float phi = atan(pos.y, pos.x);

  float dr = 0.0;

  for (int i = 0; i < MAX_MODES; i++) {
    if (i >= nModes) break;

    int l_i = int(l[i]);
    int m_i = int(m[i]);

    float omega = splitFrequency(omega0[i], m_i, Omega, Cnl);
    dr += amp[i] *
          Ylm(l_i, m_i, theta, phi) *
          cos(omega * time + phase[i] + float(m_i) * phi);
  }

  vDisp = dr;
  pos *= (r + 5.0 * dr) / r;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;
