import type { DeviceOrientation, OrientationCallback } from '../../types/sensors';

export class OrientationService {
  private magneticDeclination = 7.3; // 東京の磁気偏角（西偏）
  private callbacks: OrientationCallback[] = [];
  private isTracking = false;
  private lastOrientation: DeviceOrientation | null = null;

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
    if (!this.isAvailable()) {
      throw new Error('Device orientation is not supported');
    }

    // 許可チェック
    const permission = await this.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Device orientation permission denied');
    }

    this.callbacks.push(callback);

    if (!this.isTracking) {
      this.isTracking = true;

      // iOS Safari では deviceorientationabsolute イベントを優先（コンパス基準）
      if ('ondeviceorientationabsolute' in window) {
        window.addEventListener('deviceorientationabsolute', this.handleOrientationEvent);
      } else {
        window.addEventListener('deviceorientation', this.handleOrientationEvent);
      }
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
      if ('ondeviceorientationabsolute' in window) {
        window.removeEventListener('deviceorientationabsolute', this.handleOrientationEvent);
      } else {
        window.removeEventListener('deviceorientation', this.handleOrientationEvent);
      }
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
    const orientation: DeviceOrientation = {
      alpha: event.alpha,
      beta: event.beta,
      gamma: event.gamma,
      webkitCompassHeading: (event as any).webkitCompassHeading,
      absolute: event.absolute || false,
      timestamp: Date.now(),
    };

    this.lastOrientation = orientation;

    // コールバック実行
    for (let i = 0; i < this.callbacks.length; i++) {
      try {
        this.callbacks[i](orientation);
      } catch (error) {
        console.error(`Orientation callback ${i + 1} failed:`, error);
      }
    }
  };

  // クリーンアップ
  public dispose(): void {
    this.stopTracking();
    this.callbacks.length = 0;
    this.lastOrientation = null;
  }
}
