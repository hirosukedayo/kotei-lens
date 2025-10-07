import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useLoader } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { TextureLoader } from 'three';
import * as THREE from 'three';

interface LakeModelProps {
  position?: [number, number, number];
  scale?: [number, number, number];
  rotation?: [number, number, number];
  visible?: boolean;
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
  position = [0, 0, 0], // デフォルトで中心座標に配置
  scale = [1, 1, 1],
  rotation = [0, 0, 0],
  visible = true
}: LakeModelProps) {
  const meshRef = useRef<THREE.Group>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  const basePath = getBasePath();
  const unityMaterial = parseUnityMaterial();

  // テクスチャの読み込み（エラーハンドリング付き）
  useEffect(() => {
    const textureLoader = new TextureLoader();
    const texturePath = `${basePath}models/lake_photo.png`;
    
    console.log('テクスチャパス:', texturePath);
    
    textureLoader.load(
      texturePath,
      (loadedTexture) => {
        setTexture(loadedTexture);
        console.log('テクスチャが正常に読み込まれました');
        console.log('テクスチャ情報:', {
          image: loadedTexture.image,
          format: loadedTexture.format,
          type: loadedTexture.type,
          wrapS: loadedTexture.wrapS,
          wrapT: loadedTexture.wrapT
        });
      },
      undefined,
      (error) => {
        console.error('テクスチャの読み込みに失敗:', error);
        setError('テクスチャの読み込みに失敗しました');
      }
    );
  }, [basePath]);

  useEffect(() => {
    if (!texture) return; // テクスチャが読み込まれるまで待機

    // OBJファイルの読み込み
    const objLoader = new OBJLoader();
    const objPath = `${basePath}models/lake.obj`;
    
    console.log('OBJファイルパス:', objPath);
    
    objLoader.load(
      objPath,
      (object: THREE.Group) => {
        // Unityマテリアルファイルの情報を基にマテリアルを設定
        object.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) {
            // Unityマテリアルファイルの情報を基にマテリアルを設定
            const material = new THREE.MeshStandardMaterial({
              map: texture,
              // Unityの_Color設定
              color: new THREE.Color(
                unityMaterial.color.r,
                unityMaterial.color.g,
                unityMaterial.color.b
              ),
              // Unityの_Glossiness設定（roughness = 1 - glossiness）
              roughness: 1 - unityMaterial.glossiness,
              // Unityの_Metallic設定
              metalness: unityMaterial.metallic,
              // Unityの_EmissionColor設定
              emissive: new THREE.Color(
                unityMaterial.emissionColor.r,
                unityMaterial.emissionColor.g,
                unityMaterial.emissionColor.b
              ),
              emissiveIntensity: 0.0,
              // 透明度設定
              transparent: unityMaterial.mode !== 0, // 0以外は透明
              opacity: unityMaterial.color.a,
              // カットオフ設定
              alphaTest: unityMaterial.cutoff,
              // 深度書き込み設定
              depthWrite: unityMaterial.zWrite === 1,
              // 表面設定
              side: THREE.FrontSide,
            });
            
            // デバッグ情報を出力
            console.log('Unityマテリアル設定:', {
              type: material.type,
              color: material.color,
              roughness: material.roughness,
              metalness: material.metalness,
              map: !!material.map,
              side: material.side,
              transparent: material.transparent,
              opacity: material.opacity
            });

            // テクスチャの設定（Unityの設定を反映）
            if (texture) {
              texture.wrapS = THREE.RepeatWrapping;
              texture.wrapT = THREE.RepeatWrapping;
              texture.repeat.set(
                unityMaterial.mainTex.scale.x,
                unityMaterial.mainTex.scale.y
              );
              texture.offset.set(
                unityMaterial.mainTex.offset.x,
                unityMaterial.mainTex.offset.y
              );
            }

            child.material = material;
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // モデルの重心を計算して中心に配置
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        
        console.log('モデルのバウンディングボックス:', {
          min: box.min,
          max: box.max,
          center: center,
          size: box.getSize(new THREE.Vector3())
        });
        
        // 重心を原点に移動
        object.position.sub(center);
        
        // グループに追加
        if (meshRef.current) {
          meshRef.current.clear();
          meshRef.current.add(object);
          setIsLoaded(true);
          console.log('湖の3Dモデルが正常に読み込まれました（重心を原点に移動）');
        }
      },
      (progress: ProgressEvent) => {
        console.log('Loading progress:', (progress.loaded / progress.total) * 100, '%');
      },
      (error: unknown) => {
        console.error('Error loading OBJ:', error);
        setError('モデルの読み込みに失敗しました');
      }
    );
  }, [texture, basePath]);

  // アニメーション（水面の波効果）- 一時的に無効化
  useFrame((state, delta) => {
    if (meshRef.current && isLoaded) {
      // 水面の波アニメーション（微細な動き）- 一時的に無効化
      // meshRef.current.rotation.y += delta * 0.05;
      
      // マテリアルの反射効果を動的に調整 - 一時的に無効化
      // meshRef.current.traverse((child) => {
      //   if (child instanceof THREE.Mesh && child.material) {
      //     const material = child.material as THREE.MeshStandardMaterial;
      //     // 時間に基づいて反射強度を変化させる
      //     material.metalness = 0.1 + Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
      //   }
      // });
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
    <group
      ref={meshRef}
      position={position}
      scale={scale}
      rotation={rotation}
      visible={visible}
    >
      {!isLoaded && (
        <mesh>
          <boxGeometry args={[10, 1, 10]} />
          <meshStandardMaterial color="#6AB7FF" transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}
