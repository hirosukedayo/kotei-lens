# Fixed Camera Freeze & Infinite Rendering Plan

The "20-second freeze" is likely caused by **CameraPositionSetter** performing an expensive scene traversal and BoundingBox calculation every single frame (or at a high frequency) while searching for the terrain, combined with **Scene3D** re-rendering every frame due to sensor data updates.

The "infinite sensor active logs" in 2D view are caused by the **useSensors** hook's `startSensors` function having a dependency on `sensorData`, causing it to be recreated on every GPS/orientation update, re-triggering the `useEffect` in `OkutamaMap2D`.

## User Review Required
- None. These are specific performance fixes.

## Proposed Changes

### [Performance] Fix Infinite Sensor Logs
**File:** [useSensors.ts](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/hooks/useSensors.ts)

1.  **Stabilize `startSensors`**:
    -   Remove `sensorData` from the dependency array of `startSensors`.
    -   It is causing `startSensors` to be recreated on every sensor update.
    -   This triggers `useEffect` in `OkutamaMap2D` repeatedly, calling `startSensors` again, hitting the "already active" guard and logging.
    -   Also remove `isActive` dependency if possible, or accept one extra call/log. Better to use a Ref for `isActive` tracking to avoid dependency changes entirely.

### [Performance] Optimize CameraPositionSetter
**File:** [Scene3D.tsx](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/components/viewer/Scene3D.tsx)

1.  **Stop expensive per-frame traversal**:
    -   Currently calculates `Box3` for *every* mesh in the scene every frame.
    -   Change to first use `scene.getObjectByName('Displacement.001')` (much faster).
    -   Only fall back to traversal if named object is not found.
    -   Run the search only once every 30 frames (0.5s) instead of every frame.
    -   Add `break` or `return` logic once terrain is found to stop searching.
2.  **Reduce Log Noise**:
    -   The "Searching..." and "Render..." logs are flooding the console.
    -   Remove or reduce the frequency/level of these logs.

### [Performance] Reduce Scene3D Re-renders
**File:** [Scene3D.tsx](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/components/viewer/Scene3D.tsx)

1.  **Memoize Props**:
    -   `calculateTerrainPosition()` returns a new array reference every render, causing `LakeModel` (and other children) to re-render.
    -   Wrap it in `useMemo` or move it outside the component loop if possible (it's already a component helper, but usage passes new array).
2.  **Stable References**:
    -   Ensure `LakeModel` receives stable props.

### [Improvement] LakeModel Optimization
**File:** [LakeModel.tsx](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/components/3d/LakeModel.tsx)

1.  **Wrap in React.memo**:
    -   Avoid re-renders if props (position/rotation/scale) haven't deeply changed.
    -   Reduce log spam (`[LakeModel] レンダリング...`).

## Verification Plan

### Automated Tests
- None available for 3D visual interaction.

### Manual Verification
1.  **Check 2D Logs**: Open 2D map. Confirm "Sensors are already active" does not spam the console.
2.  **Check Freeze**: Load the 3D scene.
3.  **Confirm Control**: Immediately try to move the device. The camera should respond without a 20s lag.
4.  **Check Logs**: Verify console is not flooded with "Searching for terrain" or "Rendering LakeModel" logs.
5.  **Verify Terrain Height**: Confirm the camera still sets itself to the correct height relative to the terrain (no regression in positioning).
