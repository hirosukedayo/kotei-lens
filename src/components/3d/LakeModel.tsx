
import type React from 'react';
import { useEffect, useState, useRef, memo, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { TERRAIN_SCALE_FACTOR, WATER_INITIAL_OFFSET } from '../../config/terrain-config';

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
  wireframe?: boolean;
  waterLevelOffset?: number;
}

// ベースパスを動的に取得
const getBasePath = () => {
  // Viteの環境変数からベースパスを取得
  return import.meta.env.BASE_URL || '/';
};

// glTFファイルの読み込み結果をキャッシュ（グローバル）
const gltfCache = new Map<string, { gltf: GLTF | null; promise: Promise<GLTF> }>();

// プリロード用の関数をエクスポート
// eslint-disable-next-line react-refresh/only-export-components
export const preloadLakeModel = () => {
  const basePath = getBasePath();
  const gltfPath = `${basePath}models/OkutamaLake_realscale.glb`;

  // 既にキャッシュがあれば何もしない（あるいはそのPromiseを返す）
  if (gltfCache.has(gltfPath)) {
    console.log('[LakeModel] Preload: Already cached or loading.');
    return;
  }

  console.log('[LakeModel] Preload: Starting preload...');
  // 実際にロードを開始
  loadGltfModel(gltfPath);
};

// 実際のロード処理（内部用）
const loadGltfModel = (path: string): Promise<GLTF> => {
  console.log('[LakeModel] Loading GLTF:', path);
  const gltfLoader = new GLTFLoader();

  const loadPromise = new Promise<GLTF>((resolve, reject) => {
    gltfLoader.load(
      path,
      (loadedGltf) => {
        console.log('[LakeModel] ✅ GLTF loaded successfully');
        resolve(loadedGltf);
      },
      undefined, // progress is handled in component if needed, but for preload we skip it
      (error) => {
        console.error('[LakeModel] ❌ Failed to load GLTF:', error);
        reject(error);
      }
    );
  });

  // キャッシュにセット
  gltfCache.set(path, { gltf: null, promise: loadPromise });

  // 完了時にキャッシュ更新
  loadPromise.then(gltf => {
    gltfCache.set(path, { gltf, promise: loadPromise });
  }).catch(() => {
    // エラー時はキャッシュ削除してリトライできるようにする？
    gltfCache.delete(path);
  });

  return loadPromise;
};

// 水面アニメーション開始時間をグローバルに保持（コンポーネント再マウント時も保持）
const globalWaterDrainStartTime = { value: null as number | null };

// 水面の現在位置をグローバルに保持（コンポーネント再マウント時も保持）
const globalWaterPosition = { value: null as { x: number; y: number; z: number } | null };

