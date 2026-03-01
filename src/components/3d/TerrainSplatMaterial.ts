import * as THREE from 'three';

/**
 * mesh.002 用のスプラットマップ地形マテリアル
 *
 * Blenderのシェーダーノード構成を再現:
 * - UV "Tiling" (uv)  → 繰り返し地面テクスチャ4枚
 * - UV "Projection" (uv2) → 航空写真テクスチャ
 * - 頂点カラー(COLOR_1) RGBA → スプラットマスク + 航空写真ブレンド
 *   R: Gravel Pathway, G: Rock Canyon Mud, B: Large River Rocks
 *   ベース: Grass Countryside
 *   A: 航空写真のブレンド量（1.0=地面テクスチャのみ、0.0=航空写真100%）
 * - シーンのディレクショナルライト + アンビエントライト対応
 * - フォグ対応
 */

const vertexShader = /* glsl */ `
  attribute vec2 uv2;
  attribute vec4 splatColor;
  varying vec2 vUvTiling;
  varying vec2 vUvProjection;
  varying vec4 vSplatColor;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vUvTiling = uv;
    vUvProjection = uv2;
    vSplatColor = splatColor;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D tGrass;
  uniform sampler2D tRiverRocks;
  uniform sampler2D tRockMud;
  uniform sampler2D tGravel;
  uniform sampler2D tPhotoMap;

  // ライティング
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform float uSunIntensity;
  uniform vec3 uAmbientColor;
  uniform float uAmbientIntensity;
  uniform vec3 uSkyColor;
  uniform vec3 uGroundColor;
  uniform float uHemiIntensity;

  // フォグ
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;

  varying vec2 vUvTiling;
  varying vec2 vUvProjection;
  varying vec4 vSplatColor;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    // Tiling UV でサンプリング（繰り返し地面テクスチャ）
    vec4 grass      = texture2D(tGrass, vUvTiling);
    vec4 riverRocks = texture2D(tRiverRocks, vUvTiling);
    vec4 rockMud    = texture2D(tRockMud, vUvTiling);
    vec4 gravel     = texture2D(tGravel, vUvTiling);

    // Projection UV でサンプリング（航空写真）
    // glTF/GLBではV軸がFBXと逆のため反転
    vec4 photoMap   = texture2D(tPhotoMap, vec2(vUvProjection.x, 1.0 - vUvProjection.y));

    // 頂点カラー(COLOR_1)からマスク値を取得
    float maskR = vSplatColor.r; // Gravel Pathway
    float maskG = vSplatColor.g; // Rock Canyon Mud
    float maskB = vSplatColor.b; // Large River Rocks
    float alphaVal = vSplatColor.a; // 航空写真ブレンド量

    // 地面テクスチャのブレンド:
    vec4 result = mix(grass, riverRocks, maskB);
    result = mix(result, rockMud, maskG);
    result = mix(result, gravel, maskR);
    // 航空写真をブレンド
    result = mix(photoMap, result, alphaVal);

    // ライティング
    vec3 norm = normalize(vNormal);

    // ディレクショナルライト（太陽光）- wrap lightingで影を柔らかく
    float NdotL = dot(norm, uSunDirection);
    float wrapLambert = (NdotL + 0.6) / 1.6; // wrap=0.6 で影部分にも光が回る
    wrapLambert = max(wrapLambert, 0.0);
    vec3 diffuse = uSunColor * uSunIntensity * wrapLambert;

    // ヘミスフィアライト（空↔地面の環境光グラデーション）
    float hemiMix = norm.y * 0.5 + 0.5;
    vec3 hemiColor = mix(uGroundColor, uSkyColor, hemiMix) * uHemiIntensity;

    // アンビエント
    vec3 ambient = uAmbientColor * uAmbientIntensity;

    vec3 lit = result.rgb * (ambient + diffuse + hemiColor);

    // 彩度を少し持ち上げ（Blenderに合わせて鮮やかに）
    float gray = dot(lit, vec3(0.299, 0.587, 0.114));
    lit = mix(vec3(gray), lit, 1.15);

    // フォグ（遠景のみ大気感）
    float fogDepth = length(vWorldPosition - cameraPosition);
    float fogFactor = smoothstep(uFogNear, uFogFar, fogDepth);
    vec3 finalColor = mix(lit, uFogColor, fogFactor);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

const textureLoader = new THREE.TextureLoader();

function loadTilingTexture(path: string): THREE.Texture {
  const tex = textureLoader.load(path);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createTerrainSplatMaterial(basePath: string): THREE.ShaderMaterial {
  const tGrass = loadTilingTexture(`${basePath}models/Grass Countryside_BaseColor.png`);
  const tRiverRocks = loadTilingTexture(`${basePath}models/Large River Rocks_BaseColor.png`);
  const tRockMud = loadTilingTexture(`${basePath}models/Rock Canyon Mud_BaseColor.png`);
  const tGravel = loadTilingTexture(`${basePath}models/Gravel Pathway_BaseColor.png`);

  const tPhotoMap = textureLoader.load(`${basePath}models/DL_PhotoMap.png`);
  tPhotoMap.colorSpace = THREE.SRGBColorSpace;

  // Scene3D.tsx のライティング設定をベースに調整
  const sunPos = new THREE.Vector3(500, 800, 500).normalize();

  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      tGrass: { value: tGrass },
      tRiverRocks: { value: tRiverRocks },
      tRockMud: { value: tRockMud },
      tGravel: { value: tGravel },
      tPhotoMap: { value: tPhotoMap },
      // 太陽光: wrap lighting で影を柔らかく
      uSunDirection: { value: sunPos },
      uSunColor: { value: new THREE.Color('#fff5e6') },
      uSunIntensity: { value: 0.7 },
      // アンビエント: ベース明るさ（高めに設定し暗部を防ぐ）
      uAmbientColor: { value: new THREE.Color('#ffffff') },
      uAmbientIntensity: { value: 0.55 },
      // ヘミスフィアライト: 空色と地面色のグラデーション環境光
      uSkyColor: { value: new THREE.Color('#b0d0f0') },
      uGroundColor: { value: new THREE.Color('#a09070') },
      uHemiIntensity: { value: 0.3 },
      // フォグ: 近景から薄くかかり、遠景でも強すぎない大気
      uFogColor: { value: new THREE.Color('#c8ddf0') },
      uFogNear: { value: 0 },
      uFogFar: { value: 8000 },
    },
  });
}
