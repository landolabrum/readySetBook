import { useCallback, useMemo, useState } from "react";
import type { CanonOverlay, MediaSegment } from "@Canopy/models/canopyOverlayTypes";
import {
  defaultMediaSegment,
  mediaSegmentFields,
  multiviewFields,
  normalizeSegments,
} from "@Canopy/models/canopyOverlayTypes";

export const useMediaSegmentEditor = (overlay: CanonOverlay, onChange: (e: any) => void) => {
  const segments: MediaSegment[] = useMemo(() => normalizeSegments((overlay as any)?.data), [overlay]);
  const isMultiview = (overlay as any)?.variant === "multiview";
  const mvFields = useMemo(
    () => (isMultiview ? multiviewFields((overlay as any)?.data) : []),
    [overlay, isMultiview],
  );

  const pushSegments = useCallback((next: MediaSegment[]) => {
    onChange({ target: { name: "data.segments", value: next } });
    onChange({ target: { name: "data.urls", value: next.map((s) => s.url).filter(Boolean) } });
  }, [onChange]);

  const [activeSegmentIdx, setActiveSegmentIdx] = useState<number | null>(null);
  const [newSegment, setNewSegment] = useState<MediaSegment>(() => {
    const seg = defaultMediaSegment();
    const overlayKind = (overlay as any)?.data?.kind;
    if (overlayKind) seg.kind = overlayKind;
    return seg;
  });

  const handleNewSegmentChange = useCallback((e: any) => {
    const name: string = e?.target?.name ?? "";
    const value = e?.target?.value;
    const field = name.replace(/^new\./, "") as keyof MediaSegment;
    setNewSegment((prev) => ({ ...prev, [field]: value }));
  }, []);

  const newSegmentFields = useMemo(() => {
    const kind = String(newSegment.kind || "video");
    const isIframe = kind === "iframe";
    const isImage = kind === "image";
    return [
      { name: "new.url", label: "URL", type: "text", value: newSegment.url || "", width: "100%", placeholder: "https://..." },
      {
        name: "new.kind", label: "Type", type: "select", width: "33%",
        value: isIframe ? "iframe" : isImage ? "image" : "video",
        options: [
          { label: "Video", value: "video" },
          { label: "Image", value: "image" },
          { label: "iFrame", value: "iframe" },
        ],
      },
      { name: "new.duration", label: "Duration (s)", type: "number", value: newSegment.duration ?? 30, min: 1, step: 1, width: "33%" },
      { name: "new.preload", label: "Preload (s)", type: "number", value: newSegment.preload ?? 0, min: 0, step: 1, width: "33%" },
    ];
  }, [newSegment]);

  const addNewSegment = useCallback(() => {
    const next = [...segments, newSegment];
    pushSegments(next);
    setActiveSegmentIdx(next.length - 1);
    const seg = defaultMediaSegment();
    const overlayKind = (overlay as any)?.data?.kind;
    if (overlayKind) seg.kind = overlayKind;
    setNewSegment(seg);
  }, [newSegment, segments, pushSegments, overlay]);

  const removeSegment = useCallback((index: number) => {
    pushSegments(segments.filter((_, i) => i !== index));
    setActiveSegmentIdx((prev) => {
      if (prev === null) return null;
      if (prev === index) return null;
      if (prev > index) return prev - 1;
      return prev;
    });
  }, [segments, pushSegments]);

  const moveSegment = useCallback((from: number, to: number) => {
    if (to < 0 || to >= segments.length) return;
    const next = [...segments];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    pushSegments(next);
  }, [segments, pushSegments]);

  const handleSegmentRowClick = useCallback((row: any) => {
    const idx = row._idx;
    setActiveSegmentIdx((prev) => (prev === idx ? null : idx));
  }, []);

  const handleSegmentDrag = useCallback((payload: { from: number; to: number }) => {
    moveSegment(payload.from, payload.to);
    setActiveSegmentIdx(null);
  }, [moveSegment]);

  const handleSegmentChange = useCallback((e: any) => {
    const name: string = e?.target?.name ?? "";
    let value = e?.target?.value;
    // Select fields emit {label, value} objects — unwrap to plain value
    if (value && typeof value === 'object' && 'value' in value) value = value.value;
    const match = name.match(/^data\.segments\.(\d+)\.(.+)$/);
    if (!match) {
      onChange(e);
      return;
    }
    const idx = Number(match[1]);
    const field = match[2] as keyof MediaSegment;
    const next = segments.map((seg, i) => (i === idx ? { ...seg, [field]: value } : seg));
    pushSegments(next);
  }, [segments, pushSegments, onChange]);

  return {
    segments,
    isMultiview,
    mvFields,
    activeSegmentIdx,
    setActiveSegmentIdx,
    newSegmentFields,
    addNewSegment,
    removeSegment,
    handleNewSegmentChange,
    handleSegmentRowClick,
    handleSegmentDrag,
    handleSegmentChange,
    mediaSegmentFields,
  };
};
