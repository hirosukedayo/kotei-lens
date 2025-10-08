import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TextureLoader } from 'three';
import * as THREE from 'three';

interface LakeModelProps {
  position?: [number, number, number];
  scale?: [number, number, number];
  rotation?: [number, number, number];
  visible?: boolean;
  showTerrain?: boolean;
  showWater?: boolean;
  terrainScale?: [number, number, number];
  waterScale?: [number, number, number];
  waterPosition?: [number, number, number];
}

// ベースパスを動的に取得
const getBasePath = () => {
  // Viteの環境変数からベースパスを取得
  return import.meta.env.BASE_URL || '/';
};

// Unityマテリアルファイルの情報を解析
const parseUnityMaterial = () => {
  return {
    // テクスチャ設定
    mainTex: {
      scale: { x: 1, y: 1 },
      offset: { x: 0, y: 0 }
    },
    // マテリアルプロパティ
    color: { r: 1, g: 1, b: 1, a: 1 },
    emissionColor: { r: 0, g: 0, b: 0, a: 1 },
    // 物理プロパティ
    metallic: 0,
    glossiness: 0.5,
    smoothness: 0.5,
    // ブレンド設定
    srcBlend: 1, // SrcAlpha
    dstBlend: 0, // OneMinusSrcAlpha
    // その他
    cutoff: 0.5,
    zWrite: 1,
    mode: 0 // Opaque
  };
};

export default function LakeModel({
  position = [0, 0, 0],
  scale = [1, 1, 1],
  rotation = [0, 0, 0],
  visible = true,
  showTerrain = true,
  showWater = true,
  terrainScale = [1, 1, 1],
  waterScale = [1, 1, 1],
  waterPosition = [0, 0, 0]
}: LakeModelProps) {
  const terrainRef = useRef<THREE.Group>(null);
  const waterRef = useRef<THREE.Group>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gltf, setGltf] = useState<any>(null);

  const basePath = getBasePath();
  const unityMaterial = parseUnityMaterial();

  // glTFファイルの読み込み
  useEffect(() => {
    const gltfLoader = new GLTFLoader();
    const gltfPath = `${basePath}models/OkutamaLake_realscale.glb`;
    
    console.log('glTFファイルパス:', gltfPath);
    
    gltfLoader.load(
      gltfPath,
      (loadedGltf) => {
        setGltf(loadedGltf);
        setIsLoaded(true);
        console.log('glTFファイルが正常に読み込まれました');
        console.log('glTF情報:', {
          scene: loadedGltf.scene,
          animations: loadedGltf.animations,
          cameras: loadedGltf.cameras,
          asset: loadedGltf.asset
        });
      },
      undefined,
      (error) => {
        console.error('glTFファイルの読み込みに失敗:', error);
        setError('glTFファイルの読み込みに失敗しました');
      }
    );
  }, [basePath]);

  // 地形と水面を分離して取得する関数
  const getTerrainObject = () => {
    if (!gltf) return null;
    return gltf.scene.getObjectByName("Displacement.001");
  };

  const getWaterObject = () => {
    if (!gltf) return null;
    return gltf.scene.getObjectByName("Water");
  };

  // アニメーション（水面の波効果）
  useFrame((state, delta) => {
    if (waterRef.current && isLoaded && showWater) {
      // 水面の微細な波アニメーション
      waterRef.current.rotation.y += delta * 0.01;
      
      // 水面のマテリアル効果を動的に調整
      waterRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const material = child.material as THREE.MeshStandardMaterial;
          // 時間に基づいて反射強度を変化させる
          if (material.metalness !== undefined) {
            material.metalness = 0.1 + Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
          }
        }
      });
    }
  });

  if (error) {
    return (
      <group position={position}>
        <mesh>
          <boxGeometry args={[10, 1, 10]} />
          <meshStandardMaterial color="red" />
        </mesh>
      </group>
    );
  }

  return (
    <group position={position} scale={scale} rotation={rotation} visible={visible}>
      {/* 地形の表示 */}
      {showTerrain && isLoaded && getTerrainObject() && (
        <primitive
          ref={terrainRef}
          object={getTerrainObject()}
          scale={terrainScale}
        />
      )}
      
      {/* 水面の表示 */}
      {showWater && isLoaded && getWaterObject() && (
        <primitive
          ref={waterRef}
          object={getWaterObject()}
          position={waterPosition}
          scale={waterScale}
        />
      )}
      
      {/* ローディング表示 */}
      {!isLoaded && (
        <mesh>
          <boxGeometry args={[10, 1, 10]} />
          <meshStandardMaterial color="#6AB7FF" transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}
