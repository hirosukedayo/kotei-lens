import { useThree, useFrame } from '@react-three/fiber';
import { useFBX } from '@react-three/drei';
import type React from 'react';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

interface WireframeModelProps {
    position?: [number, number, number];
    scale?: [number, number, number];
    rotation?: [number, number, number];
    visible?: boolean;
    followCamera?: boolean;
    yOffset?: number;
}

// Get base path dynamically
const getBasePath = () => {
    return import.meta.env.BASE_URL || '/';
};

export default function WireframeModel({
    position = [0, 0, 0],
    scale = [1, 1, 1],
    rotation = [0, 0, 0],
    visible = true,
    followCamera = false,
    yOffset = -20,
}: WireframeModelProps) {
    const basePath = getBasePath();
    const fbx = useFBX(`${basePath}models/Wireframe_test.fbx`);
    const groupRef = useRef<THREE.Group>(null);
    const { camera } = useThree();

    const { solid, wire } = useMemo(() => {
        // 1. ベースとなるクローンを作成し、センタリング
        const base = fbx.clone();
        const box = new THREE.Box3().setFromObject(base);
        const center = box.getCenter(new THREE.Vector3());
        base.position.set(-center.x, -center.y, -center.z);

        // 2. ソリッドモデル（面を表示、透過しない）
        const solidClone = base.clone();
        solidClone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                // 不透明なグレーのマテリアルを適用
                mesh.material = new THREE.MeshStandardMaterial({
                    color: 0xcccccc, // ライトグレー
                    roughness: 0.8,
                    side: THREE.DoubleSide,
                    polygonOffset: true,
                    polygonOffsetFactor: 1, // 少し奥に描画してZファイトを防ぐ
                    polygonOffsetUnits: 1,
                });
                mesh.castShadow = true;
                mesh.receiveShadow = true;
            }
        });

        // 3. ワイヤーフレームモデル（線を表示）
        const wireClone = base.clone();
        wireClone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                // 黒色のワイヤーフレームマテリアル
                mesh.material = new THREE.MeshBasicMaterial({
                    color: 0x000000,
                    wireframe: true,
                    side: THREE.DoubleSide,
                });
            }
        });

        return { solid: solidClone, wire: wireClone };
    }, [fbx]);

    useFrame(() => {
        if (followCamera && groupRef.current) {
            // カメラのX, Z位置に合わせて移動、Yはカメラ高さ + offset
            groupRef.current.position.set(
                camera.position.x,
                camera.position.y + yOffset,
                camera.position.z
            );
        }
    });

    return (
        <group ref={groupRef} position={position} scale={scale} rotation={rotation} visible={visible}>
            <primitive object={solid} />
            <primitive object={wire} />
        </group>
    );
}
