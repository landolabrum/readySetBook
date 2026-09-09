import React, { useState, useCallback, useMemo } from 'react';
import styles from './OverlayMediaMultiview.scss';
import type { MediaSegmentProps } from '../../controller/OverlayMedia';
import OverlayMediaMultiviewCell from './OverlayMediaMultiviewCell';

type Props = {
  segments: MediaSegmentProps[];
  title?: string | null;
  description?: string | null;
  style?: React.CSSProperties;
  columns?: number;
  objectFit?: string;
  showLabels?: boolean;
};

/** Compute the best column count for a given number of cells. */
const autoColumns = (count: number): number => {
  if (count <= 1) return 1;
  if (count <= 2) return 2;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  if (count <= 16) return 4;
  return Math.ceil(Math.sqrt(count));
};

const OverlayMediaMultiview: React.FC<Props> = ({
  segments,
  title,
  description,
  style,
  columns = 0,
  objectFit = 'contain',
  showLabels = false,
}) => {
  const count = segments.length;
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const handleCellClick = useCallback((index: number) => {
    setFocusedIndex((prev) => (prev === index ? null : index));
  }, []);

  // Resolve effective column count and row count
  const effectiveCols = columns > 0 ? columns : autoColumns(count);
  const effectiveRows = Math.ceil(count / effectiveCols);

  const gridStyle: React.CSSProperties = useMemo(
    () => ({
      ...style,
      display: 'grid',
      gridTemplateColumns: `repeat(${effectiveCols}, 1fr)`,
      gridTemplateRows: `repeat(${effectiveRows}, 1fr)`,
      gap: '2px',
      overflow: 'hidden',
    }),
    [style, effectiveCols, effectiveRows],
  );

  return (
    <>
      <style jsx>{styles}</style>
      <div
        className="overlay-media overlay-media--multiview"
        style={gridStyle}
        role="region"
        aria-label={title || 'multiview'}
      >
        {segments.map((seg, i) => (
          <OverlayMediaMultiviewCell
            key={`${i}-${seg.url}`}
            seg={seg}
            index={i}
            objectFit={objectFit}
            showLabel={showLabels}
            focused={focusedIndex === i}
            hidden={focusedIndex !== null && focusedIndex !== i}
            onClick={handleCellClick}
          />
        ))}
      </div>
    </>
  );
};

export default OverlayMediaMultiview;
