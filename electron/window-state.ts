import { BrowserWindow, screen, app } from 'electron';
import fs from 'fs';
import path from 'path';

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

const DEFAULT_STATE: WindowState = {
  width: 1280,
  height: 800,
  isMaximized: false,
};

function getStatePath(): string {
  return path.join(app.getPath('userData'), 'window-state.json');
}

export function loadWindowState(): WindowState {
  try {
    const raw = fs.readFileSync(getStatePath(), 'utf-8');
    const state: WindowState = { ...DEFAULT_STATE, ...JSON.parse(raw) };

    // Validate that the saved position is still on a visible display
    if (state.x !== undefined && state.y !== undefined) {
      const displays = screen.getAllDisplays();
      const onScreen = displays.some((display) => {
        const { x, y, width, height } = display.bounds;
        return (
          state.x! >= x &&
          state.x! < x + width &&
          state.y! >= y &&
          state.y! < y + height
        );
      });
      if (!onScreen) {
        delete state.x;
        delete state.y;
      }
    }

    return state;
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveWindowState(win: BrowserWindow) {
  const isMaximized = win.isMaximized();
  const bounds = win.getBounds();

  const state: WindowState = {
    x: isMaximized ? undefined : bounds.x,
    y: isMaximized ? undefined : bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized,
  };

  try {
    fs.writeFileSync(getStatePath(), JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('[window-state] Failed to save:', err);
  }
}
