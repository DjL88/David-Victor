export interface AltiePointerPosition { x: number; y: number }
export interface AltieTargetRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** No guessed/off-screen pointer: only an observed, visible target gets a cue. */
export function getAltiePointerPosition(
  rect: AltieTargetRect | undefined,
  viewportWidth: number,
  viewportHeight: number,
): AltiePointerPosition | null {
  if (!rect || ![rect.left, rect.top, rect.right, rect.bottom, rect.width, rect.height,
    viewportWidth, viewportHeight].every(Number.isFinite)) return null;
  if (viewportWidth <= 0 || viewportHeight <= 0 || rect.width <= 0 || rect.height <= 0
    || rect.right <= 0 || rect.bottom <= 0 || rect.left >= viewportWidth || rect.top >= viewportHeight) return null;
  return {
    x: Math.min(Math.max(0, viewportWidth - 28), Math.max(0, rect.left + Math.min(16, rect.width / 2))),
    y: Math.min(Math.max(0, viewportHeight - 32), Math.max(0, rect.top + Math.min(16, rect.height / 2))),
  };
}
