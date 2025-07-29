// WebGPUとWebGLの対応状況を検出するユーティリティ

export interface WebGLSupport {
  webgl: boolean;
  webgl2: boolean;
  webgpu: boolean;
}

export async function detectWebGLSupport(): Promise<WebGLSupport> {
  const canvas = document.createElement('canvas');
  
  // WebGL 1.0 チェック
  const webglContext = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  const webgl = !!webglContext;
  
  // WebGL 2.0 チェック
  const webgl2Context = canvas.getContext('webgl2');
  const webgl2 = !!webgl2Context;
  
  // WebGPU チェック
  let webgpu = false;
  if ('gpu' in navigator) {
    try {
      const adapter = await navigator.gpu?.requestAdapter();
      webgpu = !!adapter;
    } catch (error) {
      console.warn('WebGPU not available:', error);
      webgpu = false;
    }
  }
  
  // クリーンアップ
  webglContext?.getExtension('WEBGL_lose_context')?.loseContext();
  webgl2Context?.getExtension('WEBGL_lose_context')?.loseContext();
  canvas.remove();
  
  return { webgl, webgl2, webgpu };
}

export function getRecommendedRenderer(support: WebGLSupport): 'webgpu' | 'webgl2' | 'webgl' | 'none' {
  if (support.webgpu) return 'webgpu';
  if (support.webgl2) return 'webgl2';
  if (support.webgl) return 'webgl';
  return 'none';
}

export function getRendererConfig(renderer: string) {
  switch (renderer) {
    case 'webgpu':
      return {
        powerPreference: 'high-performance' as const,
        antialias: true,
        alpha: false,
        stencil: false,
      };
    case 'webgl2':
      return {
        powerPreference: 'high-performance' as const,
        antialias: true,
        alpha: false,
        stencil: false,
        depth: true,
      };
    case 'webgl':
      return {
        powerPreference: 'default' as const,
        antialias: false, // パフォーマンス優先
        alpha: false,
        stencil: false,
        depth: true,
      };
    default:
      return {
        powerPreference: 'default' as const,
        antialias: false,
      };
  }
}