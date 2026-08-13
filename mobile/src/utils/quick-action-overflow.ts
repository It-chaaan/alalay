export type PrioritizedAction<T> = { id: string } & T;

/** Keeps the priority order and reserves one measured slot for More when needed. */
export function splitQuickActions<T>(actions: PrioritizedAction<T>[], width: number, minimumSlotWidth = 68) {
  const slots = Math.max(2, Math.min(actions.length, Math.floor(width / minimumSlotWidth) || 4));
  if (slots >= actions.length) return { visibleActions: actions, overflowActions: [] as PrioritizedAction<T>[] };
  const visibleCount = Math.max(1, slots - 1);
  return { visibleActions: actions.slice(0, visibleCount), overflowActions: actions.slice(visibleCount) };
}
