import { DeviceMotion, MotionCallback } from '../../types/sensors';

export class MotionService {
  private callbacks: MotionCallback[] = [];
  private isTracking = false;
  private lastMotion: DeviceMotion | null = null;

  // 歩行検知用パラメーター
  private walkingThreshold = 2.5; // 歩行検知の閾値 (m/s²)
  private shakeThreshold = 15.0;   // シェイク検知の閾値 (m/s²)

  // 平滑化用バッファ
  private motionBuffer: DeviceMotion[] = [];
  private readonly BUFFER_SIZE = 5;

  // 歩行検知用
  private stepCount = 0;
  private lastStepTime = 0;
  private isWalking = false;

  constructor() {
    // 初期化
  }

  // デバイスモーションセンサー対応チェック
  public isAvailable(): boolean {
    return 'DeviceMotionEvent' in window;
  }

  // iOS 13+ での許可要求
  public async requestPermission(): Promise<PermissionState> {
    // iOS 13+ では許可が必要
    if (typeof window.DeviceMotionEvent !== 'undefined' && 
        typeof window.DeviceMotionEvent.requestPermission === 'function') {
      try {
        const permission = await window.DeviceMotionEvent.requestPermission();
        console.log('DeviceMotion permission result:', permission);
        return permission === 'granted' ? 'granted' : 'denied';
      } catch (error) {
        console.error('Device motion permission request failed:', error);
        return 'denied';
      }
    }
    
    // その他のブラウザでは自動的に許可
    return 'granted';
  }

