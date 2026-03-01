
import type React from 'react';
import { useEffect, useState, useRef, memo, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { TERRAIN_SCALE_FACTOR, WATER_INITIAL_OFFSET, FBX_NORMALIZATION_TARGET } from '../../config/terrain-config';
import { createTerrainSplatMaterial } from './TerrainSplatMaterial';

interface LakeModelProps {
  position?: [number, number, number];
  scale?: [number, number, number];
  rotation?: [number, number, number];
  visible?: boolean;
  terrainScale?: [number, number, number];
  waterPosition?: [number, number, number];
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

// モデルファイルの読み込み結果をキャッシュ（グローバル）
const modelCache = new Map<string, { model: THREE.Group | null; promise: Promise<THREE.Group> }>();

// プリロード用の関数をエクスポート
// eslint-disable-next-line react-refresh/only-export-components
export const preloadLakeModel = () => {
  const basePath = getBasePath();
  const modelPath = `${basePath}models/OkutamaLake_allmodel_test0301.glb`;

  if (modelCache.has(modelPath)) {
    return;
  }

  console.log('[LakeModel] Preload: Starting...');
  loadModel(modelPath);
};

/**
 * GLBモデルをロードし、ジオメトリを正規化する。
 * - ワールド変換をジオメトリにベイク
 * - 全体のbbox中心を原点に移動
 * - XZ最大寸法を FBX_NORMALIZATION_TARGET (~150) にスケール
 * - COLOR_1 をスプラットマップとして使用
 */
const loadModel = (path: string): Promise<THREE.Group> => {
  console.log('[LakeModel] Loading GLB:', path);
  const gltfLoader = new GLTFLoader();

  const loadPromise = new Promise<THREE.Group>((resolve, reject) => {
    gltfLoader.load(
      path,
      (gltf) => {
        const loadedScene = gltf.scene;
        console.log('[LakeModel] GLB loaded, normalizing...');

        // 全ワールドマトリクスを計算
        loadedScene.updateMatrixWorld(true);

        // 正規化前のbboxを計算
        const box = new THREE.Box3().setFromObject(loadedScene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        console.log('[LakeModel] GLB raw bbox size:', size.x.toFixed(0), size.y.toFixed(0), size.z.toFixed(0));

        // GLB内の全オブジェクトをリストアップ
        const objectNames: string[] = [];
        loadedScene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && child.name) {
            objectNames.push(child.name);
          }
        });
        console.log('[LakeModel] GLB mesh objects:', objectNames.join(', '));

        // 正規化行列: まず中心を原点に移動、次にスケール
        const maxDim = Math.max(size.x, size.z);
        const normFactor = FBX_NORMALIZATION_TARGET / maxDim;
        const normMatrix = new THREE.Matrix4()
          .makeTranslation(-center.x, -center.y, -center.z);
        normMatrix.premultiply(
          new THREE.Matrix4().makeScale(normFactor, normFactor, normFactor)
        );

        // スプラットマップマテリアルを事前作成
        const basePath = getBasePath();
        const splatMaterial = createTerrainSplatMaterial(basePath);

        // メッシュのワールド変換をジオメトリにベイクし、正規化・マテリアルを適用
        loadedScene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            if (mesh.geometry) {
              // ワールド変換をベイク
              mesh.geometry.applyMatrix4(mesh.matrixWorld);
              // 正規化（中心を原点、サイズを~150に）
              mesh.geometry.applyMatrix4(normMatrix);
              // メッシュのトランスフォームをリセット
              mesh.position.set(0, 0, 0);
              mesh.rotation.set(0, 0, 0);
              mesh.scale.set(1, 1, 1);
              mesh.updateMatrix();

              // GLTFLoaderはTEXCOORD_1を"uv1"として読み込む場合がある
              if (mesh.geometry.hasAttribute('uv1') && !mesh.geometry.hasAttribute('uv2')) {
                mesh.geometry.setAttribute('uv2', mesh.geometry.getAttribute('uv1'));
              }

              // COLOR_1 を持つメッシュ: スプラットマップマテリアルを適用
              // GLTFLoaderはCOLOR_1を "color_1" として読み込む（ATTRIBUTES未定義→toLowerCase()）
              const color1Attr = mesh.geometry.getAttribute('color_1');
              if (mesh.geometry.hasAttribute('uv2') && color1Attr) {
                // COLOR_1 (RGBA) を splatColor attribute として設定
                mesh.geometry.setAttribute('splatColor', color1Attr);

                mesh.material = splatMaterial;
              } else if (mesh.name.includes('RiverWater')) {
                // 水面マテリアル: リアルな水の質感
                mesh.material = new THREE.MeshPhysicalMaterial({
                  color: new THREE.Color(0.08, 0.15, 0.25),
                  metalness: 0.1,
                  roughness: 0.15,
                  transmission: 0.3,
                  transparent: true,
                  opacity: 0.85,
                  envMapIntensity: 1.5,
                  clearcoat: 0.3,
                  clearcoatRoughness: 0.1,
                  side: THREE.DoubleSide,
                });
              } else {
                // Cubeメッシュのマテリアル名を確認して防波堤を判定
                const currentMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
                const matName = currentMat?.name || '';

                if (matName === '' || !currentMat || !(currentMat as THREE.MeshStandardMaterial).color) {
                  // マテリアル未設定のCube = 防波堤（コンクリート質感）
                  mesh.material = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(0.6, 0.58, 0.55),
                    metalness: 0.0,
                    roughness: 0.85,
                    side: THREE.DoubleSide,
                  });
                } else {
                  // 通常マテリアルの設定
                  const hasVertexColors = mesh.geometry.hasAttribute('color');
                  const applyMaterialSettings = (mat: THREE.Material) => {
                    if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhongMaterial || mat instanceof THREE.MeshLambertMaterial) {
                      if (hasVertexColors) {
                        mat.vertexColors = true;
                        mat.color.set(0xffffff);
                      }
                      mat.needsUpdate = true;
                    }
                  };
                  if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(applyMaterialSettings);
                  } else {
                    applyMaterialSettings(mesh.material);
                  }
                }
              }
            }
          }
        });

        // 全ての非メッシュノード（Group等）のトランスフォームもリセット
        loadedScene.traverse((child) => {
          if (!(child as THREE.Mesh).isMesh) {
            child.position.set(0, 0, 0);
            child.rotation.set(0, 0, 0);
            child.scale.set(1, 1, 1);
            child.updateMatrix();
          }
        });
        loadedScene.position.set(0, 0, 0);
        loadedScene.rotation.set(0, 0, 0);
        loadedScene.scale.set(1, 1, 1);
        loadedScene.updateMatrix();
        loadedScene.updateMatrixWorld(true);

        // 正規化後のbboxを確認
        const normBox = new THREE.Box3().setFromObject(loadedScene);
        const normSize = normBox.getSize(new THREE.Vector3());
        console.log('[LakeModel] Normalized bbox size:', normSize.x.toFixed(2), normSize.y.toFixed(2), normSize.z.toFixed(2));

        resolve(loadedScene);
      },
      undefined,
      (error) => {
        console.error('[LakeModel] Failed to load GLB:', error);
        reject(error);
      }
    );
  });

  modelCache.set(path, { model: null, promise: loadPromise });

  loadPromise.then(model => {
    modelCache.set(path, { model, promise: loadPromise });
  }).catch(() => {
    modelCache.delete(path);
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
  waterLevelOffset = 0,
  hiddenObjects,
  onObjectsLoaded,
}: LakeModelProps) {
  const terrainRef = useRef<THREE.Group>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelScene, setModelScene] = useState<THREE.Group | null>(null);
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

  // モデルファイルの読み込み（キャッシュを使用）
  useEffect(() => {
    const modelPath = `${basePath}models/OkutamaLake_allmodel_test0301.glb`;

    const cached = modelCache.get(modelPath);

    if (cached?.model) {
      setModelScene(cached.model);
      setIsLoaded(true);
      return;
    }

    let promise = cached?.promise;
    if (!promise) {
      promise = loadModel(modelPath);
    }

    promise
      .then((loadedModel) => {
        if (isMounted) {
          setModelScene(loadedModel);
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
    if (!modelScene || clonedMeshes.length > 0) return;

    const meshes: { name: string; object: THREE.Object3D }[] = [];
    const names: string[] = [];

    modelScene.traverse((child) => {
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
  }, [modelScene]);

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

    // 水面のマテリアル効果（ドレインアニメーション時の透明度変化のみ）
    if (globalWaterDrainStartTime.value) {
      clonedWater.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh && child.material) {
          const material = child.material as THREE.MeshPhysicalMaterial;
          const elapsed = (Date.now() - (globalWaterDrainStartTime.value ?? 0)) / 1000;
          const delay = 1.0;
          const animationDuration = 120.0;

          if (elapsed >= delay) {
            const animationElapsed = elapsed - delay;
            const drainProgress = Math.min(animationElapsed / animationDuration, 1.0);
            material.opacity = Math.max(0.3, 0.85 * (1 - drainProgress));
          }
        }
      });
    }
  });

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
          ref={name === 'GroundModeling03_Scaling001' ? ((ref: THREE.Group | null) => {
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
