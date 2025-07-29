import { 
  GPSOptions, 
  GPSPosition, 
  GPSError, 
  GPSCallback, 
  GPSErrorCallback 
} from '../../types/sensors';

export class LocationService {
  private options: GPSOptions = {
    enableHighAccuracy: true,    // 高精度モード
    timeout: 10000,              // タイムアウト: 10秒
    maximumAge: 5000            // キャッシュ有効期限: 5秒
  };

  private watchId: number | null = null;
  private callbacks: GPSCallback[] = [];
  private errorCallbacks: GPSErrorCallback[] = [];
  private lastPosition: GPSPosition | null = null;

  // 小河内ダム周辺の座標範囲（テスト用）
  private readonly OKUTAMA_BOUNDS = {
    north: 35.795,
    south: 35.785,
    east: 139.055,
    west: 139.045
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
    if (!('permissions' in navigator)) {
      return 'prompt';
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return result.state;
    } catch {
      return 'prompt';
    }
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
  public startWatching(
    callback: GPSCallback,
    errorCallback?: GPSErrorCallback
  ): void {
    if (!this.isAvailable()) {
      throw new Error('Geolocation is not supported');
    }

    this.callbacks.push(callback);
    if (errorCallback) {
      this.errorCallbacks.push(errorCallback);
    }

    // 既に監視中でない場合のみ開始
    if (this.watchId === null) {
      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          const gpsPosition = this.convertPosition(position);
          this.lastPosition = gpsPosition;
          this.callbacks.forEach(cb => cb(gpsPosition));
        },
        (error) => {
          const gpsError = this.convertError(error);
          this.errorCallbacks.forEach(cb => cb(gpsError));
        },
        this.options
      );
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
      latitude: 35.789472,  // 小河内ダム堤体中心
      longitude: 139.048889,
      altitude: 530,        // 水面標高
      accuracy: 5,
      timestamp: Date.now()
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
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
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
      timestamp: position.timestamp
    };
  }

  private convertError(error: GeolocationPositionError): GPSError {
    return {
      code: error.code,
      message: error.message,
      timestamp: Date.now()
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