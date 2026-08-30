/**
 * The WebGL ambience — a fullscreen fragment shader drawing 28 soft discs.
 *
 * This is the heavy half and is never imported directly. BokehMount lazy-loads
 * it, so three.js lands in its own chunk and cannot block first paint.
 *
 * Everything about the look lives in the fragment shader below; the React here
 * exists only to own a material ref and push three uniforms at it.
 */
import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ScreenQuad } from '@react-three/drei';
import * as THREE from 'three';

/** 6 columns x 5 rows of cells, 28 of the 30 filled. */
const COLUMNS = 6;
const ROWS = 5;
const DISCS = 28;

/** Where uBlur settles. Never 0 — the discs must never resolve. */
const BLUR_REST = 0.55;
const BLUR_EASE_MS = 1800;

/*
  ScreenQuad's geometry is already in clip space, so the vertex stage is a
  passthrough. It deliberately does NOT forward a uv varying: the first version
  did, and the attribute is not there to forward. Every fragment then read the
  same vUv, the shader drew one flat colour over the entire viewport, and the
  canvas came back at alpha 1/255 — uniform, moving correctly with time and
  scroll, and invisible. The uniforms were perfect throughout. The fragment
  stage derives its own coordinates from gl_FragCoord instead, which depends on
  no attribute at all.
*/
const VERT = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  uniform vec2  uResolution; // drawing-buffer pixels, not CSS pixels
  uniform float uTime;      // seconds, accumulated; frozen under reduced motion
  uniform float uScroll;    // viewports scrolled
  uniform float uBlur;      // 1.0 on load -> BLUR_REST, never lower
  uniform float uPeak;      // peak alpha per disc
  uniform vec3  uRose;
  uniform vec3  uAqua;

  const int   COLUMNS = ${COLUMNS};
  const int   ROWS    = ${ROWS};
  const int   DISCS   = ${DISCS};
  const float PI2     = 6.28318530718;

  // Cheap per-disc hash. Three uncorrelated values in 0..1.
  vec3 hash3(float n) {
    return fract(sin(vec3(n, n + 1.37, n + 2.71)) * vec3(43758.5453, 22578.1459, 19642.3491));
  }

  /**
   * One soft disc.
   *
   * 'blur' inflates the radius and widens the falloff, and shifts weight from
   * a defined rim onto a broad halo. The body is a Gaussian, which has no edge
   * to find at any blur value — that is what keeps these from ever reading as
   * circles with a boundary. The rim is a faint annulus weighted by
   * pow(1 - blur, 3), so it is all but invisible at rest and would only assert
   * itself near full focus, which the animation never reaches. At the resting
   * blur the weight is 0.45^5, about 1.8% — below that it drew a visible thin
   * circle at the disc's radius, which is the one thing these must never have.
   */
  float disc(vec2 p, vec2 centre, float radius, float blur) {
    float d = length(p - centre) / (radius * (0.78 + 0.42 * blur));
    float halo = exp(-d * d * (3.4 + 2.0 * (1.0 - blur)));
    float rim = smoothstep(1.0, 0.62, d) * smoothstep(0.30, 0.62, d);
    float rimWeight = pow(1.0 - blur, 5.0);
    return clamp(halo * (0.58 + 0.42 * blur) + rim * rimWeight * 0.6, 0.0, 1.0);
  }

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);

    // 1.0 == half the viewport's shorter dimension, in both axes.
    vec2 p = (gl_FragCoord.xy / uResolution - 0.5) * 2.0;
    if (aspect >= 1.0) p.x *= aspect; else p.y /= aspect;

    float halfW = aspect >= 1.0 ? aspect : 1.0;
    float halfH = aspect >= 1.0 ? 1.0 : 1.0 / aspect;
    vec2 cell = vec2(2.0 * halfW / float(COLUMNS), 2.0 * halfH / float(ROWS));

    // Premultiplied accumulation, composited front-to-back with "over" so
    // overlapping discs deepen instead of blowing out to white.
    vec3 colour = vec3(0.0);
    float alpha = 0.0;

    for (int i = 0; i < DISCS; i++) {
      vec3 h = hash3(float(i) * 1.618 + 0.5);

      // Jittered grid, not a raw hash: a raw hash clumps into corners and
      // leaves holes, which reads as a mistake rather than as atmosphere.
      float col = mod(float(i), float(COLUMNS));
      float row = floor(float(i) / float(COLUMNS));
      vec2 base = vec2(
        -halfW + cell.x * (col + 0.5),
        -halfH + cell.y * (row + 0.5)
      );
      vec2 jitter = (vec3(h.y, h.z, h.x).xy - 0.5) * cell;

      // Bigger discs sit nearer, so they answer scroll harder. That difference
      // is the whole parallax read.
      float radius = mix(0.20, 0.52, h.x);
      float depth = smoothstep(0.20, 0.52, radius);

      /*
        Scroll feeds the SAME time variable that drives the orbit rather than
        translating the field. Translating runs discs off the edge on a long
        page; advancing them along their own paths stays bounded at any page
        length and reverses naturally on the way back up.
      */
      float t = uTime + uScroll * (1.6 + 2.4 * depth);

      float speed = 0.30 + h.z * 0.34;
      float phase = h.z * PI2;
      vec2 amp = vec2(0.17 + h.x * 0.21, 0.13 + h.y * 0.17);

      // The 0.67 / 1.7 mismatch between the x and y frequencies is what keeps
      // the path from closing into an obvious repeating rhythm.
      vec2 offset = vec2(
        sin(t * speed + phase) * amp.x,
        cos(t * speed * 0.67 + phase * 1.7) * amp.y
      );

      float a = disc(p, base + jitter + offset, radius, uBlur)
              * uPeak * (0.45 + 0.55 * h.y);

      vec3 tint = mod(float(i), 2.0) < 0.5 ? uRose : uAqua;
      colour += tint * a * (1.0 - alpha);
      alpha += a * (1.0 - alpha);
    }

    gl_FragColor = vec4(colour, alpha);
  }
