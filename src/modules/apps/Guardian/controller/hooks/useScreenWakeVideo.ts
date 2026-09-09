import { useEffect, useRef, useState } from "react";

const WAKE_VIDEO_SRC = "/media/guardian-keepawake.mp4";
const GESTURE_EVENTS: Array<keyof WindowEventMap> = ["pointerdown", "touchstart", "keydown"];

type Options = {
  /** Toggle the wake lock behavior. */
  enabled?: boolean;
  /** Attempt to resume playback after the tab becomes visible again. */
  resumeOnVisible?: boolean;
};

type ScreenWakeVideoState = {
  playing: boolean;
};

const useScreenWakeVideo = ({ enabled = true, resumeOnVisible = true }: Options = {}): ScreenWakeVideoState => {
  const [playing, setPlaying] = useState(false);
  const gestureCleanupRef = useRef<() => void>();

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof document === "undefined") {
      setPlaying(false);
      return undefined;
    }

    let disposed = false;
    const video = document.createElement("video");
    video.src = WAKE_VIDEO_SRC;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.tabIndex = -1;
    video.setAttribute("aria-hidden", "true");
    Object.assign(video.style, {
      position: "fixed",
      width: "1px",
      height: "1px",
      opacity: "0",
      pointerEvents: "none",
      left: "0",
      top: "0",
      transform: "translate(-100%, -100%)",
    });
    document.body.appendChild(video);
    let suppressPauseHandler = false;

    const cleanupGestureFallback = () => {
      gestureCleanupRef.current?.();
      gestureCleanupRef.current = undefined;
    };

    const ensurePlaying = async (): Promise<void> => {
      if (disposed) return;
      try {
        await video.play();
        if (!disposed) setPlaying(true);
      } catch (error) {
        if (!disposed) setPlaying(false);
        throw error;
      }
    };

    const attachGestureFallback = () => {
      if (disposed || gestureCleanupRef.current) return;
      const handler = () => {
        cleanupGestureFallback();
        void ensurePlaying().catch(() => {
          // If playback fails again we re-attach listeners on the next tick.
          if (!disposed) window.setTimeout(attachGestureFallback, 50);
        });
      };
      GESTURE_EVENTS.forEach((eventName) => {
        window.addEventListener(eventName, handler, { passive: true, once: true });
      });
      gestureCleanupRef.current = () => {
        GESTURE_EVENTS.forEach((eventName) => {
          window.removeEventListener(eventName, handler);
        });
      };
    };

    const handleVisibility = () => {
      if (disposed) return;
      if (document.visibilityState !== "visible") {
        suppressPauseHandler = true;
        video.pause();
        window.setTimeout(() => {
          suppressPauseHandler = false;
        }, 0);
        setPlaying(false);
        return;
      }
      if (!resumeOnVisible) return;
      void ensurePlaying().catch(() => attachGestureFallback());
    };

    const handlePause = () => {
      if (disposed || suppressPauseHandler || document.visibilityState !== "visible") return;
      void ensurePlaying().catch(() => attachGestureFallback());
    };

    const handlePlaying = () => {
      if (!disposed) setPlaying(true);
    };

    document.addEventListener("visibilitychange", handleVisibility);
    video.addEventListener("pause", handlePause);
    video.addEventListener("playing", handlePlaying);

    void ensurePlaying().catch(() => attachGestureFallback());

    return () => {
      disposed = true;
      cleanupGestureFallback();
      document.removeEventListener("visibilitychange", handleVisibility);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("playing", handlePlaying);
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.remove();
      setPlaying(false);
    };
  }, [enabled, resumeOnVisible]);

  return { playing };
};

export default useScreenWakeVideo;
