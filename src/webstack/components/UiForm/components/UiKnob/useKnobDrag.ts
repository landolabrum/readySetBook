import { useCallback, useRef } from 'react';
import { buildKnobState, type KnobState } from './audioKnobMath';

const SENSITIVITY = 200;

export function useKnobDrag(
  normalized: number,
  onChange?: (state: KnobState) => void,
) {
  const normRef = useRef(normalized);
  normRef.current = normalized;

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startNorm = normRef.current;
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const deltaY = startY - ev.clientY;
        const next = Math.max(0, Math.min(1, startNorm + deltaY / SENSITIVITY));
        normRef.current = next;
        onChange?.(buildKnobState(next));
      };

      const onUp = () => {
        target.removeEventListener('pointermove', onMove);
        target.removeEventListener('pointerup', onUp);
      };

      target.addEventListener('pointermove', onMove);
      target.addEventListener('pointerup', onUp);
    },
    [onChange],
  );

  return { onPointerDown };
}
