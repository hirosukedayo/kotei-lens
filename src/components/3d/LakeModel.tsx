import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { gpsToWorldCoordinate, SCENE_CENTER } from '../../utils/coordinate-converter';
import type { GPSCoordinate } from '../../utils/coordinate-converter';

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
  /** GPS座標で地形モデルの中心位置を指定（オプション） */
  centerGps?: GPSCoordinate;
  /** 地形モデルの目標サイズ（メートル単位、オプション） */
  targetSizeMeters?: [number, number, number];
}

// ベースパスを動的に取得
const getBasePath = () => {
  // Viteの環境変数からベースパスを取得
  return import.meta.env.BASE_URL || '/';
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
  waterPosition = [0, 0, 0],
  centerGps,
  targetSizeMeters,
}: LakeModelProps) {
  const terrainRef = useRef<THREE.Group>(null);
  const waterRef = useRef<THREE.Group>(null);
  const groupRef = useRef<THREE.Group>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gltf, setGltf] = useState<GLTF | null>(null);
  const [waterDrainStartTime, setWaterDrainStartTime] = useState<number | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [calculatedPosition, setCalculatedPosition] = useState<[number, number, number]>(position);

  const basePath = getBasePath();

  // glTFファイルの読み込み
  useEffect(() => {
    const gltfLoader = new GLTFLoader();
    const gltfPath = `${basePath}models/OkutamaLake_realscale.glb`;

    console.log('glTFファイルパス:', gltfPath);
    console.log('デバイス情報:', {
      userAgent: navigator.userAgent,
      isMobile: /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        navigator.userAgent.toLowerCase()
      ),
      memory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 'unknown',
      connection:
        (navigator as Navigator & { connection?: { effectiveType?: string } }).connection
          ?.effectiveType || 'unknown',
    });

    // モバイル用の読み込み設定
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      navigator.userAgent.toLowerCase()
    );

    gltfLoader.load(
      gltfPath,
      (loadedGltf) => {
        setGltf(loadedGltf);
        setIsLoaded(true);
        setWaterDrainStartTime(Date.now()); // 干上がりアニメーション開始時間を設定
        console.log('glTFファイルが正常に読み込まれました');

        if (!isMobile) {
          // PCでのみ詳細ログを出力
          console.log('glTF情報:', {
            scene: loadedGltf.scene,
            animations: loadedGltf.animations,
            cameras: loadedGltf.cameras,
            asset: loadedGltf.asset,
          });

          // シーンの詳細情報を出力
          console.log('シーンの子オブジェクト:', loadedGltf.scene.children);
          loadedGltf.scene.traverse((child) => {
            console.log('オブジェクト:', child.name, child.type);
          });

          // バウンディングボックスを計算してログ出力
          const box = new THREE.Box3().setFromObject(loadedGltf.scene);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());

          console.log('=== モデルのバウンディングボックス ===');
          console.log('最小値 (min):', {
            x: box.min.x,
            y: box.min.y,
            z: box.min.z,
          });
          console.log('最大値 (max):', {
            x: box.max.x,
            y: box.max.y,
            z: box.max.z,
          });
          console.log('中心点 (center):', {
            x: center.x,
            y: center.y,
            z: center.z,
          });
          console.log('サイズ (size):', {
            x: size.x,
            y: size.y,
            z: size.z,
          });
          console.log('=====================================');
        }
      },
      (progress) => {
        const percentage = (progress.loaded / progress.total) * 100;
        setLoadingProgress(percentage);

        // モバイルでの読み込みが遅い場合の警告
        if (isMobile && percentage < 10 && progress.total > 0) {
          console.warn(
            'モバイルでの読み込みが遅い可能性があります。ファイルサイズ:',
            (progress.total / 1024 / 1024).toFixed(1),
            'MB'
          );
        }
      },
      (error) => {
        console.error('glTFファイルの読み込みに失敗:', error);
        setError('glTFファイルの読み込みに失敗しました');
      }
    );
  }, [basePath]);

  // 地形と水面を分離して取得する関数
  const getTerrainObject = () => {
    if (!gltf) return null;
    console.log('地形オブジェクトを検索中...');
    let terrain = gltf.scene.getObjectByName('Displacement.001');

    // 名前で見つからない場合は、メッシュを直接検索
    // if (!terrain) {
    //   console.log('名前で見つからないため、メッシュを直接検索...');
    //   gltf.scene.traverse((child) => {
    //     if (child.name && child.name.includes("Displacement")) {
    //       terrain = child;
    //       console.log('地形オブジェクト（代替）:', child);
    //     }
    //   });
    // }

    // それでも見つからない場合は、シーンの最初のオブジェクトを使用
    if (!terrain && gltf.scene.children.length > 0) {
      terrain = gltf.scene.children[0];
      console.log('地形オブジェクト（フォールバック）:', terrain);
    }

    console.log('地形オブジェクト:', terrain);

    // 地形のバウンディングボックスを出力（terrainScale適用前）
    if (terrain) {
      const terrainBox = new THREE.Box3().setFromObject(terrain);
      const terrainCenter = terrainBox.getCenter(new THREE.Vector3());
      const terrainSize = terrainBox.getSize(new THREE.Vector3());

      console.log('=== 地形のバウンディングボックス（terrainScale適用前） ===');
      console.log('最小値:', { x: terrainBox.min.x, y: terrainBox.min.y, z: terrainBox.min.z });
      console.log('最大値:', { x: terrainBox.max.x, y: terrainBox.max.y, z: terrainBox.max.z });
      console.log('中心点:', { x: terrainCenter.x, y: terrainCenter.y, z: terrainCenter.z });
      console.log('サイズ:', { x: terrainSize.x, y: terrainSize.y, z: terrainSize.z });

      // terrainScale適用後の中心を計算
      // スケールは原点を中心に適用されるため、中心点もスケール倍される
      const scale = terrainScale[0]; // x, y, z は同じ値と仮定
      const terrainCenterScaled = {
        x: terrainCenter.x * scale,
        y: terrainCenter.y * scale,
        z: terrainCenter.z * scale,
      };
      console.log('terrainScale:', terrainScale);
      console.log('terrainScale適用後の中心（推定）:', terrainCenterScaled);
      console.log('=====================================');
    }

    return terrain;
  };

  const getWaterObject = () => {
    if (!gltf) return null;
    console.log('水面オブジェクトを検索中...');
    let water = gltf.scene.getObjectByName('Water');

    // 名前で見つからない場合は、メッシュを直接検索
    // if (!water) {
    //   console.log('名前で見つからないため、メッシュを直接検索...');
    //   gltf.scene.traverse((child) => {
    //     if (child.name && child.name.includes("Water")) {
    //       water = child;
    //       console.log('水面オブジェクト（代替）:', child);
    //     }
    //   });
    // }

    // それでも見つからない場合は、シーンの2番目のオブジェクトを使用
    if (!water && gltf.scene.children.length > 1) {
      water = gltf.scene.children[1];
      console.log('水面オブジェクト（フォールバック）:', water);
    }

    console.log('水面オブジェクト:', water);

    // 水面のバウンディングボックスを出力
    if (water) {
      const waterBox = new THREE.Box3().setFromObject(water);
      const waterCenter = waterBox.getCenter(new THREE.Vector3());
      const waterSize = waterBox.getSize(new THREE.Vector3());

      console.log('=== 水面のバウンディングボックス ===');
      console.log('最小値:', { x: waterBox.min.x, y: waterBox.min.y, z: waterBox.min.z });
      console.log('最大値:', { x: waterBox.max.x, y: waterBox.max.y, z: waterBox.max.z });
      console.log('中心点:', { x: waterCenter.x, y: waterCenter.y, z: waterCenter.z });
      console.log('サイズ:', { x: waterSize.x, y: waterSize.y, z: waterSize.z });
      console.log('=====================================');
    }

    return water;
  };

  // アニメーション（水面の波効果と干上がり）
  useFrame((state: { clock: { elapsedTime: number } }, delta: number) => {
    if (waterRef.current && isLoaded && showWater) {
      const time = state.clock.elapsedTime;

      // 干上がりアニメーション（50%で停止）
      let waterY = 0;
      if (waterDrainStartTime) {
        const elapsed = (Date.now() - waterDrainStartTime) / 1000; // 経過秒数
        const drainProgress = Math.min(elapsed / 15.0, 0.5); // 15秒で50%まで（30秒の50%）

        // イージング関数（easeOutCubic）
        const easedProgress = 1 - (1 - drainProgress) ** 3;

        // 水面を下に移動（-25まで下げる、-50の50%）
        waterY = -25 * easedProgress;
      }

      // 水面の波アニメーション（干上がり中は波を小さく、50%で停止）
      const waveIntensity = waterDrainStartTime
        ? Math.max(0.5, 1 - (Date.now() - waterDrainStartTime) / 1000 / 15.0)
        : 1;

      waterRef.current.rotation.y += delta * 0.02 * waveIntensity;

      // 水面の位置（波 + 干上がり）
      const waveY =
        Math.sin(time * 0.8) * 0.5 * waveIntensity + Math.sin(time * 1.2) * 0.3 * waveIntensity;
      waterRef.current.position.y = waveY + waterY;

      // 水面のマテリアル効果を動的に調整
      waterRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const material = child.material as THREE.MeshStandardMaterial;

          // 干上がりに伴う透明度の変化（50%で停止）
          if (waterDrainStartTime) {
            const elapsed = (Date.now() - waterDrainStartTime) / 1000;
            const drainProgress = Math.min(elapsed / 15.0, 0.5);
            const opacity = Math.max(0.4, 0.8 * (1 - drainProgress)); // 透明度を徐々に下げる（80%→40%）
            material.opacity = opacity;
            material.transparent = true;
          }

          // 反射強度を時間に基づいて変化させる
          if (material.metalness !== undefined) {
            material.metalness = 0.2 + Math.sin(time * 0.8) * 0.1 * waveIntensity;
          }

          // 粗さを時間に基づいて変化させる
          if (material.roughness !== undefined) {
            material.roughness = 0.3 + Math.sin(time * 1.2) * 0.2 * waveIntensity;
          }

          // 色を微細に変化させる
          if (material.color) {
            const hue = (time * 0.1) % 1;
            material.color.setHSL(hue * 0.1 + 0.5, 0.8, 0.6); // 青系の色相変化
          }
        }
      });
    }
  });

  // 地形モデルの実際の位置を確認するためのデバッグログ
  // 注意: useEffectは早期リターンの前に配置する必要がある（React Hooksのルール）
  useEffect(() => {
    if (terrainRef.current && isLoaded) {
      // 少し遅延させて、地形が完全に配置されるのを待つ
      const timer = setTimeout(() => {
        if (terrainRef.current) {
          // 地形モデルの実際の位置を取得
          const terrainWorldPosition = new THREE.Vector3();
          terrainRef.current.getWorldPosition(terrainWorldPosition);

          // 地形のバウンディングボックスを取得（terrainScale適用後）
          const terrainBox = new THREE.Box3().setFromObject(terrainRef.current);
          const terrainCenter = terrainBox.getCenter(new THREE.Vector3());
          const terrainSize = terrainBox.getSize(new THREE.Vector3());

          console.log('=== 地形モデルの実際の位置（terrainScale適用後） ===');
          console.log('groupのpositionプロパティ:', position);
          console.log('地形のワールド位置:', {
            x: terrainWorldPosition.x,
            y: terrainWorldPosition.y,
            z: terrainWorldPosition.z,
          });
          console.log('地形のバウンディングボックス中心:', {
            x: terrainCenter.x,
            y: terrainCenter.y,
            z: terrainCenter.z,
          });
          console.log('地形のサイズ:', {
            x: terrainSize.x,
            y: terrainSize.y,
            z: terrainSize.z,
          });
          console.log('=====================================');
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isLoaded, position]);

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
      ref={groupRef}
      position={calculatedPosition}
      scale={scale}
      rotation={rotation}
      visible={visible}
    >
      {/* 地形の表示 */}
      {showTerrain &&
        isLoaded &&
        (() => {
          const terrain = getTerrainObject();
          if (terrain) {
            // terrainScale適用後の実際のバウンディングボックスを取得
            const terrainScaled = terrain.clone();
            terrainScaled.scale.set(terrainScale[0], terrainScale[1], terrainScale[2]);
            const terrainBoxScaled = new THREE.Box3().setFromObject(terrainScaled);
            const terrainCenterScaled = terrainBoxScaled.getCenter(new THREE.Vector3());
            const terrainSizeScaled = terrainBoxScaled.getSize(new THREE.Vector3());

            console.log('=== 地形のバウンディングボックス（terrainScale適用後、実際の値） ===');
            console.log('最小値:', {
              x: terrainBoxScaled.min.x,
              y: terrainBoxScaled.min.y,
              z: terrainBoxScaled.min.z,
            });
            console.log('最大値:', {
              x: terrainBoxScaled.max.x,
              y: terrainBoxScaled.max.y,
              z: terrainBoxScaled.max.z,
            });
            console.log('中心点:', {
              x: terrainCenterScaled.x,
              y: terrainCenterScaled.y,
              z: terrainCenterScaled.z,
            });
            console.log('サイズ:', {
              x: terrainSizeScaled.x,
              y: terrainSizeScaled.y,
              z: terrainSizeScaled.z,
            });
            console.log('=====================================');
          }
          return terrain ? (
            <primitive ref={terrainRef} object={terrain} scale={terrainScale} />
          ) : null;
        })()}

      {/* 水面の表示 */}
      {showWater &&
        isLoaded &&
        (() => {
          const water = getWaterObject();
          return water ? (
            <primitive
              ref={waterRef}
              object={water}
              position={waterPosition}
              scale={waterScale}
              onUpdate={(self: THREE.Object3D) => {
                // 水面のマテリアルを動的に調整
                if (self?.traverse) {
                  self.traverse((child: THREE.Object3D) => {
                    if (child instanceof THREE.Mesh && child.material) {
                      const material = child.material as THREE.MeshStandardMaterial;

                      // 透明度を設定
                      material.transparent = true;
                      material.opacity = 0.8;

                      // 反射を強化
                      material.metalness = 0.3;
                      material.roughness = 0.2;

                      // 色を青系に設定
                      material.color.setHSL(0.6, 0.8, 0.6);

                      // 両面表示を有効化
                      material.side = THREE.DoubleSide;
                    }
                  });
                }
              }}
            />
          ) : null;
        })()}

      {/* ローディング表示 */}
      {!isLoaded && (
        <mesh>
          <boxGeometry args={[10, 1, 10]} />
          <meshStandardMaterial color="#6AB7FF" transparent opacity={0.5} />
        </mesh>
      )}

      {/* ローディング進捗表示（モバイル用） */}
      {!isLoaded && loadingProgress > 0 && (
        <mesh position={[0, 5, 0]}>
          <planeGeometry args={[20, 2]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.7} />
        </mesh>
      )}
    </group>
  );
}
