
import type React from 'react';
import { useEffect, useState, useRef, memo, useMemo, useCallback } from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { FBX_NORMALIZATION_TARGET } from '../../config/terrain-config';
import { createTerrainSplatMaterial } from './TerrainSplatMaterial';

interface LakeModelProps {
  position?: [number, number, number];
  scale?: [number, number, number];
  rotation?: [number, number, number];
  visible?: boolean;
  terrainScale?: [number, number, number];
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
  const modelPath = `${basePath}models/OkutamaLake_Finished_0315.glb`;

  if (modelCache.has(modelPath)) {
    return;
  }

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
  const gltfLoader = new GLTFLoader();

  const loadPromise = new Promise<THREE.Group>((resolve, reject) => {
    gltfLoader.load(
      path,
      (gltf) => {
        const loadedScene = gltf.scene;
        // 全ワールドマトリクスを計算
        loadedScene.updateMatrixWorld(true);

        // 正規化前のbboxを計算
        const box = new THREE.Box3().setFromObject(loadedScene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        // GLB内の全オブジェクトをリストアップ
        const objectNames: string[] = [];
        loadedScene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && child.name) {
            objectNames.push(child.name);
          }
        });
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

export function LakeModel({
  position = [0, 0, 0],
  scale = [1, 1, 1],
  rotation = [0, 0, 0],
  visible = true,
  terrainScale = [1, 1, 1],
  hiddenObjects,
  onObjectsLoaded,
}: LakeModelProps) {
  const terrainRef = useRef<THREE.Group>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelScene, setModelScene] = useState<THREE.Group | null>(null);
  /** 全メッシュのクローン: { name, object }[] */
  const [clonedMeshes, setClonedMeshes] = useState<{ name: string; object: THREE.Object3D }[]>([]);
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
    let isMounted = true;
    const modelPath = `${basePath}models/OkutamaLake_Finished_0315.glb`;

    const cached = modelCache.get(modelPath);
    console.log('[LakeModel] mount, cached:', !!cached?.model, 'promise:', !!cached?.promise);

    if (cached?.model) {
      setModelScene(cached.model);
      setIsLoaded(true);
      return () => { isMounted = false; };
    }

    const promise = cached?.promise ?? loadModel(modelPath);

    promise
      .then((loadedModel) => {
        console.log('[LakeModel] promise resolved, isMounted:', isMounted);
        if (isMounted) {
          setModelScene(loadedModel);
          setIsLoaded(true);
        }
      })
      .catch(() => {
        if (isMounted) setError('モデルの読み込みに失敗しました');
      });

    return () => { isMounted = false; };
  }, [basePath]);

  // 全メッシュオブジェクトを深くクローン（ジオメトリ・マテリアルも複製）
  // アンマウント時のdisposeで元データが壊れないようにする
  // biome-ignore lint/correctness/useExhaustiveDependencies: clonedMeshesは一度設定されたら変わらない
  useEffect(() => {
    console.log('[LakeModel] clone effect, modelScene:', !!modelScene, 'clonedMeshes:', clonedMeshes.length);
    if (!modelScene || clonedMeshes.length > 0) return;

    const meshes: { name: string; object: THREE.Object3D }[] = [];
    const names: string[] = [];

    modelScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child.name) {
        const srcMesh = child as THREE.Mesh;
        const cloned = srcMesh.clone();
        // ジオメトリとマテリアルも深くクローンしてdisposeの影響を遮断
        cloned.geometry = srcMesh.geometry.clone();
        if (Array.isArray(srcMesh.material)) {
          cloned.material = srcMesh.material.map(m => m.clone());
        } else {
          cloned.material = srcMesh.material.clone();
        }
        meshes.push({ name: child.name, object: cloned });
        names.push(child.name);
      }
    });

    setClonedMeshes(meshes);
    // 親コンポーネントにオブジェクト名リストを通知
    if (onObjectsLoadedRef.current) {
      onObjectsLoadedRef.current(names);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelScene]);

  // hiddenObjectsの変更を各メッシュのvisibleに反映
  const updateVisibility = useCallback(() => {
    for (const { name, object } of clonedMeshes) {
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

  return (
    <group position={position} scale={scale} rotation={rotation} visible={visible}>
      {isLoaded && clonedMeshes.map(({ name, object }) => (
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
