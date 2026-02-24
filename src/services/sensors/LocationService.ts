import type {
  GPSCallback,
  GPSError,
  GPSErrorCallback,
  GPSOptions,
  GPSPosition,
} from '../../types/sensors';

export class LocationService {
  private options: GPSOptions = {
    enableHighAccuracy: true, // 高精度モード
    timeout: 30000, // タイムアウト: 30秒（iPhoneでは時間がかかることがある）
    maximumAge: 60000, // キャッシュ有効期限: 60秒
  };

  private watchId: number | null = null;
  private statusCheckTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private callbacks: GPSCallback[] = [];
  private errorCallbacks: GPSErrorCallback[] = [];
  private lastPosition: GPSPosition | null = null;

  // 奥多摩湖周辺の座標範囲（湖全体＋周辺道路をカバー）
  private readonly OKUTAMA_BOUNDS = {
    north: 35.83,
    south: 35.73,
    east: 139.07,
    west: 138.91,
  };

  constructor(customOptions?: Partial<GPSOptions>) {
    if (customOptions) {
      this.options = { ...this.options, ...customOptions };
    }
  }

  // GPS対応チェック
  public isAvailable(): boolean {
    return 'geolocation' in navigator;
  }

  // 権限状態チェック
  public async checkPermission(): Promise<PermissionState> {
    // Permissions API が使える場合（Chrome, Firefox等）
    if ('permissions' in navigator) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        return result.state;
      } catch {
        // query失敗時はフォールバック
      }
    }

    // iOS Safari等、Permissions API非対応の場合:
    // 実際にGPS取得を試行して許可済みか判定する
    if (!this.isAvailable()) {
      return 'denied';
    }

    return new Promise<PermissionState>((resolve) => {
      const timeoutId = setTimeout(() => {
        // タイムアウト＝未許可の可能性が高い
        resolve('prompt');
      }, 3000);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId);
          // 成功＝既に許可済み。ついでに位置をキャッシュ
          this.lastPosition = this.convertPosition(position);
          resolve('granted');
        },
        (error) => {
          clearTimeout(timeoutId);
          if (error.code === error.PERMISSION_DENIED) {
            resolve('denied');
          } else {
            // POSITION_UNAVAILABLE や TIMEOUT はGPS自体の問題であり、
            // 許可はされている可能性がある
            resolve('granted');
          }
        },
        { timeout: 3000, maximumAge: 60000 },
      );
    });
  }

  // 単発位置取得
  public async getCurrentPosition(): Promise<GPSPosition> {
    if (!this.isAvailable()) {
      throw new Error('Geolocation is not supported');
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const gpsPosition = this.convertPosition(position);
          this.lastPosition = gpsPosition;
          resolve(gpsPosition);
        },
        (error) => {
          const gpsError = this.convertError(error);
          reject(gpsError);
        },
        this.options
      );
    });
  }

  // 継続的位置監視開始
  public startWatching(callback: GPSCallback, errorCallback?: GPSErrorCallback): void {
    console.log('LocationService.startWatching called, current state:', {
      isAvailable: this.isAvailable(),
      watchId: this.watchId,
      callbackCount: this.callbacks.length,
    });

    if (!this.isAvailable()) {
      throw new Error('Geolocation is not supported');
    }

    this.callbacks.push(callback);
    if (errorCallback) {
      this.errorCallbacks.push(errorCallback);
    }

    console.log('GPS callbacks added, total:', this.callbacks.length);

    // 既に監視中でない場合のみ開始
    if (this.watchId === null) {
      console.log('Starting GPS watchPosition with options:', this.options);
      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          const gpsPosition = this.convertPosition(position);
          this.lastPosition = gpsPosition;

          for (let i = 0; i < this.callbacks.length; i++) {
            try {
              this.callbacks[i](gpsPosition);
            } catch (error) {
              console.error(`GPS callback ${i + 1} failed:`, error);
            }
          }
        },
        (error) => {
          console.error('GPS error received:', error);
          const gpsError = this.convertError(error);
          for (const cb of this.errorCallbacks) {
            cb(gpsError);
          }
        },
        this.options
      );
      console.log('GPS watchPosition started with ID:', this.watchId);

      // 既存のチェックタイマーをクリア
      if (this.statusCheckTimeoutId !== null) {
        clearTimeout(this.statusCheckTimeoutId);
      }
      // 10秒後にGPS受信状況をチェック
      this.statusCheckTimeoutId = setTimeout(() => {
        console.log('10秒後のGPS状況:', {
          watchId: this.watchId,
          callbackCount: this.callbacks.length,
          lastPosition: this.lastPosition,
          hasReceivedData: this.lastPosition !== null,
        });

        if (this.lastPosition === null) {
          console.warn(
            'GPSからのデータを受信していません。位置の許可が適切に設定されているか確認してください。'
          );
        }
        this.statusCheckTimeoutId = null;
      }, 10000);
    } else {
      console.log('GPS watching already active with ID:', this.watchId);
    }
  }

  // 位置監視停止
  public stopWatching(callback?: GPSCallback): void {
    if (callback) {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    } else {
      this.callbacks.length = 0;
      this.errorCallbacks.length = 0;
    }

    // コールバックがすべてなくなったら監視停止
    if (this.callbacks.length === 0 && this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      if (this.statusCheckTimeoutId !== null) {
        clearTimeout(this.statusCheckTimeoutId);
        this.statusCheckTimeoutId = null;
      }
    }
  }

  // 最後の位置情報取得
  public getLastPosition(): GPSPosition | null {
    return this.lastPosition;
  }

  // 小河内ダム周辺エリア内かチェック
  public isInOkutamaArea(position: GPSPosition): boolean {
    return (
      position.latitude >= this.OKUTAMA_BOUNDS.south &&
      position.latitude <= this.OKUTAMA_BOUNDS.north &&
      position.longitude >= this.OKUTAMA_BOUNDS.west &&
      position.longitude <= this.OKUTAMA_BOUNDS.east
    );
  }

  // テスト用：小河内ダム中心座標を返す
  public getMockPosition(): GPSPosition {
    return {
      latitude: 35.789472, // 小河内ダム堤体中心
      longitude: 139.048889,
      altitude: 530, // 水面標高
      accuracy: 5,
      heading: 0,
      speed: 0,
      timestamp: Date.now(),
    };
  }

  // 距離計算（メートル）
  public calculateDistance(pos1: GPSPosition, pos2: GPSPosition): number {
    const R = 6371000; // 地球の半径（メートル）
    const dLat = this.toRadians(pos2.latitude - pos1.latitude);
    const dLon = this.toRadians(pos2.longitude - pos1.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(pos1.latitude)) *
      Math.cos(this.toRadians(pos2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  // プライベートメソッド
  private convertPosition(position: GeolocationPosition): GPSPosition {
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      altitude: position.coords.altitude,
      accuracy: position.coords.accuracy,
      heading: position.coords.heading,
      speed: position.coords.speed,
      timestamp: position.timestamp,
    };
  }

  private convertError(error: GeolocationPositionError): GPSError {
    return {
      code: error.code,
      message: error.message,
      timestamp: Date.now(),
    };
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // クリーンアップ
  public dispose(): void {
    this.stopWatching();
    this.callbacks.length = 0;
    this.errorCallbacks.length = 0;
    this.lastPosition = null;
  }
}
