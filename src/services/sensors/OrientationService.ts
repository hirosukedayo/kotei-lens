import type { DeviceOrientation, OrientationCallback } from '../../types/sensors';

export class OrientationService {
  private magneticDeclination = 7.3; // 東京の磁気偏角（西偏）
  private callbacks: OrientationCallback[] = [];
  private isTracking = false;
  private lastOrientation: DeviceOrientation | null = null;

  // 平滑化用のバッファ
  private orientationBuffer: DeviceOrientation[] = [];
  private readonly BUFFER_SIZE = 3;

  constructor(customDeclination?: number) {
    if (customDeclination !== undefined) {
      this.magneticDeclination = customDeclination;
    }
  }

  // デバイス方位センサー対応チェック
  public isAvailable(): boolean {
    return 'DeviceOrientationEvent' in window;
  }

  // iOS 13+ での許可要求
  public async requestPermission(): Promise<PermissionState> {
    // iOS 13+ では許可が必要
    if (
      typeof window.DeviceOrientationEvent !== 'undefined' &&
      typeof window.DeviceOrientationEvent.requestPermission === 'function'
    ) {
      try {
        const permission = await window.DeviceOrientationEvent.requestPermission();
        console.log('DeviceOrientation permission result:', permission);
        return permission === 'granted' ? 'granted' : 'denied';
      } catch (error) {
        console.error('Device orientation permission request failed:', error);
        return 'denied';
      }
    }

    // その他のブラウザでは自動的に許可
    return 'granted';
  }

  // 方位追跡開始
  public async startTracking(callback: OrientationCallback): Promise<void> {
    console.log('OrientationService.startTracking called, current state:', {
      isAvailable: this.isAvailable(),
      isTracking: this.isTracking,
      callbackCount: this.callbacks.length
    });

    if (!this.isAvailable()) {
      throw new Error('Device orientation is not supported');
    }

    // 許可チェック
    const permission = await this.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Device orientation permission denied');
    }

    this.callbacks.push(callback);
    console.log('Orientation callback added, total callbacks:', this.callbacks.length);

