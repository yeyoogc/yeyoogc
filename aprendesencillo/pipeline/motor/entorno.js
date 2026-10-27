// Estudio fotográfico calculado en el propio shader, en lugar del mapa de entorno (PMREM).
// En WebGL por software, muestrear el PMREM era más de la mitad del coste del 3D; esto da reflejos de estudio
// (cajas de luz alargadas que dibujan los cantos y los biseles) por una fracción del precio.
// Mientras la escena tenga un `environment`, los MeshStandardMaterial usan estas funciones en vez del mapa.
import * as THREE from 'three';

const ESTUDIO = /* glsl */ `
#ifdef USE_ENVMAP
  // Caja de luz rectangular hacia eje (lado y arriba la orientan; tam = medio ancho y medio alto a distancia 1).
  // La rugosidad (a = r²) la agranda y la oscurece a la vez, así el brillo total se conserva.
  float caja(vec3 d, vec3 eje, vec3 lado, vec3 arriba, vec2 tam, float a) {
    float k = dot(d, eje);
    vec2 p = abs(vec2(dot(d, lado), dot(d, arriba))) / max(k, 0.05);
    vec2 borde = tam + a * 1.4, suave = vec2(0.015 + a * 1.1);
    vec2 m = 1.0 - smoothstep(borde - suave, borde + suave, p);
    return step(0.05, k) * m.x * m.y * (tam.x * tam.y) / (borde.x * borde.y);
  }
  // Paredes del estudio: suelo oscuro, horizonte y techo grises (lo que da cuerpo al metal desde cualquier ángulo).
  vec3 paredes(float y) {
    vec3 c = mix(vec3(0.045, 0.047, 0.055), vec3(0.2, 0.205, 0.22), smoothstep(-0.5, 0.1, y));
    return mix(c, vec3(0.3, 0.305, 0.32), smoothstep(0.3, 1.0, y));
  }
  vec3 estudio(vec3 d, float rug) {
    float a = rug * rug;
    vec3 c = paredes(d.y);
    c += vec3(3.0000, 2.9000, 2.7000) * caja(d, vec3(0.4205, 0.7476, 0.5140), vec3(0.8209, -0.0722, -0.5665), vec3(-0.3864, 0.6602, -0.6441), vec2(0.45, 0.38), a);   // principal
    c += vec3(2.4000, 2.4000, 2.4000) * caja(d, vec3(0.9820, 0.1178, 0.1473), vec3(-0.1463, -0.0176, 0.9891), vec3(0.1191, -0.9929, 0.0000), vec2(0.07, 1.1), a);   // tira derecha
    c += vec3(1.4000, 1.7000, 2.1000) * caja(d, vec3(-0.9524, 0.1905, -0.2381), vec3(-0.2335, 0.0467, 0.9712), vec3(0.1961, 0.9806, 0.0000), vec2(0.06, 1.0), a);   // tira izquierda, fría
    c += vec3(1.8000, 1.8000, 1.8000) * caja(d, vec3(0.0000, 1.0000, 0.0000), vec3(1.0000, 0.0000, 0.0000), vec3(0.0000, 0.0000, -1.0000), vec2(1.3, 0.1), a);   // tira cenital
    c += vec3(1.6000, 1.7000, 1.9000) * caja(d, vec3(0.0940, 0.3289, -0.9397), vec3(0.9956, -0.0310, 0.0887), vec3(-0.0000, -0.9439, -0.3304), vec2(0.9, 0.12), a);   // contraluz: perfila siluetas
    c += vec3(0.9000, 0.9000, 0.9500) * caja(d, vec3(-0.1455, 0.1940, 0.9701), vec3(0.9894, 0.0285, 0.1427), vec3(-0.0000, 0.9806, -0.1961), vec2(0.9, 0.6), a);   // relleno frontal
    return c;
  }
  vec3 getIBLIrradiance(const in vec3 normal) {
    // Versión barata para lo difuso: paredes + cada caja como un lóbulo coseno.
    vec3 n = envMapRotation * inverseTransformDirection(normal, viewMatrix);
    vec3 e = PI * paredes(n.y * 0.6)
      + vec3(2.0520, 1.9836, 1.8468) * max(dot(n, vec3(0.4205, 0.7476, 0.5140)), 0.0)
      + vec3(0.7392, 0.7392, 0.7392) * max(dot(n, vec3(0.9820, 0.1178, 0.1473)), 0.0)
      + vec3(0.3360, 0.4080, 0.5040) * max(dot(n, vec3(-0.9524, 0.1905, -0.2381)), 0.0)
      + vec3(0.9360, 0.9360, 0.9360) * max(dot(n, vec3(0.0000, 1.0000, 0.0000)), 0.0)
      + vec3(0.6912, 0.7344, 0.8208) * max(dot(n, vec3(0.0940, 0.3289, -0.9397)), 0.0)
      + vec3(1.9440, 1.9440, 2.0520) * max(dot(n, vec3(-0.1455, 0.1940, 0.9701)), 0.0);
    return e * envMapIntensity * 1.5;   // los materiales mate necesitan más cuerpo que los reflejos
  }
  vec3 getIBLRadiance(const in vec3 viewDir, const in vec3 normal, const in float roughness) {
    vec3 r = reflect(-viewDir, normal);
    r = normalize(mix(r, normal, roughness * roughness));
    return estudio(envMapRotation * inverseTransformDirection(r, viewMatrix), roughness) * envMapIntensity;
  }
  #ifdef USE_ANISOTROPY
    vec3 getIBLAnisotropyRadiance(const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy) {
      vec3 bentNormal = normalize(cross(cross(bitangent, viewDir), bitangent));
      bentNormal = normalize(mix(bentNormal, normal, pow2(pow2(1.0 - anisotropy * (1.0 - roughness)))));
      return getIBLRadiance(viewDir, bentNormal, roughness);
    }
  #endif
#endif
`;

THREE.ShaderChunk.envmap_physical_pars_fragment = ESTUDIO;

// Un entorno vacío basta: solo sirve para que los materiales activen los reflejos (USE_ENVMAP).
export const entornoVacio = renderer => new THREE.PMREMGenerator(renderer).fromScene(new THREE.Scene(), 0).texture;
