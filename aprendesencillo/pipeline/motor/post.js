// Postproceso: desenfoque de profundidad + resplandor + tono ACES + FXAA, pensado para WebGL por software.
// El desenfoque reúne solo los píxeles desenfocados (ponderados por su círculo de confusión),
// así los objetos enfocados no sueltan halo sobre el fondo y los desenfocados sí se difuminan.
import * as THREE from 'three';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const COC = `#include <packing>
  uniform float foco, apertura, cocFondo, cerca, lejos;
  float coc(float d){
    if (d > 0.99999) return cocFondo;
    float z = -perspectiveDepthToViewZ(d, cerca, lejos);
    return clamp(abs(z - foco) / foco * apertura, 0.0, 1.0);
  }`;

export function crearPost({ renderer, escena, camara, W, H, escala, muestras = 0 }) {
  const w = Math.round(W * escala), h = Math.round(H * escala);
  const rt = (ww, hh, o = {}) => new THREE.WebGLRenderTarget(ww, hh, { type: THREE.HalfFloatType, depthBuffer: false, ...o });
  // MSAA (muestras > 0) da cantos más limpios, pero en GPU por software duplica el coste de la escena: por defecto, FXAA.
  const escenaRT = rt(w, h, { depthBuffer: true, depthTexture: new THREE.DepthTexture(w, h), samples: muestras });
  const A1 = rt(w >> 1, h >> 1), A2 = rt(w >> 1, h >> 1), B1 = rt(w >> 2, h >> 2), B2 = rt(w >> 2, h >> 2);
  const C1 = rt(w >> 2, h >> 2), C2 = rt(w >> 2, h >> 2), E1 = rt(w >> 3, h >> 3), E2 = rt(w >> 3, h >> 3);
  const finalRT = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false });

  const comunes = { foco: { value: 5 }, apertura: { value: 1 }, cocFondo: { value: 0 }, cerca: { value: 0.05 }, lejos: { value: 200 } };
  const tCol = { value: escenaRT.texture }, tProf = { value: escenaRT.depthTexture };

  const prep = new THREE.ShaderMaterial({
    uniforms: { ...comunes, tCol, tProf }, vertexShader: VERT,
    fragmentShader: `${COC} uniform sampler2D tCol, tProf; varying vec2 vUv;
      void main(){ float k = coc(texture2D(tProf, vUv).x); gl_FragColor = vec4(texture2D(tCol, vUv).rgb * k, k); }`,
  });
  // Lo que pasa de 1 (brillos de las cajas de luz, emisivos) se queda para el resplandor. 4 muestras = reducción sin parpadeo.
  const brillante = new THREE.ShaderMaterial({
    uniforms: { tCol, px: { value: new THREE.Vector2(1 / w, 1 / h) }, umbral: { value: 1 } }, vertexShader: VERT,
    fragmentShader: `uniform sampler2D tCol; uniform vec2 px; uniform float umbral; varying vec2 vUv;
      vec3 b(vec2 o){ vec3 c = texture2D(tCol, vUv + o * px).rgb; return max(c - umbral, 0.0) / (1.0 + max(c.r, max(c.g, c.b)) * 0.15); }
      void main(){ gl_FragColor = vec4((b(vec2(-1.0, -1.0)) + b(vec2(1.0, -1.0)) + b(vec2(-1.0, 1.0)) + b(vec2(1.0, 1.0))) * 0.25, 1.0); }`,
  });
  const desenfoque = new THREE.ShaderMaterial({
    uniforms: { t: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: VERT,
    fragmentShader: `uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
      void main(){
        vec4 c = texture2D(t, vUv) * 0.227027;
        c += (texture2D(t, vUv + dir * 1.384615) + texture2D(t, vUv - dir * 1.384615)) * 0.316216;
        c += (texture2D(t, vUv + dir * 3.230769) + texture2D(t, vUv - dir * 3.230769)) * 0.070270;
        gl_FragColor = c;
      }`,
  });
  const composicion = new THREE.ShaderMaterial({
    uniforms: { ...comunes, tCol, tProf, tA: { value: A1.texture }, tB: { value: B1.texture }, tC: { value: C1.texture }, tE: { value: E1.texture },
                exposicion: { value: 1 }, resplandor: { value: 0.5 }, px: { value: new THREE.Vector2(1 / w, 1 / h) }, nitidez: { value: 0.6 } },
    vertexShader: VERT,
    fragmentShader: `${COC} uniform sampler2D tCol, tProf, tA, tB, tC, tE; uniform float exposicion, resplandor, nitidez; uniform vec2 px; varying vec2 vUv;
      vec3 fit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
      vec3 aces(vec3 c){
        const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
        const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
        return clamp(O * fit(I * (c * exposicion / 0.6)), 0.0, 1.0);
      }
      vec3 srgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
      void main(){
        float d = texture2D(tProf, vUv).x, k = coc(d);
        vec3 nit = texture2D(tCol, vUv).rgb;
        // Enfoque adaptativo (estilo CAS) solo en lo enfocado: compensa el escalado del 3D sin crear halos.
        vec3 n1 = texture2D(tCol, vUv + vec2(px.x, 0.0)).rgb, n2 = texture2D(tCol, vUv - vec2(px.x, 0.0)).rgb;
        vec3 n3 = texture2D(tCol, vUv + vec2(0.0, px.y)).rgb, n4 = texture2D(tCol, vUv - vec2(0.0, px.y)).rgb;
        vec3 mn = min(min(n1, n2), min(min(n3, n4), nit)), mx = max(max(n1, n2), max(max(n3, n4), nit));
        nit = clamp(nit + nitidez * (1.0 - k) * (nit - (n1 + n2 + n3 + n4) * 0.25), mn, mx);
        vec4 a = texture2D(tA, vUv), b = texture2D(tB, vUv);
        if (d > 0.99999) k = max(k, clamp(b.a * 2.5, 0.0, 1.0));   // lo desenfocado se derrama sobre el fondo
        vec3 ca = a.a > 0.02 ? a.rgb / a.a : nit, cb = b.a > 0.02 ? b.rgb / b.a : ca;
        vec3 c = k < 0.5 ? mix(nit, ca, k * 2.0) : mix(ca, cb, k * 2.0 - 1.0);
        c += (texture2D(tC, vUv).rgb * 0.55 + texture2D(tE, vUv).rgb * 0.75) * resplandor;
        vec3 s = srgb(aces(c));
        // Franja más oscura bajo los subtítulos (y 250-450) para que se lean sobre cualquier objeto, y viñeta suave.
        float y = (1.0 - vUv.y) * 1920.0;
        s *= 1.0 - 0.5 * (1.0 - smoothstep(470.0, 640.0, y)) * smoothstep(60.0, 240.0, y);
        s *= 1.0 - 0.3 * smoothstep(650.0, 1250.0, length((vUv - 0.5) * vec2(1080.0, 1920.0)));
        gl_FragColor = vec4(s, 1.0);
      }`,
  });

  const fxaa = new THREE.ShaderMaterial({ vertexShader: FXAAShader.vertexShader, fragmentShader: FXAAShader.fragmentShader, uniforms: THREE.UniformsUtils.clone(FXAAShader.uniforms) });
  fxaa.uniforms.tDiffuse.value = finalRT.texture;
  fxaa.uniforms.resolution.value.set(1 / w, 1 / h);

  const camQuad = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), escenaQuad = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; escenaQuad.add(quad);
  const pase = (material, destino) => { quad.material = material; renderer.setRenderTarget(destino); renderer.render(escenaQuad, camQuad); };
  const borrosa = (origen, destino, aux, paso) => {
    desenfoque.uniforms.t.value = origen.texture; desenfoque.uniforms.dir.value.set(paso / destino.width, 0); pase(desenfoque, aux);
    desenfoque.uniforms.t.value = aux.texture; desenfoque.uniforms.dir.value.set(0, paso / destino.height); pase(desenfoque, destino);
  };

  return {
    render({ foco, apertura, fondo, exposicion = 1, resplandor = 0.5 }) {
      comunes.cerca.value = camara.near; comunes.lejos.value = camara.far;
      comunes.foco.value = foco; comunes.apertura.value = apertura; comunes.cocFondo.value = fondo;
      composicion.uniforms.exposicion.value = exposicion; composicion.uniforms.resplandor.value = resplandor;
      renderer.setRenderTarget(escenaRT); renderer.render(escena, camara);
      pase(prep, A1);
      borrosa(A1, A1, A2, 2);          // desenfoque A: media resolución
      borrosa(A1, B1, B2, 2);          // desenfoque B: cuarto de resolución, dos pasadas
      borrosa(B1, B1, B2, 3);
      if (resplandor > 0) {
        pase(brillante, C1);           // resplandor: cuarto y octavo de resolución
        borrosa(C1, C1, C2, 1.5);
        borrosa(C1, E1, E2, 2);
        borrosa(E1, E1, E2, 3);
      }
      if (muestras > 0) return pase(composicion, null);
      pase(composicion, finalRT);
      pase(fxaa, null);
    },
  };
}
