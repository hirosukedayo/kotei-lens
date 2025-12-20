// センサーサービスのシングルトン管理
import { LocationService } from './LocationService';
import { OrientationService } from './OrientationService';
import { MotionService } from './MotionService';

export class SensorManager {
  private static instance: SensorManager;

  private _locationService: LocationService;
  private _orientationService: OrientationService;
  private _motionService: MotionService;

  private constructor() {
    this._locationService = new LocationService();
    this._orientationService = new OrientationService();
    this._motionService = new MotionService();

    console.log('SensorManager singleton instance created');
  }

  public static getInstance(): SensorManager {
    if (!SensorManager.instance) {
      SensorManager.instance = new SensorManager();
    }
    return SensorManager.instance;
  }

  public get locationService(): LocationService {
    return this._locationService;
  }

  public get orientationService(): OrientationService {
    return this._orientationService;
  }

  public get motionService(): MotionService {
    return this._motionService;
  }

  // 全センサーの状態を取得
  public getStatus() {
    return {
      location: {
        available: this._locationService.isAvailable(),
        watching: this._locationService.getLastPosition() !== null,
        lastUpdate: this._locationService.getLastPosition()?.timestamp || null,
      },
      orientation: {
        available: this._orientationService.isAvailable(),
        tracking: this._orientationService.getLastOrientation() !== null,
        lastUpdate: this._orientationService.getLastOrientation()?.timestamp || null,
      },
      motion: {
        available: this._motionService.isAvailable(),
        tracking: false, // MotionServiceにgetLastMotionメソッドを追加する必要がある
        lastUpdate: null,
      },
    };
  }

  // 全センサーを停止
  public stopAll() {
    console.log('Stopping all sensors...');
    this._locationService.stopWatching();
    this._orientationService.stopTracking();
    this._motionService.stopTracking();
  }

  // クリーンアップ
  public dispose() {
    this.stopAll();
    this._locationService.dispose();
    this._orientationService.dispose();
    this._motionService.dispose();
  }
}

// シングルトンインスタンスを取得するヘルパー関数
export const getSensorManager = () => SensorManager.getInstance();