`;

type FieldProps = { peak: number; reduced: boolean };

function Field({ peak, reduced }: FieldProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const startRef = useRef<number | null>(null);
  const gl = useThree((state) => state.gl);

  /*
    CRITICAL: this object is NOT what the material ends up holding. Three's
    ShaderMaterial constructor runs UniformsUtils.clone() over it, so mutating
    this object in useFrame writes to something the renderer never reads — the
    field renders its first frame forever while the JS shows perfectly correct
    values. Every animated write below goes through materialRef instead.
  */
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uBlur: { value: reduced ? BLUR_REST : 1 },
      uPeak: { value: peak },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uRose: { value: new THREE.Color(233 / 255, 163 / 255, 196 / 255) },
      uAqua: { value: new THREE.Color(127 / 255, 210 / 255, 212 / 255) },
    }),
    // Seeded once. Live changes go through the ref, same as the animation.
    [],
  );

  useFrame((_state, delta) => {
    const u = materialRef.current?.uniforms;
    if (!u) return;

    const canvas = gl.domElement;
    u.uResolution.value.set(canvas.width, canvas.height);
    u.uPeak.value = peak;

    if (reduced) {
      // Held, not merely paused: no drift, no scroll coupling, and the blur
      // parked at rest so nothing eases either.
      u.uTime.value = 0;
      u.uScroll.value = 0;
      u.uBlur.value = BLUR_REST;
      return;
    }

    u.uTime.value += delta;
    u.uScroll.value = window.scrollY / Math.max(1, window.innerHeight);

    // Ease-out-cubic from fully soft to resting soft, once, on load.
    if (startRef.current === null) startRef.current = performance.now();
    const k = Math.min(1, (performance.now() - startRef.current) / BLUR_EASE_MS);
    u.uBlur.value = 1 - (1 - BLUR_REST) * (1 - Math.pow(1 - k, 3));
  });

  return (
    <ScreenQuad>
      <shaderMaterial
        ref={materialRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        premultipliedAlpha
        depthTest={false}
        depthWrite={false}
      />
    </ScreenQuad>
  );
}

export default function BokehField({
  peak,
  reduced,
  paused,
}: {
  peak: number;
  reduced: boolean;
  paused: boolean;
}) {
  return (
    <Canvas
      // Mid-range Android pays for every extra pixel of a fullscreen shader,
      // and nobody can see the difference on a blurred gradient at 2x.
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: false, premultipliedAlpha: true }}
      // 'never' parks the loop for a hidden tab or a reduced-motion reader;
      // 'demand' still renders the single frame each of them should see.
      frameloop={paused ? 'never' : reduced ? 'demand' : 'always'}
      style={{ position: 'absolute', inset: 0 }}
      orthographic
    >
      <Field peak={peak} reduced={reduced} />
    </Canvas>
  );
}
