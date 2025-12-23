import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * GLBファイルからテクスチャを抽出してData URLとして返す
 * @param glbUrl GLBファイルのURL
 * @returns テクスチャ画像のData URL (Promise)
 */
export async function extractTextureFromGLB(glbUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();

        loader.load(
            glbUrl,
            (gltf) => {
                let texture: THREE.Texture | null = null;

                // シーン内のMeshを探索してテクスチャを探す
                gltf.scene.traverse((child) => {
                    if (texture) return; // 最初に見つかったテクスチャを使用

                    if (child instanceof THREE.Mesh) {
                        const material = child.material;
                        if (Array.isArray(material)) {
                            // マルチマテリアルの場合
                            for (const mat of material) {
                                if (mat.map) {
                                    texture = mat.map;
                                    break;
                                }
                            }
                        } else {
                            // シングルマテリアルの場合
                            if (material.map) {
                                texture = material.map;
                            }
                        }
                    }
                });

                if (!texture) {
                    reject(new Error('Texture not found in GLB model'));
                    return;
                }

                // テクスチャから画像を抽出
                const image = (texture as THREE.Texture).image;
                if (!image) {
                    reject(new Error('Texture image not available'));
                    return;
                }

                // ImageBitmapやHTMLImageElementなどからCanvasに描画してDataURL化
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = image.width;
                    canvas.height = image.height;
                    const ctx = canvas.getContext('2d');

                    if (!ctx) {
                        reject(new Error('Failed to get canvas context'));
                        return;
                    }

                    // Y軸反転などの考慮が必要かもしれないが、まずはそのまま描画
                    // Three.jsのテクスチャはY軸が反転している場合があるが、地図オーバーレイ用には
                    // 元画像そのままで良い可能性が高い。必要に応じて scale(1, -1) 等を追加。
                    ctx.drawImage(image, 0, 0);

                    const dataUrl = canvas.toDataURL('image/png');
                    resolve(dataUrl);
                } catch (err) {
                    reject(err);
                }
            },
            undefined,
            (error) => {
                reject(error);
            }
        );
    });
}