  // モーション追跡開始
  public async startTracking(callback: MotionCallback): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Device motion is not supported');
    }

    // 許可チェック
    const permission = await this.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Device motion permission denied');
    }

    this.callbacks.push(callback);

    if (!this.isTracking) {
      this.isTracking = true;
      window.addEventListener('devicemotion', this.handleMotionEvent);
    }
  }

  // モーション追跡停止
  public stopTracking(callback?: MotionCallback): void {
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
      window.removeEventListener('devicemotion', this.handleMotionEvent);
      this.motionBuffer.length = 0;
      this.resetWalkingState();
    }
  }

  // 最後のモーションデータ取得
  public getLastMotion(): DeviceMotion | null {
    return this.lastMotion;
  }

  // 歩行検知
  public detectWalking(motion: DeviceMotion): boolean {
    const { x, y, z } = motion.accelerationIncludingGravity;
    if (x === null || y === null || z === null) return false;
    
    // 加速度の大きさ計算
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    const gravityFiltered = Math.abs(magnitude - 9.8); // 重力を除去
    
    const now = Date.now();
    const timeSinceLastStep = now - this.lastStepTime;
    
    // 一定時間間隔での振動検知（歩行パターン）
    if (gravityFiltered > this.walkingThreshold && timeSinceLastStep > 300) {
      this.stepCount++;
      this.lastStepTime = now;
      this.isWalking = true;
      
      // 3秒間歩行が検知されなければ停止とみなす
      setTimeout(() => {
        if (Date.now() - this.lastStepTime > 3000) {
          this.isWalking = false;
        }
      }, 3000);
      
      return true;
    }
    
    return this.isWalking && timeSinceLastStep < 3000;
  }

  // シェイク検知
  public detectShake(motion: DeviceMotion): boolean {
    const { x, y, z } = motion.accelerationIncludingGravity;
    if (x === null || y === null || z === null) return false;
    
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    return magnitude > this.shakeThreshold;
  }

  // デバイスの向き検知（加速度センサーベース）
  public getDeviceOrientation(motion: DeviceMotion): 'portrait' | 'landscape-left' | 'landscape-right' | 'portrait-upside-down' | 'unknown' {
    const { x, y } = motion.accelerationIncludingGravity;
    if (x === null || y === null) return 'unknown';
    
    const angle = Math.atan2(x, y) * (180 / Math.PI);
    
    if (angle >= -45 && angle < 45) return 'portrait';
    if (angle >= 45 && angle < 135) return 'landscape-left';
    if (angle >= 135 || angle < -135) return 'portrait-upside-down';
    if (angle >= -135 && angle < -45) return 'landscape-right';
    
    return 'unknown';
  }

  // 静止状態検知
  public isStationary(motion: DeviceMotion, threshold = 0.5): boolean {
    const { x, y, z } = motion.acceleration;
    if (x === null || y === null || z === null) return true;
    
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    return magnitude < threshold;
  }

  // 加速度の変化率計算
  public getAccelerationChange(current: DeviceMotion, previous: DeviceMotion): number | null {
    const curr = current.accelerationIncludingGravity;
    const prev = previous.accelerationIncludingGravity;
    
    if (!curr.x || !curr.y || !curr.z || !prev.x || !prev.y || !prev.z) return null;
    
    const currentMag = Math.sqrt(curr.x * curr.x + curr.y * curr.y + curr.z * curr.z);
    const prevMag = Math.sqrt(prev.x * prev.x + prev.y * prev.y + prev.z * prev.z);
    
    return Math.abs(currentMag - prevMag);
  }

  // 歩数カウンター取得
  public getStepCount(): number {
    return this.stepCount;
  }

  // 歩数カウンターリセット
  public resetStepCount(): void {
    this.stepCount = 0;
  }

  // 歩行状態取得
  public isCurrentlyWalking(): boolean {
    return this.isWalking;
  }

  // 閾値設定
  public setWalkingThreshold(threshold: number): void {
    this.walkingThreshold = threshold;
  }

  public setShakeThreshold(threshold: number): void {
    this.shakeThreshold = threshold;
  }

  // プライベートメソッド
  private handleMotionEvent = (event: DeviceMotionEvent): void => {
    const motion: DeviceMotion = {
      acceleration: {
        x: event.acceleration?.x || null,
        y: event.acceleration?.y || null,
        z: event.acceleration?.z || null,
      },
      accelerationIncludingGravity: {
        x: event.accelerationIncludingGravity?.x || null,
        y: event.accelerationIncludingGravity?.y || null,
        z: event.accelerationIncludingGravity?.z || null,
      },
      rotationRate: {
        alpha: event.rotationRate?.alpha || null,
        beta: event.rotationRate?.beta || null,
        gamma: event.rotationRate?.gamma || null,
      },
      interval: event.interval,
      timestamp: Date.now()
    };

    // 平滑化処理
    const smoothedMotion = this.smoothMotion(motion);
    this.lastMotion = smoothedMotion;

    // コールバック実行
    this.callbacks.forEach(callback => callback(smoothedMotion));
  };

  // 平滑化処理（ノイズ除去）
  private smoothMotion(motion: DeviceMotion): DeviceMotion {
    this.motionBuffer.push(motion);
    
    if (this.motionBuffer.length > this.BUFFER_SIZE) {
      this.motionBuffer.shift();
    }

    if (this.motionBuffer.length === 1) {
      return motion;
    }

    // 移動平均を計算
    const count = this.motionBuffer.length;
    const averages = this.motionBuffer.reduce(
      (acc, curr) => ({
        acceleration: {
          x: (acc.acceleration.x || 0) + (curr.acceleration.x || 0),
          y: (acc.acceleration.y || 0) + (curr.acceleration.y || 0),
          z: (acc.acceleration.z || 0) + (curr.acceleration.z || 0),
        },
        accelerationIncludingGravity: {
          x: (acc.accelerationIncludingGravity.x || 0) + (curr.accelerationIncludingGravity.x || 0),
          y: (acc.accelerationIncludingGravity.y || 0) + (curr.accelerationIncludingGravity.y || 0),
          z: (acc.accelerationIncludingGravity.z || 0) + (curr.accelerationIncludingGravity.z || 0),
        },
        rotationRate: {
          alpha: (acc.rotationRate.alpha || 0) + (curr.rotationRate.alpha || 0),
          beta: (acc.rotationRate.beta || 0) + (curr.rotationRate.beta || 0),
          gamma: (acc.rotationRate.gamma || 0) + (curr.rotationRate.gamma || 0),
        },
      }),
      {
        acceleration: { x: 0, y: 0, z: 0 },
        accelerationIncludingGravity: { x: 0, y: 0, z: 0 },
        rotationRate: { alpha: 0, beta: 0, gamma: 0 },
      }
    );

    return {
      acceleration: {
        x: motion.acceleration.x !== null ? averages.acceleration.x / count : null,
        y: motion.acceleration.y !== null ? averages.acceleration.y / count : null,
        z: motion.acceleration.z !== null ? averages.acceleration.z / count : null,
      },
      accelerationIncludingGravity: {
        x: motion.accelerationIncludingGravity.x !== null ? averages.accelerationIncludingGravity.x / count : null,
        y: motion.accelerationIncludingGravity.y !== null ? averages.accelerationIncludingGravity.y / count : null,
        z: motion.accelerationIncludingGravity.z !== null ? averages.accelerationIncludingGravity.z / count : null,
      },
      rotationRate: {
        alpha: motion.rotationRate.alpha !== null ? averages.rotationRate.alpha / count : null,
        beta: motion.rotationRate.beta !== null ? averages.rotationRate.beta / count : null,
        gamma: motion.rotationRate.gamma !== null ? averages.rotationRate.gamma / count : null,
      },
      interval: motion.interval,
      timestamp: motion.timestamp
    };
  }

  private resetWalkingState(): void {
    this.isWalking = false;
    this.lastStepTime = 0;
  }

  // クリーンアップ
  public dispose(): void {
    this.stopTracking();
    this.callbacks.length = 0;
    this.motionBuffer.length = 0;
    this.lastMotion = null;
    this.resetWalkingState();
    this.stepCount = 0;
  }
}