// Postproceso: desenfoque de profundidad + tono ACES + FXAA, pensado para WebGL por software.
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

export function crearPost({ renderer, escena, camara, W, H, escala }) {
  const w = Math.round(W * escala), h = Math.round(H * escala);
  const rt = (ww, hh, o = {}) => new THREE.WebGLRenderTarget(ww, hh, { type: THREE.HalfFloatType, depthBuffer: false, ...o });
  const escenaRT = rt(w, h, { depthBuffer: true, depthTexture: new THREE.DepthTexture(w, h), samples: 0 });
  const A1 = rt(w >> 1, h >> 1), A2 = rt(w >> 1, h >> 1), B1 = rt(w >> 2, h >> 2), B2 = rt(w >> 2, h >> 2);
  const finalRT = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false });

  const comunes = { foco: { value: 5 }, apertura: { value: 1 }, cocFondo: { value: 0 }, cerca: { value: 0.05 }, lejos: { value: 200 } };
  const tCol = { value: escenaRT.texture }, tProf = { value: escenaRT.depthTexture };

  const prep = new THREE.ShaderMaterial({
    uniforms: { ...comunes, tCol, tProf }, vertexShader: VERT,
    fragmentShader: `${COC} uniform sampler2D tCol, tProf; varying vec2 vUv;
      void main(){ float k = coc(texture2D(tProf, vUv).x); gl_FragColor = vec4(texture2D(tCol, vUv).rgb * k, k); }`,
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
    uniforms: { ...comunes, tCol, tProf, tA: { value: A1.texture }, tB: { value: B1.texture }, exposicion: { value: 1 } }, vertexShader: VERT,
    fragmentShader: `${COC} uniform sampler2D tCol, tProf, tA, tB; uniform float exposicion; varying vec2 vUv;
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
        vec4 a = texture2D(tA, vUv), b = texture2D(tB, vUv);
        if (d > 0.99999) k = max(k, clamp(b.a * 2.5, 0.0, 1.0));   // lo desenfocado se derrama sobre el fondo
        vec3 ca = a.a > 0.02 ? a.rgb / a.a : nit, cb = b.a > 0.02 ? b.rgb / b.a : ca;
        vec3 c = k < 0.5 ? mix(nit, ca, k * 2.0) : mix(ca, cb, k * 2.0 - 1.0);
        gl_FragColor = vec4(srgb(aces(c)), 1.0);
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
    render({ foco, apertura, fondo, exposicion = 1 }) {
      comunes.cerca.value = camara.near; comunes.lejos.value = camara.far;
      comunes.foco.value = foco; comunes.apertura.value = apertura; comunes.cocFondo.value = fondo; composicion.uniforms.exposicion.value = exposicion;
      renderer.setRenderTarget(escenaRT); renderer.render(escena, camara);
      pase(prep, A1);
      borrosa(A1, A1, A2, 2);          // nivel A: media resolución
      borrosa(A1, B1, B2, 2);          // nivel B: cuarto de resolución, dos pasadas
      borrosa(B1, B1, B2, 3);
      pase(composicion, finalRT);
      pase(fxaa, null);
    },
  };
}
