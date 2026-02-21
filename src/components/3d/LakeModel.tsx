
import type React from 'react';
import { useEffect, useState, useRef, memo, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import * as THREE from 'three';
import { TERRAIN_SCALE_FACTOR, WATER_INITIAL_OFFSET, FBX_NORMALIZATION_TARGET } from '../../config/terrain-config';

interface LakeModelProps {
  position?: [number, number, number];
  scale?: [number, number, number];
  rotation?: [number, number, number];
  visible?: boolean;
  terrainScale?: [number, number, number];
  waterPosition?: [number, number, number];
  wireframe?: boolean;
  waterLevelOffset?: number;
  /** 非表示にするオブジェクト名のSet */
  hiddenObjects?: Set<string>;
  /** FBX内のオブジェクト名リストが判明した時のコールバック */
  onObjectsLoaded?: (names: string[]) => void;
}

// ベースパスを動的に取得
const getBasePath = () => {
  return import.meta.env.BASE_URL || '/';
};

// FBXファイルの読み込み結果をキャッシュ（グローバル）
const fbxCache = new Map<string, { fbx: THREE.Group | null; promise: Promise<THREE.Group> }>();

// プリロード用の関数をエクスポート
// eslint-disable-next-line react-refresh/only-export-components
export const preloadLakeModel = () => {
  const basePath = getBasePath();
  const fbxPath = `${basePath}models/OkutamaLake_allmodel_test.fbx`;

  if (fbxCache.has(fbxPath)) {
    return;
  }

  console.log('[LakeModel] Preload: Starting...');
  loadFbxModel(fbxPath);
};

/**
 * FBXモデルをロードし、ジオメトリを正規化する。
 * - ワールド変換をジオメトリにベイク（FBX内部スケール100等を含む）
 * - 全体のbbox中心を原点に移動
 * - XZ最大寸法を FBX_NORMALIZATION_TARGET (~150) にスケール
 * - 頂点カラーがあればマテリアルに反映
 */
const loadFbxModel = (path: string): Promise<THREE.Group> => {
  console.log('[LakeModel] Loading FBX:', path);
  const fbxLoader = new FBXLoader();

  const loadPromise = new Promise<THREE.Group>((resolve, reject) => {
    fbxLoader.load(
      path,
      (loadedFbx) => {
        console.log('[LakeModel] FBX loaded, normalizing...');

        // 全ワールドマトリクスを計算
        loadedFbx.updateMatrixWorld(true);

        // 正規化前のbboxを計算
        const box = new THREE.Box3().setFromObject(loadedFbx);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        console.log('[LakeModel] FBX raw bbox size:', size.x.toFixed(0), size.y.toFixed(0), size.z.toFixed(0));

        // FBX内の全オブジェクトをリストアップ
        const objectNames: string[] = [];
        loadedFbx.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && child.name) {
            objectNames.push(child.name);
          }
        });
        console.log('[LakeModel] FBX mesh objects:', objectNames.join(', '));

        // 正規化行列: まず中心を原点に移動、次にスケール
        const maxDim = Math.max(size.x, size.z);
        const normFactor = FBX_NORMALIZATION_TARGET / maxDim;
        const normMatrix = new THREE.Matrix4()
          .makeTranslation(-center.x, -center.y, -center.z);
        normMatrix.premultiply(
          new THREE.Matrix4().makeScale(normFactor, normFactor, normFactor)
        );

        // メッシュのワールド変換をジオメトリにベイクし、正規化・頂点カラーを適用
        loadedFbx.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            if (mesh.geometry) {
              // ワールド変換をベイク（FBX内部scale=100等を含む）
              mesh.geometry.applyMatrix4(mesh.matrixWorld);
              // 正規化（中心を原点、サイズを~150に）
              mesh.geometry.applyMatrix4(normMatrix);
              // メッシュのトランスフォームをリセット
              mesh.position.set(0, 0, 0);
              mesh.rotation.set(0, 0, 0);
              mesh.scale.set(1, 1, 1);
              mesh.updateMatrix();

              // 頂点カラーの適用
              const hasVertexColors = mesh.geometry.hasAttribute('color');
              if (hasVertexColors) {
                const applyVertexColor = (mat: THREE.Material) => {
                  if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhongMaterial || mat instanceof THREE.MeshLambertMaterial) {
                    mat.vertexColors = true;
                    mat.color.set(0xffffff); // 頂点カラーがそのまま出るように白に
                    mat.needsUpdate = true;
                  }
                };
                if (Array.isArray(mesh.material)) {
                  mesh.material.forEach(applyVertexColor);
                } else {
                  applyVertexColor(mesh.material);
                }
              }
            }
          }
        });

        // 全ての非メッシュノード（Group等）のトランスフォームもリセット
        loadedFbx.traverse((child) => {
          if (!(child as THREE.Mesh).isMesh) {
            child.position.set(0, 0, 0);
            child.rotation.set(0, 0, 0);
            child.scale.set(1, 1, 1);
            child.updateMatrix();
          }
        });
        loadedFbx.position.set(0, 0, 0);
        loadedFbx.rotation.set(0, 0, 0);
        loadedFbx.scale.set(1, 1, 1);
        loadedFbx.updateMatrix();
        loadedFbx.updateMatrixWorld(true);

        // 正規化後のbboxを確認
        const normBox = new THREE.Box3().setFromObject(loadedFbx);
        const normSize = normBox.getSize(new THREE.Vector3());
        console.log('[LakeModel] Normalized bbox size:', normSize.x.toFixed(2), normSize.y.toFixed(2), normSize.z.toFixed(2));

        resolve(loadedFbx);
      },
      undefined,
      (error) => {
        console.error('[LakeModel] Failed to load FBX:', error);
        reject(error);
      }
    );
  });

  fbxCache.set(path, { fbx: null, promise: loadPromise });

  loadPromise.then(fbx => {
    fbxCache.set(path, { fbx, promise: loadPromise });
  }).catch(() => {
    fbxCache.delete(path);
  });

  return loadPromise;
};

