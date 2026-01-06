# Implementation Plan - UI/UX and Functionality Updates (2025/12/26)

## Goal Description
Implement a set of bug fixes and UI/UX improvements requested for 2025/12/26. This includes fixing a compass/sensor loading issue, improving 2D/3D mode transitions and controls, and adding a "Return to Current Location" feature.

## User Review Required
> [!IMPORTANT]
> **Compass/Sensor Fix Strategy**: I will modify `OrientationService` to avoid auto-requesting permissions on initial load (which causes failures on iOS). Permissions will only be requested via user interaction (e.g., clicking the 3D button).

## Proposed Changes

### Sensors & Core Logic

#### [MODIFY] [OrientationService.ts](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/services/sensors/OrientationService.ts)
- Update `startTracking` to accept a `silent` option (or checking internal state) to prevent `requestPermission` from running automatically during non-interactive phases (like `useEffect`).

#### [MODIFY] [useSensors.ts](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/hooks/useSensors.ts)
- Update `startSensors` to use the safe/silent mode for orientation tracking initialization on mount.

### 2D Map (OkutamaMap2D)

#### [MODIFY] [OkutamaMap2D.tsx](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/components/map/OkutamaMap2D.tsx)
- **Pin Selection**: Remove the logic that opens the drawer in "list mode". Ensure it opens in "detail mode" (requires `PinListDrawer` update).
- **Slider**: Increase the touch area and visual size of the opacity slider for easier operation.
- **GPS Button**: Add a new button (Location Icon) to fly the map to the user's current GPS position.

#### [MODIFY] [PinListDrawer.tsx](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/components/ui/PinListDrawer.tsx)
- Add a `useEffect` hook to automatically switch `sheetMode` to `'pin-detail'` whenever `selectedPin` changes to a non-null value.

### 3D Viewer (Scene3D)

#### [MODIFY] [Scene3D.tsx](file:///Users/hirosuke/ghq/github.com/hirosukedayo/kotei-lens/src/components/viewer/Scene3D.tsx)
- **Initial UI State**: specific `isControlsVisible` to `false` by default to hide sliders and list buttons upon entering 3D mode.
- **UI Visibility**: Link the "Pin List" button visibility to `isControlsVisible` (or hide it entirely if that's the interpretation, but linking allows access).
- **Button Labels**: Add text labels (e.g., "表示 (View)", "調整 (Adjust)") to the toggle buttons (Eye, Compass) to make them intuitive for beginners.

## Verification Plan

### Automated Tests
- No new automated tests planned as these are primarily UI/Interaction changes dependent on physical device sensors and visual states.

### Manual Verification
1.  **Compass Reload Issue**:
    - Open app in browser (fresh tab).
    - Verify no permission error in console.
    - Click "3D View". Verify permission prompt appears (if applicable) or sensors start correctly without needing a reload.
2.  **2D Pin UI**:
    - Tap a pin on the map.
    - Verify the drawer opens **directly** to the details view, not the list view.
3.  **2D Slider**:
    - Verify the opacity slider is larger and easier to grab.
4.  **2D GPS Button**:
    - Pan away from current location.
    - Click new GPS button.
    - Verify map returns to blue dot (current location).
5.  **3D UI**:
    - Enter 3D mode.
    - Verify sliders and list buttons are **hidden** initially.
    - Verify "Eye" (View) and "Compass" (Adjust) buttons have text labels.
    - Click "View" button: Verify sliders/list appear.
