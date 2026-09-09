import { useCallback, useState } from "react";
import { useNotification } from "@webstack/components/Notification/Notification";

export type PopupPermissionResult = "hinted" | "ready";

export interface PopupPermissionConfig {
    /** Human-friendly label for the thing that wants popups, e.g. "Canopy stream". */
    featureLabel?: string;
    /** How the user should try again, e.g. "click the cloud icon again". */
    retryActionLabel?: string;
    /** Override origin used in help text; defaults to window.location.origin. */
    originOverride?: string;
}

const usePopupsPermissions = () => {
    const [, setNotification] = useNotification();
    const [hasShownPopupHint, setHasShownPopupHint] = useState(false);
    const [hasShownBlockedNotice, setHasShownBlockedNotice] = useState(false);

    const buildChromeSiteDetailsUrl = useCallback((originOverride?: string): string | null => {
        if (typeof window === "undefined") return null;
        const origin = originOverride || window.location.origin;
        if (!origin) return null;
        return `chrome://settings/content/siteDetails?site=${origin}`;
    }, []);

    const requestPopupPermissionOnce = useCallback(
        (config?: PopupPermissionConfig): PopupPermissionResult => {
            if (typeof window === "undefined") return "ready";

            if (!hasShownPopupHint) {
                setHasShownPopupHint(true);

                const feature = config?.featureLabel ?? "this feature";
                const retry = config?.retryActionLabel ?? "try again";

                setNotification({
                    active: true,
                    dismissable: true,
                    persistence: 9000,
                    list: [
                        {
                            label: "Allow popups, then retry",
                            message: `To start the ${feature}, allow popups for this site in your browser, then ${retry}.`,
                        },
                    ],
                });

                return "hinted";
            }

            return "ready";
        },
        [hasShownPopupHint, setNotification]
    );

    const handleBlockedPopups = useCallback(
        (config?: PopupPermissionConfig) => {
            if (typeof window === "undefined" || typeof navigator === "undefined") return;

            // Only show the "still blocked" guidance once per page load to avoid
            // spamming the user even after they have adjusted permissions.
            if (hasShownBlockedNotice) return;
            setHasShownBlockedNotice(true);

            const feature = config?.featureLabel ?? "popup";
            const retry = config?.retryActionLabel ?? "try again";
            const origin = config?.originOverride || window.location.origin;

            const ua = navigator.userAgent || "";
            const isChrome = ua.includes("Chrome") && !ua.includes("Edg") && !ua.includes("OPR");

            let message = `Your browser appears to be blocking ${feature} windows. Please allow popups for this origin, then ${retry}.`;

            if (isChrome) {
                const chromeSettingsUrl = buildChromeSiteDetailsUrl(origin);
                if (chromeSettingsUrl) {
                    message =
                        `Your browser appears to be blocking ${feature} windows. In Chrome, open a new tab and paste this into the address bar to manage permissions for this site: \n\n` +
                        chromeSettingsUrl +
                        `\n\nThen allow popups and ${retry}. If you already allowed popups, try reloading this page and ${retry}.`;
                }
            }

            setNotification({
                active: true,
                dismissable: true,
                persistence: 12000,
                list: [
                    {
                        label: "Popups still blocked",
                        message,
                    },
                ],
            });
        },
        [buildChromeSiteDetailsUrl, hasShownBlockedNotice, setNotification]
    );

    return {
        hasShownPopupHint,
        requestPopupPermissionOnce,
        handleBlockedPopups,
        buildChromeSiteDetailsUrl,
    };
};

export default usePopupsPermissions;

