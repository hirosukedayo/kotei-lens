import type { DeviceOrientation, OrientationCallback } from '../../types/sensors';

export class OrientationService {
  private magneticDeclination = 7.3; // 東京の磁気偏角（西偏）
  private callbacks: OrientationCallback[] = [];
  private isTracking = false;
  private lastOrientation: DeviceOrientation | null = null;
  // 権限状態のキャッシュ
  private permissionState: PermissionState | 'unknown' = 'unknown';

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
    // 既に許可済みの場合はキャッシュを返す
    if (this.permissionState === 'granted') {
      return 'granted';
    }

    // iOS 13+ では許可が必要
    if (
      typeof window.DeviceOrientationEvent !== 'undefined' &&
      typeof window.DeviceOrientationEvent.requestPermission === 'function'
    ) {
      try {
        const permission = await window.DeviceOrientationEvent.requestPermission();
        console.log('DeviceOrientation permission result:', permission);
        this.permissionState = permission; // 結果をキャッシュ
        return permission === 'granted' ? 'granted' : 'denied';
      } catch (error) {
        console.error('Device orientation permission request failed:', error);
        this.permissionState = 'denied';
        return 'denied';
      }
    }

    // その他のブラウザでは自動的に許可
    this.permissionState = 'granted';
    return 'granted';
  }

  // 現在の権限状態を取得
  public getPermissionState(): PermissionState | 'unknown' {
    return this.permissionState;
  }

  // 方位追跡開始
  public async startTracking(callback: OrientationCallback): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Device orientation is not supported');
    }

    // 既に許可済みならリクエストをスキップ、そうでなければリクエスト
    // 注意: requestPermissionはユーザー操作が必要な場合があるため、
    // 未許可状態でここを呼ぶと失敗する可能性がある (特にiOSの自動開始時)
    if (this.permissionState !== 'granted') {
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Device orientation permission denied');
      }
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
    // iOS: webkitCompassHeading を優先（時計回り、磁北基準）
    if (typeof orientation.webkitCompassHeading === 'number' && orientation.webkitCompassHeading >= 0) {
      // 磁気偏角補正を適用（西偏の場合はマイナス値として扱われることが多いが、ここでは値を加算している＝西偏分だけ時計回りにずらす＝真北は磁北より東？）
      // 日本（西偏）の場合：磁北は真北より西にある。
      // コンパスが磁北(0)を指しているとき、真北は東(+7度)にある。
      // なので、真北方位 = 磁北方位 + 7度。
      // つまり加算で正しい。
      let heading = orientation.webkitCompassHeading + this.magneticDeclination;

      // 0-360度の範囲に正規化
      if (heading < 0) heading += 360;
      if (heading >= 360) heading -= 360;

      return heading;
    }

    if (orientation.alpha === null) return null;

    // Android / PC: absolute alpha など
    // W3C仕様ではalphaは反時計回りだが、実装依存が大きい
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
    // permissionStateは保持しても良いが、インスタンス破棄ならリセットされる
  }
}

