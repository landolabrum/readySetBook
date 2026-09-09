import { useCallback, useState, useRef, useEffect } from "react";
import { useModal } from "@webstack/components/Containers/modal/contexts/modalContext";

type PermissionState = "granted" | "prompt" | "denied" | "error";

type RequestLocationOptions = {
  /** Run without directly invoking the browser geolocation prompt (let caller trigger it). */
  skipBrowserPrompt?: boolean;
  /** If true, do not open the modal/UI when permission is in the "prompt" state. */
  skipPromptUI?: boolean;
  /** If true, keep using the modal even when Permissions API is unavailable. */
  forceModal?: boolean;
  /** Callback fired as soon as permission is granted. */
  onGrant?: () => void;
  /** Callback fired when the user denies or the browser blocks. */
  onDeny?: () => void;
};

const useLocationPermissions = () => {
  const { openModal, closeModal, isModalOpen } = useModal();
  const [lngLat, setLocation] = useState<[number, number] | undefined>();
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);
  const permissionStatusRef = useRef<PermissionStatus | null>(null);
  const pendingOptsRef = useRef<RequestLocationOptions | null>(null);

  const success = useCallback((position: GeolocationPosition) => {
    setLocation([
      Number(position.coords.longitude.toFixed(2)),
      Number(position.coords.latitude.toFixed(2)),
    ]);
  }, []);

  const error = useCallback(() => {
    console.error("Unable to retrieve your location");
    setPermissionDenied(true);
  }, []);

  const handlePermissionChange = useCallback(() => {
    const permissionStatus = permissionStatusRef.current;
    if (permissionStatus && permissionStatus.state === 'granted') {
      pendingOptsRef.current?.onGrant?.();
      closeModal();
      if (!pendingOptsRef.current?.skipBrowserPrompt) {
        navigator.geolocation.getCurrentPosition(success, error);
      }
      setPermissionDenied(false);
    } else {
      setPermissionDenied(true);
      pendingOptsRef.current?.onDeny?.();
    }
    pendingOptsRef.current = null;
  }, [closeModal, error, success]);

  const requestLocation = useCallback(
    async (opts: RequestLocationOptions = {}): Promise<PermissionState> => {
      pendingOptsRef.current = opts;
      const {
        skipBrowserPrompt = false,
        skipPromptUI = false,
        forceModal = false,
        onGrant,
        onDeny,
      } = opts;

      if (typeof navigator === "undefined") {
        setPermissionDenied(true);
        onDeny?.();
        return "error";
      }

      const openGuardedModal = () =>
        !isModalOpen &&
        openModal({
          title: "Know Your Location",
          confirm: {
            title: "Enable Location",
            body: "To use this feature, please enable location access.",
            statements: [
              {
                label: "Allow",
                onClick: () => {
                  permissionStatusRef.current?.addEventListener("change", handlePermissionChange);
                  onGrant?.();
                  setPermissionDenied(false);
                  pendingOptsRef.current = null;
                  if (!skipBrowserPrompt) {
                    navigator.geolocation.getCurrentPosition(success, error);
                  }
                  closeModal();
                },
              },
              {
                label: "Deny",
                onClick: () => {
                  closeModal();
                  setPermissionDenied(true);
                  pendingOptsRef.current = null;
                  onDeny?.();
                },
              },
            ],
          },
        });

      try {
        if (navigator.permissions) {
          const permissionStatus = await navigator.permissions.query({ name: "geolocation" });
          permissionStatusRef.current = permissionStatus;
          permissionStatus.addEventListener("change", handlePermissionChange);

          if (permissionStatus.state === "granted") {
            onGrant?.();
            setPermissionDenied(false);
            if (!skipBrowserPrompt) {
              navigator.geolocation.getCurrentPosition(success, error);
            }
            return "granted";
          }

          if (permissionStatus.state === "prompt") {
            if (forceModal || !skipPromptUI) openGuardedModal();
            return "prompt";
          }

          setPermissionDenied(true);
          onDeny?.();
          return "denied";
        }

        // Fallback: no Permissions API
        if (forceModal) {
          openGuardedModal();
          return "prompt";
        }
        setPermissionDenied(true);
        onDeny?.();
        return "error";
      } catch (error_) {
        console.error("Error querying permissions", error_);
        setPermissionDenied(true);
        onDeny?.();
        return "error";
      }
    },
    [closeModal, error, handlePermissionChange, isModalOpen, openModal, success]
  );

  useEffect(() => {
    return () => {
      const permissionStatus = permissionStatusRef.current;
      if (permissionStatus) {
        permissionStatus.removeEventListener('change', handlePermissionChange);
      }
    };
  }, [handlePermissionChange]);

  return {
    lngLat,
    requestLocation, // This function can be triggered by a user action
    permissionDenied,
  };
};

export default useLocationPermissions;
