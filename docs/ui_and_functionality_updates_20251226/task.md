# Debugging 3D Transition & Sensor Modal

## Issues
- [ ] **Fix Sensor Modal z-index**: Ensure the modal appears above all other map UI elements.
- [ ] **Fix 3D Transition Logic**: Address the issue where 3D mode doesn't start even after permissions are granted.
    - Check why `transitionTo3D` might not be called.
    - Validate `permissionState` updates in `OkutamaMap2D`.
- [ ] **Improve Permission Handling**: Even if "Start" is clicked, if permissions are partially granted or denied but the user wants to force start (on non-iOS), allow it? Or clarify the flow.

## Plan
1.  **Z-Index**: `SensorPermissionRequest.tsx` has `zIndex: 9999`. `OkutamaMap2D` has elements with `zIndex: 10000`. The modal needs to be higher (e.g., 11001).
2.  **3D Transition**: `handleRequest3DWithPermission` in `OkutamaMap2D.tsx` relies on `sensorManager.orientationService.getPermissionState`.
    - If `unknown`, it shows modal.
    - Modal calls `onPermissionsGranted`.
    - `onPermissionsGranted` callback:
        - `setShowPermissionModal(false)`
        - Checks `isMobile`.
        - If mobile -> `setIsCalibrating(true)`.
        - If not -> `transitionTo3D()`.
    - **Issue**: If `isMobile` is true, it sets `isCalibrating`. But if the user says "Start without permissions" (if that path exists) OR if they grant permissions, it goes to Calibration.
    - **User Report**: "Start button remains". This suggests the Modal is not dismissing or the flow inside Modal isn't triggering `onPermissionsGranted`.
    - **Modal Logic**: `checkSensorAvailability` updates state. The `useEffect` [81-93] auto-triggers `onPermissionsGranted` if all specific sensors are OK.
    - **Wait**: `SensorPermissionRequest` has a "Start without permission" button that calls `skipPermissions` -> `onPermissionsGranted`.
    - **Hypothesis**: The `orientationPermission` check in `OkutamaMap2D` might be stale or the re-render flow is tricky. But `handleRequest3DWithPermission` is an event handler.
    - **Potential Bug**: In `OrientationService.ts`, `requestPermission` only updates `this.permissionState`. Does it trigger a re-render in React components? No. `useSensors` might not update the ref or the component might not know `permissionState` changed unless it polls or uses a reactive store.
    - **Fix**: rely on the callback from the modal, which seems correct in `OkutamaMap2D`.
    - **User Report**: "Start button remains" -> Maybe they mean the "3D Button" on the map? Or the button inside the modal? "Sensor approval modal is behind... and transition doesn't happen".
    - If modal is Behind, they might be clicking the map buttons instead?
    - If they click "Allow" in modal, and it doesn't transition...
    - **Z-Index Fix is P0**.