// 水面アニメーション開始時間をグローバルに保持
const globalWaterDrainStartTime = { value: null as number | null };

// 水面の現在位置をグローバルに保持
const globalWaterPosition = { value: null as { x: number; y: number; z: number } | null };

export function LakeModel({
  position = [0, 0, 0],
  scale = [1, 1, 1],
  rotation = [0, 0, 0],
  visible = true,
  terrainScale = [1, 1, 1],
  waterPosition = [0, 0, 0],
  wireframe = false,
  waterLevelOffset = 0,
  hiddenObjects,
  onObjectsLoaded,
}: LakeModelProps) {
  const terrainRef = useRef<THREE.Group>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fbxScene, setFbxScene] = useState<THREE.Group | null>(null);
  /** 全メッシュのクローン: { name, object }[] */
  const [clonedMeshes, setClonedMeshes] = useState<{ name: string; object: THREE.Object3D }[]>([]);
  const terrainBottomYRef = useRef<number | null>(null);
  const { scene } = useThree();
  const waterGroupRef = useRef<THREE.Group | null>(null);
  const onObjectsLoadedRef = useRef(onObjectsLoaded);
  onObjectsLoadedRef.current = onObjectsLoaded;

  const basePath = getBasePath();

  // terrainScaleの参照を安定化
  const terrainScaleX = terrainScale[0];
  const terrainScaleY = terrainScale[1];
  const terrainScaleZ = terrainScale[2];
  const stableTerrainScale = useMemo(
    () => [terrainScaleX, terrainScaleY, terrainScaleZ] as [number, number, number],
    [terrainScaleX, terrainScaleY, terrainScaleZ]
  );

  // hiddenObjectsの参照を安定化（Setは毎回新しく作られる可能性があるためrefで保持）
  const hiddenObjectsRef = useRef(hiddenObjects);
  hiddenObjectsRef.current = hiddenObjects;

  // FBXファイルの読み込み（キャッシュを使用）
  useEffect(() => {
    const fbxPath = `${basePath}models/OkutamaLake_allmodel_test.fbx`;

    const cached = fbxCache.get(fbxPath);

    if (cached?.fbx) {
      setFbxScene(cached.fbx);
      setIsLoaded(true);
      return;
    }

    let promise = cached?.promise;
    if (!promise) {
      promise = loadFbxModel(fbxPath);
    }

    promise
      .then((loadedFbx) => {
        if (isMounted) {
          setFbxScene(loadedFbx);
          setIsLoaded(true);
        }
      })
      .catch(() => {
        if (isMounted) setError('モデルの読み込みに失敗しました');
      });

    let isMounted = true;
    return () => { isMounted = false; };
  }, [basePath]);

  // 全メッシュオブジェクトをクローン
  // biome-ignore lint/correctness/useExhaustiveDependencies: clonedMeshesは一度設定されたら変わらない
  useEffect(() => {
    if (!fbxScene || clonedMeshes.length > 0) return;

    const meshes: { name: string; object: THREE.Object3D }[] = [];
    const names: string[] = [];

    fbxScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child.name) {
        const cloned = child.clone();
        meshes.push({ name: child.name, object: cloned });
        names.push(child.name);
      }
    });

    setClonedMeshes(meshes);
    console.log('[LakeModel] 全メッシュクローン完了:', names.join(', '));

    // 親コンポーネントにオブジェクト名リストを通知
    if (onObjectsLoadedRef.current) {
      onObjectsLoadedRef.current(names);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fbxScene]);

  // 水面(RiverWater)オブジェクトをシーンに直接追加（水面アニメーション用）
  const waterMesh = useMemo(
    () => clonedMeshes.find(m => m.name === 'RiverWater'),
    [clonedMeshes]
  );
  const isWaterHidden = hiddenObjects?.has('RiverWater') ?? false;

  useEffect(() => {
    if (!waterMesh || isWaterHidden || !isLoaded) {
      if (waterGroupRef.current?.parent) {
        waterGroupRef.current.parent.remove(waterGroupRef.current);
        waterGroupRef.current = null;
      }
      return;
    }

    if (!waterGroupRef.current) {
      const waterGroup = new THREE.Group();
      waterGroup.name = 'WaterGroup';
      waterGroupRef.current = waterGroup;

      waterMesh.object.scale.set(stableTerrainScale[0], stableTerrainScale[1], stableTerrainScale[2]);
      waterGroup.add(waterMesh.object);

      scene.add(waterGroup);
    } else {
      waterGroupRef.current.scale.set(stableTerrainScale[0], stableTerrainScale[1], stableTerrainScale[2]);
    }

    return () => {
      if (waterGroupRef.current?.parent) {
        waterGroupRef.current.parent.remove(waterGroupRef.current);
        waterGroupRef.current = null;
      }
    };
  }, [waterMesh, isWaterHidden, isLoaded, stableTerrainScale, scene]);

  // アニメーション（水面の干上がり）
  useFrame(() => {
    if (!isLoaded || !waterMesh || isWaterHidden) return;

    const clonedWater = waterMesh.object;
    const initialWaterOffset = (WATER_INITIAL_OFFSET + waterLevelOffset) * TERRAIN_SCALE_FACTOR;
    let waterY = initialWaterOffset;

    if (globalWaterDrainStartTime.value) {
      const elapsed = (Date.now() - globalWaterDrainStartTime.value) / 1000;
      const delay = 1.0;
      const animationDuration = 120.0;

      if (elapsed >= delay) {
        const animationElapsed = elapsed - delay;
        const drainProgress = Math.min(animationElapsed / animationDuration, 1.0);
        const easedProgress = 1 - (1 - drainProgress) ** 3;

        if (terrainBottomYRef.current !== null) {
          const targetWaterY = terrainBottomYRef.current - 5;
          const initialWaterY = waterPosition[1] + initialWaterOffset;
          waterY =
            initialWaterY + (targetWaterY - initialWaterY) * easedProgress - waterPosition[1];
        } else {
          const baseDrainHeight = -25;
          const scaledDrainHeight = baseDrainHeight * TERRAIN_SCALE_FACTOR;
          waterY = initialWaterOffset + scaledDrainHeight * easedProgress;
        }
      }
    }

    const targetX = waterPosition[0];
    const targetY = waterPosition[1] + waterY;
    const targetZ = waterPosition[2];

    globalWaterPosition.value = { x: targetX, y: targetY, z: targetZ };

    clonedWater.position.set(targetX, targetY, targetZ);
    if (waterGroupRef.current) {
      waterGroupRef.current.position.set(
        position[0] + targetX,
        position[1] + targetY,
        position[2] + targetZ
      );
      waterGroupRef.current.updateMatrixWorld(true);
    }
    clonedWater.updateMatrixWorld(true);

    // 水面のマテリアル効果
    clonedWater.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && child.material) {
        const material = child.material as THREE.MeshStandardMaterial;

        if (globalWaterDrainStartTime.value) {
          const elapsed = (Date.now() - globalWaterDrainStartTime.value) / 1000;
          const delay = 1.0;
          const animationDuration = 120.0;

          if (elapsed >= delay) {
            const animationElapsed = elapsed - delay;
            const drainProgress = Math.min(animationElapsed / animationDuration, 1.0);
            const opacity = Math.max(0.4, 0.8 * (1 - drainProgress));
            material.opacity = opacity;
            material.transparent = true;
          } else {
            material.opacity = 0.8;
            material.transparent = true;
          }
        } else {
          material.opacity = 0.8;
          material.transparent = true;
        }

        if (material.metalness !== undefined) {
          material.metalness = 0.2;
        }
        if (material.roughness !== undefined) {
          material.roughness = 0.3;
        }
        if (material.color) {
          material.color.setHSL(0.5, 0.8, 0.6);
        }
      }
    });
  });

  // ワイヤーフレーム表示の切り替え
  useEffect(() => {
    const applyWireframe = (obj: THREE.Object3D | null) => {
      if (!obj) return;
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          if (Array.isArray(child.material)) {
            for (const mat of child.material) {
              if ('wireframe' in mat) {
                (mat as any).wireframe = wireframe;
              }
            }
          } else if ('wireframe' in child.material) {
            (child.material as any).wireframe = wireframe;
          }
        }
      });
    };

    for (const { object } of clonedMeshes) {
      applyWireframe(object);
    }
  }, [wireframe, clonedMeshes]);

  // 地形bboxの計算
  // biome-ignore lint/correctness/useExhaustiveDependencies: positionはデフォルト引数で変化しないがbbox再計算のトリガーとして必要
  useEffect(() => {
    if (terrainRef.current && isLoaded) {
      const timer = setTimeout(() => {
        if (terrainRef.current) {
          const terrainBox = new THREE.Box3().setFromObject(terrainRef.current);
          terrainBottomYRef.current = terrainBox.min.y;
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isLoaded, position]);

  // hiddenObjectsの変更を各メッシュのvisibleに反映
  const updateVisibility = useCallback(() => {
    for (const { name, object } of clonedMeshes) {
      // RiverWaterはシーンに直接追加されるためここではスキップ
      if (name === 'RiverWater') continue;
      object.visible = !(hiddenObjectsRef.current?.has(name) ?? false);
    }
  }, [clonedMeshes]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: hiddenObjectsはrefで保持しているが、prop変更時にvisibility更新を再実行する必要がある
  useEffect(() => {
    updateVisibility();
  }, [hiddenObjects, updateVisibility]);

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

  // RiverWater以外のメッシュをレンダリング（RiverWaterはuseEffectでシーンに直接追加）
  const renderableMeshes = clonedMeshes.filter(m => m.name !== 'RiverWater');

  return (
    <group position={position} scale={scale} rotation={rotation} visible={visible}>
      {isLoaded && renderableMeshes.map(({ name, object }) => (
        <primitive
          key={name}
          ref={name === 'Retopo_OriginalMap001' ? ((ref: THREE.Group | null) => {
            if (ref) {
              (terrainRef as React.MutableRefObject<THREE.Group | null>).current = ref;
            }
          }) : undefined}
          object={object}
          scale={stableTerrainScale}
        />
      ))}

      {!isLoaded && (
        <mesh>
          <boxGeometry args={[10, 1, 10]} />
          <meshStandardMaterial color="#6AB7FF" transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

const MemoizedLakeModel = memo(LakeModel);
export default MemoizedLakeModel;
