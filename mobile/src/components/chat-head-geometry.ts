export type ChatHeadPosition = { x: number; y: number };

export function initialChatHeadPosition({
  width,
  height,
  insetTop,
  insetBottom,
  size,
}: {
  width: number;
  height: number;
  insetTop: number;
  insetBottom: number;
  size: number;
}): ChatHeadPosition {
  return {
    x: Math.max(16, width - size - 16),
    y: Math.max(insetTop + 56, height - size - insetBottom - 142),
  };
}

export function snappedChatHeadPosition({
  x,
  y,
  width,
  height,
  insetTop,
  insetBottom,
  size,
}: ChatHeadPosition & {
  width: number;
  height: number;
  insetTop: number;
  insetBottom: number;
  size: number;
}): ChatHeadPosition {
  return {
    x: x + size / 2 < width / 2 ? 16 : width - size - 16,
    y: Math.min(Math.max(insetTop + 56, height - size - insetBottom - 150), Math.max(insetTop + 56, y)),
  };
}
