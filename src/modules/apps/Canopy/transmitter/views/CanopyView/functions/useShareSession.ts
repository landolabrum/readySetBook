/**
 * useShareSession – shared hook for camera/screen/encoder/pull overlay controls.
 *
 * Extracts pipeline-session-linking logic, deterministic stream key generation,
 * auto-save effects, and session binding so each control component stays lean.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CanonOverlay } from '@Canopy/models/canopyOverlayTypes';
import type { PipelineKind, PipelineSession } from '~/src/core/services/PipelineService/PipelineService';
import { useLiveStreamCtx } from '@Canopy/context/CanopyProvider';
import useProfile from '~/src/core/authentication/hooks/useProfile';
import { usePipeline } from '~/src/modules/apps/Pipeline/context/PipelineProvider';

const isMediaUrl = (url?: string) => {
  if (!url) return false;
  const lowered = url.toLowerCase();
  return lowered.includes('.m3u8') || lowered.endsWith('.mp4') || lowered.endsWith('.webm');
};

const last3 = (s: string, pad = false) => {
  s = String(s || '').trim();
  if (pad) s = s.padStart(3, '0');
  return s.length >= 3 ? s.slice(-3) : s.padStart(3, '0');
};

const getSessionIdFromMediaUrl = (url?: string) => {
  const value = String(url || '').trim();
  if (!value) return '';

  try {
    const parsed = new URL(value);
    const segments = parsed.pathname.split('/').filter(Boolean);
    return segments.length >= 2 ? segments[0] : '';
  } catch {
    const match = value.match(/\/([^/?#]+)\/(?:index|playlist)[^/?#]*\.m3u8/i);
    return match?.[1] ?? '';
  }
};

const buildShareSourceLabel = (profile?: any) => {
  if (!profile) return 'Unknown share source';

  const name = String(profile?.name || profile?.email || 'Unknown share source').trim();
  const userAgentData = profile?.userAgent?.user_agent_data;
  const browser = (userAgentData?.brands || []).find((entry: any) => entry?.brand && !/not\.a\/brand/i.test(entry.brand))?.brand || '';
  const platform = userAgentData?.platform || '';
  const deviceClass = userAgentData?.mobile ? 'mobile' : 'desktop';
  const address = profile?.metadata?.user?.address || profile?.address;
  const location = [address?.city, address?.state].filter(Boolean).join(', ');

  return [
    name,
    [browser, platform].filter(Boolean).join(' on '),
    browser || platform ? deviceClass : '',
    location,
  ].filter(Boolean).join(' • ');
};

export interface UseShareSessionOpts {
  overlay: CanonOverlay;
  onChange: (e: any) => void;
}

export function useShareSession({ overlay, onChange }: UseShareSessionOpts) {
  const {
    session,
    hlsUrl,
    busy,
    error: pipelineError,
    statusLabel,
    start,
    stop,
    publisherState,
    startRtmp,
    startPull,
    updateStreamKey,
    getSession,
    setActiveSession,
  } = usePipeline();

  const { eventId } = useLiveStreamCtx();
  const eventIdStr = eventId ? String(eventId) : undefined;
  const profile = useProfile();
  const userId = useMemo(() => profile?.id || (profile as any)?.memberId || '', [profile]);
  const overlayId = overlay?.id || '';
  const shareSourceLabel = useMemo(() => buildShareSourceLabel(profile), [profile]);
  const shareSourceContext = useMemo(() => {
    const userAgentData = profile?.userAgent?.user_agent_data;
    const browser = (userAgentData?.brands || []).find((entry: any) => entry?.brand && !/not\.a\/brand/i.test(entry.brand))?.brand || '';

    return {
      label: shareSourceLabel,
      name: String(profile?.name || '').trim(),
      email: String(profile?.email || '').trim(),
      platform: String(userAgentData?.platform || '').trim(),
      browser,
    };
  }, [profile, shareSourceLabel]);

  const shortStreamKey = useMemo(() => {
    if (userId && eventIdStr && overlayId) {
      return `${last3(userId)}-${last3(eventIdStr, true)}-${last3(overlayId)}`;
    }
    return '';
  }, [userId, eventIdStr, overlayId]);

  const overlayData = (overlay as any)?.data ?? {};
  const overlaySessionId = overlayData?.pipelineSessionId ?? overlayData?.pipeline_session_id;
  const overlayStreamKey = overlayData?.streamKey as string | undefined;
  const overlaySrc = overlayData?.src as string | undefined;
  const storedSourceContext = overlayData?.sourceContext as Record<string, any> | undefined;
  const storedSourceLabel = storedSourceContext?.label as string | undefined;
  const derivedSessionId = useMemo(() => {
    const explicitSessionId = String(overlaySessionId ?? '').trim();
    if (explicitSessionId) return explicitSessionId;

    const fromSrc = getSessionIdFromMediaUrl(overlaySrc);
    if (fromSrc) return fromSrc;

    return String(overlayStreamKey ?? '').trim();
  }, [overlaySessionId, overlaySrc, overlayStreamKey]);
  const sessionSourceLabel = useMemo(() => {
    const value = String(session?.label || '').trim();
    if (!value) return '';
    if (/^(screen|camera|rtmp|pull)\s+stream$/i.test(value)) return '';
    return value;
  }, [session?.label]);
  // Only show the local profile's identity when this device is actually the
  // publisher. Otherwise the editor on Device A would mislabel an overlay
  // published by Device B with Device A's name/UA/location.
  const isOwnPublisher = publisherState === 'live' || publisherState === 'publishing';
  const effectiveSourceLabel =
    storedSourceLabel ||
    sessionSourceLabel ||
    (isOwnPublisher ? shareSourceLabel : 'No publisher attached');

  const resolvePlayableUrl = useCallback((currentSession: PipelineSession | null | undefined, preferred?: string): string | undefined => {
    if (!currentSession) return undefined;
    if (preferred && isMediaUrl(preferred) && preferred.includes(currentSession.id)) return preferred;
    const meta = (currentSession as any)?.meta || {};
    // playableHlsUrl is the backend's codec-aware pick (HEVC sources resolve to
    // -h264, H.264 sources resolve to the base path). Prefer it over hlsUrl so
    // the overlay's stored data.src points at a URL that will actually decode.
    const playableHlsUrl =
      (currentSession as any)?.playableHlsUrl || (currentSession as any)?.playable_hls_url;
    const sessionHlsUrl = (currentSession as any)?.hlsUrl || (currentSession as any)?.hls_url;
    const candidates = [
      playableHlsUrl,
      sessionHlsUrl,
      meta?.hlsUrl, meta?.hls_url,
      meta?.playbackUrl, meta?.playback_url,
      meta?.playlistUrl, meta?.playlist_url,
      meta?.viewUrl, meta?.view_url,
      currentSession.viewUrl,
    ].filter(Boolean) as string[];
    const matchingId = candidates.find((u) => isMediaUrl(u) && u.includes(currentSession.id));
    if (matchingId) return matchingId;
    const playable = candidates.find((u) => isMediaUrl(u));
    return playable ?? candidates[0];
  }, []);

  const resolvedPlayableUrl = useMemo(() => resolvePlayableUrl(session, hlsUrl), [hlsUrl, resolvePlayableUrl, session]);
  const activeSessionId = session?.id || '';

  const isBoundToSession = !!derivedSessionId;
  const isLinkedToActiveSession = !!(derivedSessionId && activeSessionId && derivedSessionId === activeSessionId);
  const isRemoteSession = !!(derivedSessionId && (!session?.id || derivedSessionId !== session.id));

  const linkSessionToOverlay = useCallback((currentSession: PipelineSession, playable?: string): boolean => {
    const nextSessionId = currentSession.id || derivedSessionId;
    const nextPlayable = playable ?? resolvePlayableUrl(currentSession, hlsUrl);
    const meta = (currentSession as any)?.meta || {};
    const nextStreamKey = meta?.streamKey ?? meta?.stream_key ?? (currentSession as any)?.streamKey ?? nextSessionId ?? '';

    if (nextSessionId) {
      onChange({ target: { name: 'data.pipelineSessionId', value: nextSessionId } });
    }
    if (nextPlayable) {
      onChange({ target: { name: 'data.src', value: nextPlayable } });
    }
    if (nextStreamKey) {
      onChange({ target: { name: 'data.streamKey', value: nextStreamKey } });
    }
    onChange({ target: { name: 'enabled', value: true } });

    if (currentSession.kind === 'rtmp') {
      onChange({ target: { name: 'data.rtmpIngestUrl', value: meta?.rtmpIngestUrl ?? meta?.rtmp_ingest_url ?? '' } });
    }
    return !!(nextSessionId || nextPlayable);
  }, [derivedSessionId, hlsUrl, onChange, resolvePlayableUrl]);

  // Stamp sourceContext only once the publisher reaches 'live' on the
  // originating device.  This prevents non-origin devices from overwriting
  // the stored label with their own local profile.
  const sourceContextStampedRef = useRef(false);
  useEffect(() => {
    if (publisherState !== 'live') return;
    if (sourceContextStampedRef.current) return;
    if (!session?.id) return;
    sourceContextStampedRef.current = true;
    onChange({ target: { name: 'data.sourceContext', value: shareSourceContext } });
  }, [publisherState, session?.id, shareSourceContext, onChange]);

  // Reset the stamp guard when the session changes
  useEffect(() => {
    sourceContextStampedRef.current = false;
  }, [session?.id]);

  // Restore session from backend when the overlay is already bound to a
  // session or HLS URL but PipelineProvider lost the local session context.
  const restoringRef = useRef(false);
  useEffect(() => {
    if (!derivedSessionId || isLinkedToActiveSession || busy) return;
    if (session?.id === derivedSessionId) return;
    if (restoringRef.current) return;
    restoringRef.current = true;
    getSession(derivedSessionId).then((fetched) => {
      if (fetched?.id && fetched.status !== 'ended') {
        setActiveSession(fetched);
      }
    }).finally(() => { restoringRef.current = false; });
  }, [derivedSessionId, isLinkedToActiveSession, busy, session?.id, getSession, setActiveSession]);

  const userStartedStreamRef = useRef(false);
  const prevLinkedSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!session?.id) return;
    if (session.id === prevLinkedSessionIdRef.current) return;

    if (userStartedStreamRef.current) {
      const linked = linkSessionToOverlay(session, resolvedPlayableUrl ?? undefined);
      if (linked) prevLinkedSessionIdRef.current = session.id;
      userStartedStreamRef.current = false;
      return;
    }

    if (overlaySessionId && overlaySessionId === session.id) {
      const linked = linkSessionToOverlay(session, resolvedPlayableUrl ?? undefined);
      if (linked) prevLinkedSessionIdRef.current = session.id;
    }
  }, [linkSessionToOverlay, resolvedPlayableUrl, session, overlaySessionId]);

  useEffect(() => {
    if (!session?.id || !resolvedPlayableUrl) return;
    if (overlaySessionId !== session.id) return;
    if (overlaySrc === resolvedPlayableUrl) return;
    linkSessionToOverlay(session, resolvedPlayableUrl);
  }, [linkSessionToOverlay, overlaySessionId, overlaySrc, resolvedPlayableUrl, session]);

  useEffect(() => {
    if (!session?.id) return;
    if (publisherState !== 'live') return;
    if (overlaySrc && derivedSessionId === session.id) return;
    if (overlayStreamKey && overlayStreamKey !== session.id && session.id !== shortStreamKey) return;
    if (!overlayStreamKey && derivedSessionId && derivedSessionId !== session.id) return;
    linkSessionToOverlay(session, resolvedPlayableUrl ?? hlsUrl ?? undefined);
  }, [publisherState, session, derivedSessionId, overlaySrc, linkSessionToOverlay, overlayStreamKey, shortStreamKey, resolvedPlayableUrl, hlsUrl]);

  useEffect(() => {
    if (!session?.id || session.kind !== 'rtmp') return;
    if (derivedSessionId && derivedSessionId !== session.id) return;

    const keyMatches = !!overlayStreamKey && (overlayStreamKey === session.id || overlayStreamKey === shortStreamKey);
    if (!derivedSessionId && !keyMatches) return;

    const expectedSrc = resolvedPlayableUrl ?? hlsUrl;
    const needsRelink = !derivedSessionId || derivedSessionId === session.id;
    const needsSrcRepair = !!expectedSrc && overlaySrc !== expectedSrc;
    if (needsRelink && needsSrcRepair) linkSessionToOverlay(session, expectedSrc);
  }, [session, derivedSessionId, overlaySrc, overlayStreamKey, shortStreamKey, resolvedPlayableUrl, hlsUrl, linkSessionToOverlay]);

  useEffect(() => {
    if (!derivedSessionId || overlaySessionId === derivedSessionId) return;
    onChange({ target: { name: 'data.pipelineSessionId', value: derivedSessionId } });
  }, [derivedSessionId, overlaySessionId, onChange]);

  const effectiveSessionId = useMemo(() => {
    return isLinkedToActiveSession ? activeSessionId : (derivedSessionId || '');
  }, [activeSessionId, derivedSessionId, isLinkedToActiveSession]);
  const effectiveSrc = useMemo(() => {
    if (isLinkedToActiveSession) return resolvedPlayableUrl ?? overlaySrc ?? '';
    return overlaySrc || resolvedPlayableUrl || '';
  }, [isLinkedToActiveSession, overlaySrc, resolvedPlayableUrl]);

  const handleStop = useCallback(async () => {
    try {
      const targetId = isLinkedToActiveSession ? (session?.id ?? activeSessionId) : derivedSessionId;
      if (targetId) await stop(targetId);
    } catch {}
    onChange({ target: { name: 'data.pipelineSessionId', value: null } });
    onChange({ target: { name: 'data.src', value: '' } });
    onChange({ target: { name: 'data.rtmpIngestUrl', value: '' } });
    onChange({ target: { name: 'data.streamKey', value: '' } });
    prevLinkedSessionIdRef.current = null;
  }, [activeSessionId, derivedSessionId, isLinkedToActiveSession, onChange, session, stop]);

  const isPublishing = publisherState === 'publishing' || publisherState === 'live';
  const isStreaming = (isLinkedToActiveSession && isMediaUrl(resolvedPlayableUrl)) || (isRemoteSession && isMediaUrl(effectiveSrc));
  const isRtmpActive = isLinkedToActiveSession && session?.kind === 'rtmp';
  const isPullActive = isLinkedToActiveSession && session?.kind === 'pull';

  // Same-machine UX accelerator on top of the server-authoritative overlay
  // binding (route.py `_bind_session_to_overlay` runs on createSession and
  // NOTIFYs the SSE channel). This listener lets the editor tab that opened
  // the popup reflect the binding within ~50 ms instead of waiting for the
  // SSE round-trip. Late-mounting listeners are covered by the 2 s heartbeat
  // in Pipeline.tsx, and ultimately by the server-side write — so neither
  // path is load-bearing for correctness.
  const [popupPublisherState, setPopupPublisherState] = useState<string | null>(null);
  const [popupStatusLabel, setPopupStatusLabel] = useState<string | null>(null);
  const [popupSessionId, setPopupSessionId] = useState<string | null>(null);
  useEffect(() => {
    if (!overlayId) return;
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(`canopy-publisher-${overlayId}`);
    const handle = (event: MessageEvent) => {
      const data = event?.data;
      if (!data || data.type !== 'pipeline-state') return;
      if (typeof data.publisherState === 'string') setPopupPublisherState(data.publisherState);
      if (typeof data.statusLabel === 'string') setPopupStatusLabel(data.statusLabel);
      if (typeof data.sessionId === 'string' && data.sessionId) setPopupSessionId(data.sessionId);
    };
    channel.addEventListener('message', handle);
    return () => {
      channel.removeEventListener('message', handle);
      channel.close();
    };
  }, [overlayId]);

  // Popup told us its session id — write the binding onto the overlay row
  // (pipelineSessionId + src + streamKey) so the editor renders the live
  // stream. The popup itself can't write onChange in this tab.
  const popupBindRef = useRef<string | null>(null);
  useEffect(() => {
    if (!popupSessionId) return;
    if (popupBindRef.current === popupSessionId) return;
    if (overlaySessionId === popupSessionId) {
      popupBindRef.current = popupSessionId;
      return;
    }
    popupBindRef.current = popupSessionId;
    getSession(popupSessionId).then((fetched) => {
      if (!fetched?.id) return;
      setActiveSession(fetched);
      linkSessionToOverlay(fetched);
    }).catch(() => {
      popupBindRef.current = null;
    });
  }, [popupSessionId, overlaySessionId, getSession, setActiveSession, linkSessionToOverlay]);

  const sessionLabel = useMemo(() => {
    if (busy) return 'Pipeline: working…';
    if (isLinkedToActiveSession) return `Pipeline ${session?.kind ?? 'stream'} – ${session!.id}`;
    if (isRemoteSession && derivedSessionId) return `Remote session ${derivedSessionId} is bound to this overlay.`;
    if (derivedSessionId) return `Bound to session ${derivedSessionId}.`;
    if (pipelineError) return `Pipeline error: ${pipelineError}`;
    return 'No active Pipeline session.';
  }, [busy, derivedSessionId, isLinkedToActiveSession, isRemoteSession, pipelineError, session]);

  const shareStatusLabel = useMemo(() => {
    const sessionStatus = String((session as any)?.status || '').toLowerCase();
    const hasPlayableBinding = !!effectiveSrc && isMediaUrl(effectiveSrc);

    if (pipelineError) return `⚠️ ${pipelineError}`;
    if (busy) return 'Working...';
    if (popupPublisherState === 'live' || popupPublisherState === 'publishing') {
      return popupStatusLabel || (popupPublisherState === 'live' ? '🟢 Live' : 'Publishing...');
    }
    // This client owns a publisher for the overlay's session — trust the
    // local publisher state. Otherwise statusLabel is just *this client's*
    // local 'idle' and would mask a session that's live elsewhere.
    if (isPublishing) return statusLabel;
    if (isRemoteSession && (sessionStatus === 'active' || hasPlayableBinding)) return '🟢 Remote Live';
    if (isLinkedToActiveSession && (sessionStatus === 'active' || hasPlayableBinding)) return '🟢 Session Active';
    if (derivedSessionId && hasPlayableBinding) return '🟢 Bound';
    return statusLabel;
  }, [busy, derivedSessionId, effectiveSrc, isLinkedToActiveSession, isPublishing, isRemoteSession, pipelineError, popupPublisherState, popupStatusLabel, session, statusLabel]);

  const rtmpIngestUrl = useMemo(() => {
    if (isLinkedToActiveSession && session?.kind === 'rtmp') {
      const s = session as any;
      return s?.rtmpUrl || s?.rtmp_url || s?.rtmpIngestUrl || s?.rtmp_ingest_url || s?.meta?.rtmpIngestUrl || s?.meta?.rtmp_ingest_url || '';
    }
    return (overlay as any)?.data?.rtmpIngestUrl ?? '';
  }, [isLinkedToActiveSession, overlay, session]);

  const streamKey = useMemo(() => {
    if (isLinkedToActiveSession && session?.kind === 'rtmp') {
      const s = session as any;
      return s?.meta?.streamKey || s?.meta?.stream_key || s?.streamKey || s?.id || '';
    }
    return (overlay as any)?.data?.streamKey ?? '';
  }, [isLinkedToActiveSession, overlay, session]);

  const effectiveStreamKey = streamKey || shortStreamKey;
  const lanRtmpUrl = 'rtmp://v.tiktok.soy';
  const lanRtmpPushUrl = useMemo(() => effectiveStreamKey ? `rtmp://v.tiktok.soy/${effectiveStreamKey}` : '', [effectiveStreamKey]);
  const lanSrtUrl = useMemo(() => effectiveStreamKey ? `srt://v.tiktok.soy:8890?streamid=publish:${effectiveStreamKey}&mode=caller` : '', [effectiveStreamKey]);
  const lanHlsUrl = useMemo(() => effectiveStreamKey ? `https://hls.tiktok.soy/${effectiveStreamKey}/index.m3u8` : '', [effectiveStreamKey]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
  }, []);

  const [editingStreamKey, setEditingStreamKey] = useState(false);
  const [editStreamKeyValue, setEditStreamKeyValue] = useState('');
  const [streamKeyError, setStreamKeyError] = useState<string | null>(null);

  const handleEditStreamKey = useCallback(() => {
    setEditStreamKeyValue(streamKey);
    setEditingStreamKey(true);
    setStreamKeyError(null);
  }, [streamKey]);

  const handleSaveStreamKey = useCallback(async () => {
    if (!session?.id || !editStreamKeyValue.trim()) return;
    setStreamKeyError(null);
    try {
      const updated = await updateStreamKey(session.id, editStreamKeyValue.trim());
      if (updated) {
        setEditingStreamKey(false);
        linkSessionToOverlay(updated);
      }
    } catch (err: any) {
      setStreamKeyError(err?.message || 'Failed to update stream key');
    }
  }, [session?.id, editStreamKeyValue, updateStreamKey, linkSessionToOverlay]);

  const handleCancelEditStreamKey = useCallback(() => {
    setEditingStreamKey(false);
    setStreamKeyError(null);
  }, []);

  const startWithContext = useCallback(async (kind: PipelineKind, stream: MediaStream, options?: any) => {
    const newSession = await start(kind, stream, {
      ...options,
      label: shareSourceLabel || undefined,
      meta: {
        ...(options?.meta || {}),
        sourceContext: shareSourceContext,
      },
      userId: userId || undefined,
      streamId: eventIdStr || undefined,
      overlayId: overlayId || undefined,
    });
    if (newSession) {
      linkSessionToOverlay(newSession);
      prevLinkedSessionIdRef.current = newSession.id;
    }
    return newSession;
  }, [start, shareSourceContext, shareSourceLabel, userId, eventIdStr, overlayId, linkSessionToOverlay]);

  return {
    session,
    hlsUrl,
    busy,
    pipelineError,
    statusLabel,
    start: startWithContext,
    stop: handleStop,
    publisherState,
    startRtmp,
    startPull,
    userId,
    eventIdStr,
    overlayId,
    shortStreamKey,
    overlaySessionId,
    overlaySrc,
    isLinkedToActiveSession,
    effectiveSessionId,
    effectiveSrc,
    resolvedPlayableUrl,
    isPublishing,
    isStreaming,
    isRtmpActive,
    isPullActive,
    isBoundToSession,
    isRemoteSession,
    sessionLabel,
    shareStatusLabel,
    shareSourceLabel: effectiveSourceLabel,
    linkSessionToOverlay,
    userStartedStreamRef,
    rtmpIngestUrl,
    streamKey,
    effectiveStreamKey,
    lanRtmpUrl,
    lanRtmpPushUrl,
    lanSrtUrl,
    lanHlsUrl,
    copyToClipboard,
    getSession,
    updateStreamKey,
    editingStreamKey,
    editStreamKeyValue,
    setEditStreamKeyValue,
    streamKeyError,
    handleEditStreamKey,
    handleSaveStreamKey,
    handleCancelEditStreamKey,
  };
}
