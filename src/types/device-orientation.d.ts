// Device Orientation Event型定義の拡張
interface Window {
  DeviceOrientationEvent: {
    new(): DeviceOrientationEvent;
    requestPermission?: () => Promise<'granted' | 'denied'>;
  };
  DeviceMotionEvent: {
    new(): DeviceMotionEvent;
    requestPermission?: () => Promise<'granted' | 'denied'>;
  };
  ondeviceorientationabsolute?: ((this: Window, ev: DeviceOrientationEvent) => any) | null;
}