    if (!this.isTracking) {
      this.isTracking = true;

      // iOS Safari では deviceorientationabsolute イベントを優先（コンパス基準）
      if ('ondeviceorientationabsolute' in window) {
        console.log('Using deviceorientationabsolute event');
        window.addEventListener('deviceorientationabsolute', this.handleOrientationEvent);
      } else {
        console.log('Using deviceorientation event');
        window.addEventListener('deviceorientation', this.handleOrientationEvent);
      }
      
      console.log('Orientation event listener added');
    } else {
      console.log('Orientation tracking already active');
    }
  }

  // 方位追跡停止
  public stopTracking(callback?: OrientationCallback): void {
    if (callback) {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    } else {
      this.callbacks.length = 0;
    }

    if (this.callbacks.length === 0 && this.isTracking) {
      this.isTracking = false;
      // 使用していたイベントタイプに応じて削除
      if ('ondeviceorientationabsolute' in window) {
        window.removeEventListener('deviceorientationabsolute', this.handleOrientationEvent);
      } else {
        window.removeEventListener('deviceorientation', this.handleOrientationEvent);
      }
      this.orientationBuffer.length = 0;
    }
  }

  // 最後の方位データ取得
  public getLastOrientation(): DeviceOrientation | null {
    return this.lastOrientation;
  }

  // コンパス方位を取得（北を0度とする）
  public getCompassHeading(orientation: DeviceOrientation): number | null {
    if (orientation.alpha === null) return null;

    // 磁気偏角補正を適用
    let heading = orientation.alpha + this.magneticDeclination;

    // 0-360度の範囲に正規化
    if (heading < 0) heading += 360;
    if (heading >= 360) heading -= 360;

    return heading;
  }

  // 方位を基準とした相対角度計算
  public getRelativeAngle(orientation: DeviceOrientation, targetHeading: number): number | null {
    const currentHeading = this.getCompassHeading(orientation);
    if (currentHeading === null) return null;

    let relativeAngle = targetHeading - currentHeading;

    // -180から180度の範囲に正規化
    while (relativeAngle > 180) relativeAngle -= 360;
    while (relativeAngle < -180) relativeAngle += 360;

    return relativeAngle;
  }

  // デバイスが平らかどうかチェック
  public isDeviceFlat(orientation: DeviceOrientation, threshold = 15): boolean {
    if (orientation.beta === null || orientation.gamma === null) return false;

    return Math.abs(orientation.beta) < threshold && Math.abs(orientation.gamma) < threshold;
  }

  // デバイスが縦向きかどうかチェック
  public isDevicePortrait(orientation: DeviceOrientation): boolean {
    if (orientation.gamma === null) return true;

    return Math.abs(orientation.gamma) < 45;
  }

  // 方位変化の検出
  public hasSignificantChange(
    current: DeviceOrientation,
    previous: DeviceOrientation,
    threshold = 5
  ): boolean {
    if (current.alpha === null || previous.alpha === null) return false;

    const alphaDiff = Math.abs(current.alpha - previous.alpha);
    const betaDiff = Math.abs((current.beta || 0) - (previous.beta || 0));
    const gammaDiff = Math.abs((current.gamma || 0) - (previous.gamma || 0));

    return alphaDiff > threshold || betaDiff > threshold || gammaDiff > threshold;
  }

  // 磁気偏角設定
  public setMagneticDeclination(declination: number): void {
    this.magneticDeclination = declination;
  }

  // プライベートメソッド
  private handleOrientationEvent = (event: DeviceOrientationEvent): void => {
    console.log('Orientation event received:', {
      alpha: event.alpha,
      beta: event.beta, 
      gamma: event.gamma,
      absolute: event.absolute,
      callbackCount: this.callbacks.length
    });

    const orientation: DeviceOrientation = {
      alpha: event.alpha,
      beta: event.beta,
      gamma: event.gamma,
      absolute: event.absolute || false,
      timestamp: Date.now(),
    };

    // 平滑化処理
    const smoothedOrientation = this.smoothOrientation(orientation);
    this.lastOrientation = smoothedOrientation;

    console.log('Executing orientation callbacks:', this.callbacks.length);
    // コールバック実行
    for (let i = 0; i < this.callbacks.length; i++) {
      console.log(`Executing orientation callback ${i + 1}/${this.callbacks.length}`);
      try {
        this.callbacks[i](smoothedOrientation);
        console.log(`Orientation callback ${i + 1} executed successfully`);
      } catch (error) {
        console.error(`Orientation callback ${i + 1} failed:`, error);
      }
    }
  };

  // 平滑化処理（ノイズ除去）
  private smoothOrientation(orientation: DeviceOrientation): DeviceOrientation {
    this.orientationBuffer.push(orientation);

    if (this.orientationBuffer.length > this.BUFFER_SIZE) {
      this.orientationBuffer.shift();
    }

    if (this.orientationBuffer.length === 1) {
      return orientation;
    }

    // 移動平均を計算
    const averages = this.orientationBuffer.reduce(
      (acc, curr) => ({
        alpha: (acc.alpha || 0) + (curr.alpha || 0),
        beta: (acc.beta || 0) + (curr.beta || 0),
        gamma: (acc.gamma || 0) + (curr.gamma || 0),
      }),
      { alpha: 0, beta: 0, gamma: 0 }
    );

    const count = this.orientationBuffer.length;

    return {
      alpha: orientation.alpha !== null ? averages.alpha / count : null,
      beta: orientation.beta !== null ? averages.beta / count : null,
      gamma: orientation.gamma !== null ? averages.gamma / count : null,
      absolute: orientation.absolute,
      timestamp: orientation.timestamp,
    };
  }

  // クリーンアップ
  public dispose(): void {
    this.stopTracking();
    this.callbacks.length = 0;
    this.orientationBuffer.length = 0;
    this.lastOrientation = null;
  }
}