export function LakeModel({
  position = [0, 0, 0],
  scale = [1, 1, 1],
  rotation = [0, 0, 0],
  visible = true,
  showTerrain = true,
  showWater = true,
  terrainScale = [1, 1, 1],
  waterScale = [1, 1, 1],
  waterPosition = [0, 0, 0],
  wireframe = false,
  waterLevelOffset = 0,
}: LakeModelProps) {
  const terrainRef = useRef<THREE.Group>(null);
  const waterRef = useRef<THREE.Group>(null);
  const clonedTerrainRef = useRef<THREE.Object3D | null>(null); // クローンした地形オブジェクトを保持（内部参照用）
  const [clonedTerrain, setClonedTerrain] = useState<THREE.Object3D | null>(null); // Reactの状態として管理
  const clonedWaterRef = useRef<THREE.Object3D | null>(null); // クローンした水面オブジェクトを保持（内部参照用）
  const [clonedWater, setClonedWater] = useState<THREE.Object3D | null>(null); // Reactの状態として管理
  const renderCountRef = useRef(0); // レンダリング回数を追跡
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gltf, setGltf] = useState<GLTF | null>(null);
  // const [loadingProgress, setLoadingProgress] = useState(0);
  const terrainBottomYRef = useRef<number | null>(null); // 地形の一番下のY座標（スケール適用後、ワールド座標）
  const { scene } = useThree(); // シーンへの参照を取得
  const waterGroupRef = useRef<THREE.Group | null>(null); // 水面用のGroup（シーンに直接追加）

  const basePath = getBasePath();

  // terrainScaleの参照を安定化（配列の参照が変わるのを防ぐ）
  // 配列の各要素を個別に取得して依存配列に含める
  const terrainScaleX = terrainScale[0];
  const terrainScaleY = terrainScale[1];
  const terrainScaleZ = terrainScale[2];
  const stableTerrainScale = useMemo(
    () => [terrainScaleX, terrainScaleY, terrainScaleZ] as [number, number, number],
    [terrainScaleX, terrainScaleY, terrainScaleZ]
  );

  // waterScaleの参照を安定化
  const waterScaleX = waterScale[0];
  const waterScaleY = waterScale[1];
  const waterScaleZ = waterScale[2];
  const stableWaterScale = useMemo(
    () => [waterScaleX, waterScaleY, waterScaleZ] as [number, number, number],
    [waterScaleX, waterScaleY, waterScaleZ]
  );

  // レンダリング回数を追跡
  renderCountRef.current += 1;
  // console.log(`[LakeModel] レンダリング #${ renderCountRef.current } `, {
  //   position,
  //   visible,
  //   showTerrain,
  //   showWater,
  //   terrainScale,
  //   hasGltf: !!gltf,
  //   hasTerrain: !!terrainRef.current,
  //   hasWater: !!waterRef.current,
  // });
  // console.log(`[LakeModel] レンダリング #${ renderCountRef.current } `, {
  //   visible,
  //   showTerrain,
  //   isLoaded,
  //   hasClonedTerrain: !!clonedTerrain,
  //   terrainRefCurrent: !!terrainRef.current,
  //   terrainScale,
  // });

  // glTFファイルの読み込み（キャッシュを使用）
  useEffect(() => {
    const gltfPath = `${basePath}models/OkutamaLake_realscale.glb`;
    console.log('[LakeModel] Component mounted, checking cache for:', gltfPath);

    const cached = gltfCache.get(gltfPath);

    // 1. キャッシュ済み
    if (cached?.gltf) {
      setGltf(cached.gltf);
      setIsLoaded(true);
      return;
    }

    // 2. ロード中 or 未ロード
    let promise = cached?.promise;
    if (!promise) {
      // 未ロードなら開始
      promise = loadGltfModel(gltfPath);
    }

    // Promiseの結果を待つ
    promise
      .then((loadedGltf) => {
        if (isMounted) {
          setGltf(loadedGltf);
          setIsLoaded(true);
        }
      })
      .catch(() => {
        if (isMounted) setError('モデルの読み込みに失敗しました');
      });

    let isMounted = true;
    return () => { isMounted = false; };
  }, [basePath]);


  // 地形オブジェクトを一度だけクローンして保持（useEffectで実行）
  // clonedTerrainは一度設定されたら変わらないため、依存配列に含めない（無限ループを防ぐ）
  // biome-ignore lint/correctness/useExhaustiveDependencies: clonedTerrainは一度設定されたら変わらないため、依存配列に含めない
  useEffect(() => {
    console.log('[LakeModel] useEffect: 地形クローン処理開始', {
      hasGltf: !!gltf,
      hasClonedTerrain: !!clonedTerrain,
      gltfSceneChildren: gltf?.scene?.children?.length || 0,
      renderCount: renderCountRef.current,
    });

    if (!gltf) {
      console.log('[LakeModel] gltfがnullのためスキップ');
      return;
    }

    if (clonedTerrain) {
      console.log('[LakeModel] 既にクローン済みのためスキップ', {
        existingClone: {
          name: clonedTerrain.name,
          type: clonedTerrain.type,
          uuid: clonedTerrain.uuid,
        },
      });
      return;
    }

    console.log('[LakeModel] 地形オブジェクトを検索中...', {
      sceneChildren: gltf.scene.children.length,
      sceneChildrenNames: gltf.scene.children.map((c) => c.name),
    });
    let terrain = gltf.scene.getObjectByName('Displacement.001');

    // それでも見つからない場合は、シーンの最初のオブジェクトを使用
    if (!terrain && gltf.scene.children.length > 0) {
      terrain = gltf.scene.children[0];
      console.log('[LakeModel] 地形オブジェクト（フォールバック）:', {
        terrain,
        name: terrain.name,
        type: terrain.type,
      });
    }

    if (terrain) {
      // 地形オブジェクトをクローンして独立したオブジェクトとして保持
      const cloned = terrain.clone();
      clonedTerrainRef.current = cloned; // refにも保持（後方互換性のため）
      setClonedTerrain(cloned); // Reactの状態として設定
      console.log('[LakeModel] ✅ 地形オブジェクトをクローンしました:', {
        clonedObject: cloned,
        name: cloned.name,
        type: cloned.type,
        uuid: cloned.uuid,
        renderCount: renderCountRef.current,
      });
    } else {
      console.warn('[LakeModel] ❌ 地形オブジェクトが見つかりませんでした', {
        sceneChildren: gltf.scene.children.length,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf]); // gltfが変わったときだけ実行（clonedTerrainは一度設定されたら変わらないため、依存配列に含めない）

  // 水面オブジェクトを一度だけクローンして保持（useEffectで実行）
  // biome-ignore lint/correctness/useExhaustiveDependencies: clonedWaterは一度設定されたら変わらないため、依存配列に含めない
  useEffect(() => {
    console.log('[LakeModel] useEffect: 水面クローン処理開始', {
      hasGltf: !!gltf,
      hasClonedWater: !!clonedWater,
      gltfSceneChildren: gltf?.scene?.children?.length || 0,
      renderCount: renderCountRef.current,
    });

    if (!gltf) {
      console.log('[LakeModel] gltfがnullのためスキップ');
      return;
    }

    if (clonedWater) {
      console.log('[LakeModel] 既に水面クローン済みのためスキップ', {
        existingClone: {
          name: clonedWater.name,
          type: clonedWater.type,
          uuid: clonedWater.uuid,
        },
      });
      return;
    }

    console.log('[LakeModel] 水面オブジェクトを検索中...', {
      sceneChildren: gltf.scene.children.length,
      sceneChildrenNames: gltf.scene.children.map((c) => c.name),
    });
    let water = gltf.scene.getObjectByName('Water');

    // それでも見つからない場合は、シーンの2番目のオブジェクトを使用
    if (!water && gltf.scene.children.length > 1) {
      water = gltf.scene.children[1];
      console.log('[LakeModel] 水面オブジェクト（フォールバック）:', {
        water,
        name: water.name,
        type: water.type,
      });
    }

    if (water) {
      // 水面オブジェクトをクローンして独立したオブジェクトとして保持
      const cloned = water.clone();
      clonedWaterRef.current = cloned; // refにも保持（後方互換性のため）
      setClonedWater(cloned); // Reactの状態として設定

      // if (globalWaterDrainStartTime.value === null) {
      //   globalWaterDrainStartTime.value = Date.now();
      //   console.log('[LakeModel] ✅ アニメーション開始時間を設定しました');
      // }

      console.log('[LakeModel] ✅ 水面オブジェクトをクローンしました:', {
        clonedObject: cloned,
        name: cloned.name,
        type: cloned.type,
        uuid: cloned.uuid,
        renderCount: renderCountRef.current,
        waterDrainStartTime: globalWaterDrainStartTime.value || Date.now(),
      });
    } else {
      console.warn('[LakeModel] ❌ 水面オブジェクトが見つかりませんでした', {
        sceneChildren: gltf.scene.children.length,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf]); // gltfが変わったときだけ実行（clonedWaterは一度設定されたら変わらないため、依存配列に含めない）

  // 水面オブジェクトをシーンに直接追加・削除（primitiveコンポーネントの再マウントを回避）
  useEffect(() => {
    if (!clonedWater || !showWater || !isLoaded) {
      // 水面を削除
      if (waterGroupRef.current?.parent) {
        waterGroupRef.current.parent.remove(waterGroupRef.current);
        waterGroupRef.current = null;
        // console.log('[LakeModel] ✅ 水面をシーンから削除しました');
      }
      return;
    }

    // 水面用のGroupを作成（まだ存在しない場合）
    if (!waterGroupRef.current) {
      const waterGroup = new THREE.Group();
      waterGroup.name = 'WaterGroup';
      waterGroupRef.current = waterGroup;

      // clonedWaterをGroupに追加
      clonedWater.scale.set(stableWaterScale[0], stableWaterScale[1], stableWaterScale[2]);
      waterGroup.add(clonedWater);

      // Groupをシーンに追加
      scene.add(waterGroup);

      // console.log('[LakeModel] ✅ 水面をシーンに追加しました', {
      //   waterGroupUuid: waterGroup.uuid,
      //   clonedWaterUuid: clonedWater.uuid,
      // });
    } else {
      // 既存のGroupのスケールを更新
      waterGroupRef.current.scale.set(stableWaterScale[0], stableWaterScale[1], stableWaterScale[2]);
    }

    // クリーンアップ関数：コンポーネントがアンマウントされる際にシーンから削除
    return () => {
      if (waterGroupRef.current?.parent) {
        waterGroupRef.current.parent.remove(waterGroupRef.current);
        waterGroupRef.current = null;
        // console.log('[LakeModel] ✅ 水面をシーンから削除しました（クリーンアップ）');
      }
    };
  }, [clonedWater, showWater, isLoaded, stableWaterScale, scene]);

  // 地形のバウンディングボックスを出力（デバッグ用、useEffectで実行）
  // clonedTerrainは一度設定されたら変わらないため、依存配列に含めない（無限ループを防ぐ）
  // biome-ignore lint/correctness/useExhaustiveDependencies: clonedTerrainは一度設定されたら変わらないため、依存配列に含めない
  useEffect(() => {
    if (!clonedTerrain) return;

    // const terrainBox = new THREE.Box3().setFromObject(clonedTerrain);
    // const terrainCenter = terrainBox.getCenter(new THREE.Vector3());
    // const terrainSize = terrainBox.getSize(new THREE.Vector3());

    // console.log('=== 地形のバウンディングボックス（terrainScale適用前） ===');
    // console.log('最小値:', { x: terrainBox.min.x, y: terrainBox.min.y, z: terrainBox.min.z });
    // console.log('最大値:', { x: terrainBox.max.x, y: terrainBox.max.y, z: terrainBox.max.z });
    // console.log('中心点:', { x: terrainCenter.x, y: terrainCenter.y, z: terrainCenter.z });
    // console.log('サイズ:', { x: terrainSize.x, y: terrainSize.y, z: terrainSize.z });

    // terrainScale適用後の中心を計算
    // スケールは原点を中心に適用されるため、中心点もスケール倍される
    // const scale = terrainScale[0]; // x, y, z は同じ値と仮定
    // const terrainCenterScaled = {
    //   x: terrainCenter.x * scale,
    //   y: terrainCenter.y * scale,
    //   z: terrainCenter.z * scale,
    // };
    // console.log('terrainScale:', terrainScale);
    // console.log('terrainScale適用後の中心（推定）:', terrainCenterScaled);
    // console.log('=====================================');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableTerrainScale]); // clonedTerrainは一度設定されたら変わらないため、依存配列に含めない

  // アニメーション（水面の干上がり）
  useFrame(() => {
    // clonedWaterオブジェクトが存在する場合は、その位置を直接更新
    // これにより、primitiveコンポーネントが再マウントされても位置が保持される
    if (isLoaded && showWater && clonedWater) {
      // 初期位置を上に設定して、そこから下がるようにする
      // スケールに応じて初期位置を調整（スケールが大きくなっても相対的な位置を維持）
      // WATER_INITIAL_OFFSET（terrain-config.tsで設定）を基準に、スケールに応じて調整
      const initialWaterOffset = (WATER_INITIAL_OFFSET + waterLevelOffset) * TERRAIN_SCALE_FACTOR; // スケールとオフセットに応じて調整
      let waterY = initialWaterOffset; // 初期位置は上から

      if (globalWaterDrainStartTime.value) {
        const elapsed = (Date.now() - globalWaterDrainStartTime.value) / 1000; // 経過秒数
        const delay = 1.0; // レンダリング後1秒待機
        const animationDuration = 120.0; // アニメーション時間を120秒に延長（よりゆっくり）

        // 1秒待機してからアニメーション開始
        if (elapsed >= delay) {
          const animationElapsed = elapsed - delay; // アニメーション開始からの経過時間
          const drainProgress = Math.min(animationElapsed / animationDuration, 1.0); // 120秒で100%まで（完全に下がる）

          // イージング関数（easeOutCubic）
          const easedProgress = 1 - (1 - drainProgress) ** 3;

          // 地形の一番下が計算済みの場合は、そこから5m下を最終位置とする
          if (terrainBottomYRef.current !== null) {
            const targetWaterY = terrainBottomYRef.current - 5; // 地形の一番下から5m下（ワールド座標）
            const initialWaterY = waterPosition[1] + initialWaterOffset; // 初期位置（waterPosition + 2m上）
            // 初期位置から最終位置まで補間
            waterY =
              initialWaterY + (targetWaterY - initialWaterY) * easedProgress - waterPosition[1];

            // デバッグログ（10フレームに1回）
            if (Math.floor(Date.now() / 100) % 10 === 0) {
              console.log('[LakeModel] 水面アニメーション（地形基準）', {
                elapsed: elapsed.toFixed(2),
                drainProgress: drainProgress.toFixed(3),
                easedProgress: easedProgress.toFixed(3),
                terrainBottomY: terrainBottomYRef.current.toFixed(2),
                targetWaterY: targetWaterY.toFixed(2),
                initialWaterY: initialWaterY.toFixed(2),
                waterY: waterY.toFixed(2),
                waterPositionY: waterPosition[1].toFixed(2),
              });
            }
          } else {
            // 地形の一番下がまだ計算されていない場合は、固定の降下量を使用（フォールバック）
            const baseDrainHeight = -25;
            const scaledDrainHeight = baseDrainHeight * TERRAIN_SCALE_FACTOR; // スケールに応じて調整
            // 初期位置から下がる量を計算
            waterY = initialWaterOffset + scaledDrainHeight * easedProgress;

            // デバッグログ（10フレームに1回）
            if (Math.floor(Date.now() / 100) % 10 === 0) {
              console.log('[LakeModel] 水面アニメーション（フォールバック）', {
                elapsed: elapsed.toFixed(2),
                drainProgress: drainProgress.toFixed(3),
                easedProgress: easedProgress.toFixed(3),
                initialWaterOffset: initialWaterOffset.toFixed(2),
                scaledDrainHeight: scaledDrainHeight.toFixed(2),
                waterY: waterY.toFixed(2),
                terrainBottomYRef: terrainBottomYRef.current,
              });
            }
          }
        } else {
          // elapsed < delay の場合は初期位置を維持（待機中）
          waterY = initialWaterOffset;

          // デバッグログ（10フレームに1回）
          if (Math.floor(Date.now() / 100) % 10 === 0) {
            console.log('[LakeModel] 水面アニメーション（待機中）', {
              elapsed: elapsed.toFixed(2),
              delay,
              waterY: waterY.toFixed(2),
            });
          }
        }
      } else {
        // globalWaterDrainStartTimeが設定される前は初期位置を維持
        waterY = initialWaterOffset;

        // デバッグログ（10フレームに1回）
        if (Math.floor(Date.now() / 100) % 10 === 0) {
          console.log('[LakeModel] 水面アニメーション（開始前）', {
            waterDrainStartTime: globalWaterDrainStartTime.value,
            waterY: waterY.toFixed(2),
            terrainBottomYRef: terrainBottomYRef.current,
          });
        }
      }

      // 水面の位置（waterPositionを基準に干上がりを適用）
      const targetX = waterPosition[0];
      const targetY = waterPosition[1] + waterY;
      const targetZ = waterPosition[2];

      // 位置をグローバル変数に保存（再マウント時の復元用）
      globalWaterPosition.value = { x: targetX, y: targetY, z: targetZ };

      // clonedWaterオブジェクト自体の位置を直接更新（primitiveコンポーネントが再マウントされても位置が保持されるように）
      clonedWater.position.set(targetX, targetY, targetZ);
      // waterGroupRefが存在する場合は、その位置も更新（同期のため）
      if (waterGroupRef.current) {
        waterGroupRef.current.position.set(
          position[0] + targetX,
          position[1] + targetY,
          position[2] + targetZ
        );
        waterGroupRef.current.updateMatrixWorld(true);
      }
      // clonedWaterオブジェクトの位置を強制的に更新（updateMatrixWorldを呼び出して反映）
      clonedWater.updateMatrixWorld(true);

      // waterRefが存在する場合は、その位置も更新（同期のため）
      if (waterRef.current) {
        waterRef.current.position.set(targetX, targetY, targetZ);
        waterRef.current.updateMatrixWorld(true);
      }

      // デバッグログ（10フレームに1回）
      if (Math.floor(Date.now() / 100) % 10 === 0) {
        console.log('[LakeModel] 水面位置設定', {
          targetX: targetX.toFixed(2),
          targetY: targetY.toFixed(2),
          targetZ: targetZ.toFixed(2),
          waterY: waterY.toFixed(2),
          waterPosition: waterPosition,
          clonedWaterPosition: {
            x: clonedWater.position.x.toFixed(2),
            y: clonedWater.position.y.toFixed(2),
            z: clonedWater.position.z.toFixed(2),
          },
          waterRefPosition: waterRef.current?.position
            ? {
              x: waterRef.current.position.x.toFixed(2),
              y: waterRef.current.position.y.toFixed(2),
              z: waterRef.current.position.z.toFixed(2),
            }
            : null,
          globalWaterDrainStartTime: globalWaterDrainStartTime.value,
        });
      }

      // 水面のマテリアル効果を動的に調整
      clonedWater.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh && child.material) {
          const material = child.material as THREE.MeshStandardMaterial;

          // 干上がりに伴う透明度の変化
          if (globalWaterDrainStartTime.value) {
            const elapsed = (Date.now() - globalWaterDrainStartTime.value) / 1000;
            const delay = 1.0; // レンダリング後1秒待機
            const animationDuration = 120.0; // アニメーション時間を120秒に延長

            if (elapsed >= delay) {
              const animationElapsed = elapsed - delay; // アニメーション開始からの経過時間
              const drainProgress = Math.min(animationElapsed / animationDuration, 1.0); // 60秒で100%まで
              const opacity = Math.max(0.4, 0.8 * (1 - drainProgress)); // 透明度を徐々に下げる（80%→40%）
              material.opacity = opacity;
              material.transparent = true;
            } else {
              // 待機中は透明度を80%に設定
              material.opacity = 0.8;
              material.transparent = true;
            }
          } else {
            // globalWaterDrainStartTimeが設定される前は透明度を80%に設定
            material.opacity = 0.8;
            material.transparent = true;
          }

          // 反射強度を固定値に設定
          if (material.metalness !== undefined) {
            material.metalness = 0.2;
          }

          // 粗さを固定値に設定
          if (material.roughness !== undefined) {
            material.roughness = 0.3;
          }

          // 色を固定値に設定
          if (material.color) {
            material.color.setHSL(0.5, 0.8, 0.6); // 青系の色
          }
        }
      });
    }
  });

  // ワイヤーフレーム表示の切り替えを反映
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

    applyWireframe(clonedTerrain);
    applyWireframe(clonedWater);
  }, [wireframe, clonedTerrain, clonedWater]);

  // 地形モデルと水面の実際の位置を確認するためのデバッグログ
  // 注意: useEffectは早期リターンの前に配置する必要がある（React Hooksのルール）
  useEffect(() => {
    if (terrainRef.current && waterRef.current && isLoaded) {
      // 少し遅延させて、地形と水面が完全に配置されるのを待つ
      const timer = setTimeout(() => {
        if (terrainRef.current && waterRef.current) {
          // 地形モデルの実際の位置を取得
          const terrainWorldPosition = new THREE.Vector3();
          terrainRef.current.getWorldPosition(terrainWorldPosition);

          // 地形のバウンディングボックスを取得（terrainScale適用後）
          const terrainBox = new THREE.Box3().setFromObject(terrainRef.current);
          const terrainCenter = terrainBox.getCenter(new THREE.Vector3());
          const terrainSize = terrainBox.getSize(new THREE.Vector3());

          // 地形の一番下のY座標を計算（ワールド座標）
          // terrainBox.min.yはローカル座標での最小値なので、ワールド座標に変換
          const terrainBottomLocal = new THREE.Vector3(0, terrainBox.min.y, 0);
          const terrainBottomWorld = new THREE.Vector3();
          terrainRef.current.localToWorld(terrainBottomLocal);
          terrainBottomYRef.current = terrainBottomWorld.y;

          console.log(
            '[LakeModel] 地形の一番下のY座標（ワールド座標）:',
            terrainBottomYRef.current
          );

          // 水面の実際の位置を取得
          const waterWorldPosition = new THREE.Vector3();
          waterRef.current.getWorldPosition(waterWorldPosition);

          // 水面のバウンディングボックスを取得（waterScale適用後）
          const waterBox = new THREE.Box3().setFromObject(waterRef.current);
          const waterCenter = waterBox.getCenter(new THREE.Vector3());
          const waterSize = waterBox.getSize(new THREE.Vector3());

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

          console.log('=== 水面の実際の位置（waterScale適用後） ===');
          console.log('waterPositionプロパティ:', waterPosition);
          console.log('水面のローカル位置:', {
            x: waterRef.current.position.x,
            y: waterRef.current.position.y,
            z: waterRef.current.position.z,
          });
          console.log('水面のワールド位置:', {
            x: waterWorldPosition.x,
            y: waterWorldPosition.y,
            z: waterWorldPosition.z,
          });
          console.log('水面のバウンディングボックス中心:', {
            x: waterCenter.x,
            y: waterCenter.y,
            z: waterCenter.z,
          });
          console.log('水面のサイズ:', {
            x: waterSize.x,
            y: waterSize.y,
            z: waterSize.z,
          });
          console.log('地形と水面の中心の差（X, Z方向）:', {
            x: waterCenter.x - terrainCenter.x,
            y: waterCenter.y - terrainCenter.y,
            z: waterCenter.z - terrainCenter.z,
          });
          console.log('=====================================');
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isLoaded, position, waterPosition]);

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

  // 地形レンダリング判定（即時実行関数を削除して直接JSXを返す）
  const shouldRenderTerrain = showTerrain && isLoaded && clonedTerrain;
  // console.log('[LakeModel] Render Check:', { shouldRenderTerrain, showTerrain, isLoaded, hasClonedTerrain: !!clonedTerrain });


  return (
    <group position={position} scale={scale} rotation={rotation} visible={visible}>
      {/* 地形の表示 */}
      {shouldRenderTerrain && clonedTerrain && (
        <primitive
          ref={(ref: THREE.Group | null) => {
            if (ref) {
              (terrainRef as React.MutableRefObject<THREE.Group | null>).current = ref;
            }
          }}
          object={clonedTerrain}
          scale={stableTerrainScale}
        />
      )}


      {/* 水面の表示はuseEffectでシーンに直接追加するため、ここでは何もレンダリングしない */}

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

const MemoizedLakeModel = memo(LakeModel);
export default MemoizedLakeModel;
