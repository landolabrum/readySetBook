
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import styles from "./Canopy.scss";
import CanopyPanel from "../views/CanopyPanel/controller/CanopyPanel";
import useLocalStorage from "@webstack/hooks/storage/useLocalStorage";
import { useRouter } from "next/router";
import { useCanopy } from "../../hooks/useCanopy";
import type { EventRow } from "../../hooks/useCanopy";
import { useModal } from "@webstack/components/Containers/modal/contexts/modalContext";
import { useNotification } from "@webstack/components/Notification/Notification";
import { CanopyProvider, getOverlayStream } from "../../context/CanopyProvider";
import useLayout from "@webstack/layouts/default/hooks/useLayout";
import useWindow from "@webstack/hooks/window/useWindow";
import WindowCaptureOverlay from "@Canopy/receiver/overlays/WindowCaptureOverlay/WindowCaptureOverlay";
import CanopyResizerContent from "../views/CanopyResizerContent";
import { useCanopySettingsSync } from "../../hooks/useCanopySettingsSync";
import { useCanopyViewState } from "../../hooks/useCanopyViewState";


import CanopyHeader from "../views/CanopyHeader/controller/CanopyHeader";
import { getService } from "@webstack/common";
import IDataBaseService from "~/src/core/services/DataBaseService/IDataBaseService";
import CanopyEventForm from "@Canopy/transmitter/forms/CanopyEventForm/CanopyEventForm";
import EventsPickerModal from "../views/CanopyHeader/views/EventsPickerModal/EventsPickerModal";
import { useClearance, useUser } from "~/src/core/authentication/hooks/useUser";
import { IFormField } from "@webstack/components/UiForm/models/IFormModel";
import { useEventTiming } from "../views/CanopyPanel/hooks/useEventTiming";
export const TABLE_NAME = "livestream_event";
const LS_KEY_CURRENT = "livestream_event:current";
const BACKGROUND_COLOR = 'var(--gray-90)';
const serverUrl = String(process.env.NEXT_PUBLIC_PRODUCTION_SERVER?.trim() || '');
import { useBuildInfo } from "@webstack/lib/project/BuildInfo/useBuildInfo";

// Inner shell mounted inside CanopyProvider so useCanopyViewState can access live context.
// Calls the heavyweight viewState hook ONCE and passes the result to both
// CanopyHeader (toolbar) and CanopyResizerContent (monitor + controls).
const CanopyShell: React.FC<{
  current: EventRow | null;
  children: (viewState: ReturnType<typeof useCanopyViewState>) => React.ReactNode;
}> = ({ current, children }) => {
  const viewState = useCanopyViewState(current);
  return <>{children(viewState)}</>;
};

const Canopy: React.FC = () => {
  const buildInfo = useBuildInfo("object");
  const { layout, setLayout } = useLayout();
  const { width } = useWindow();
  const isMobile = width < 1100;
  const router = useRouter();
  const { openModal, closeModal } = useModal();
  const [, setNotification] = useNotification();
  const { events, loadEvents, deleteEvent: deleteEventDb, deleteEventOnly, getOverlaysById, duplicateEvent } = useCanopy();
  const db = getService<IDataBaseService>("IDataBaseService");
  const clearance = useClearance();
  const isAdminClearance = clearance >= 12;
  const user = useUser();

  const urlEventId = useMemo(() => {
    if (!router?.isReady) return undefined;
    return (router.query?.event as string) || (router.query?.eventId as string) || (router.query?.id as string);
  }, [router.isReady, router.query]);
  const viewId = useMemo(() => {
    if (!router?.isReady) return;
    return router.query?.view as string;
  }, [router.isReady, router.query]);
  const [current, setCurrent] = useState<EventRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const { setLocalItem, deleteLocalItem, getLocalItem } = useLocalStorage(LS_KEY_CURRENT);
  const { hydrate, pushCurrentEvent } = useCanopySettingsSync();

  const readSavedEventId = useCallback((): string | null => {
    try {
      const raw = getLocalItem?.(LS_KEY_CURRENT);
      if (!raw) return null;
      if (typeof raw === "string") return raw;
      if (typeof raw === "object" && "id" in raw) return String((raw as any).id);
      return null;
    } catch {
      return null;
    }
  }, [getLocalItem]);

  // --- EventsPanel state (lifted from CanopyPanel) ---
  const eventList: EventRow[] = useMemo(() => {
    if (!events) return [];
    return Array.isArray(events) ? events : (events as { data: EventRow[] }).data ?? [];
  }, [events]);

  const options: IFormField[] = useMemo(() => {
    const toOption = (e: EventRow): IFormField => {
      const ownerTag = isAdminClearance && (e as any)?.user_id ? ` [${(e as any).user_id}]` : "";
      return {
        id: String(e.id),
        label: `${e.name}${ownerTag}`,
        traits: { afterIcon: e?.is_live ? { icon: "fa-broadcast-tower", color: "var(--green-10)" } : undefined },
        value: String(e.id),
        name: e.name,
      };
    };

    const byStartsAt = (a: EventRow, b: EventRow) =>
      new Date(a.starts_at ?? 0).getTime() - new Date(b.starts_at ?? 0).getTime();

    const uid = user?.id != null ? String(user.id) : null;
    const visible = isAdminClearance
      ? eventList
      : eventList.filter((e) => uid != null && String((e as any).user_id ?? "") === uid);

    const liveEvents = visible.filter((e) => e.is_live).sort(byStartsAt);
    const otherEvents = visible.filter((e) => !e.is_live).sort(byStartsAt);

    const result: IFormField[] = [];
    if (liveEvents.length) {
      result.push({ id: "__header_live", label: "LIVE", value: "__header_live", name: "", disabled: true, traits: { icon: "fa-broadcast-tower", color: "var(--green-10)" }, active: false });
      result.push(...liveEvents.map(toOption));
    }
    if (otherEvents.length) {
      result.push({ id: "__header_events", label: "EVENTS", value: "__header_events", name: "", active: false });
      result.push(...otherEvents.map(toOption));
    }
    return result;
  }, [eventList, isAdminClearance, user?.id]);

  const currentIsLive = !!(current && current.is_live);
  const { eventTableData } = useEventTiming(current, nowTick);

  // Initial load
  useEffect(() => {
    if (!events || events.length === 0) void loadEvents();
  }, [events?.length, loadEvents]);
  // console.log("[ BUILD INFO ]",)

  const setUrlEvent = useCallback(
    (id: string | null) => {
      if (!router?.isReady) return;
      const { pathname, query } = router;
      const nextQuery = { ...query };
      if (id) nextQuery.event = id;
      else delete nextQuery.event;
      router.replace({ pathname, query: nextQuery }, undefined, { shallow: true }).catch(() => { });
    },
    []
  );

  const setLsCurrent = useCallback(
    (id: string | null) => {
      try {
        if (id) setLocalItem(LS_KEY_CURRENT, { id });
        else deleteLocalItem(LS_KEY_CURRENT);
      } catch { }
    },
    [setLocalItem, deleteLocalItem]
  );

  // Set Canopy background (once)
  useEffect(() => {
    if (!layout || BACKGROUND_COLOR == layout.background) return;
    setLayout({ background: BACKGROUND_COLOR });
  }, [layout]);

  // Hydrate from server on first load (new device), then sync current event from URL / LS
  const hydratedRef = useRef(false);
  const [initialResolutionDone, setInitialResolutionDone] = useState(false);
  useEffect(() => {
    if (!router.isReady || !events?.length) return;
    const already = String(current?.id ?? "");

    // 1. URL takes priority
    if (urlEventId) {
      if (already === String(urlEventId)) { setInitialResolutionDone(true); return; }
      const m = events.find((e) => String(e.id) === String(urlEventId)) || null;
      setCurrent(m);
      setLsCurrent(m ? String(m.id) : null);
      setInitialResolutionDone(true);
      return;
    }

    // 2. Try localStorage
    const savedId = readSavedEventId();
    if (savedId) {
      const m = events.find((e) => String(e.id) === savedId) || null;
      if (m) {
        setCurrent(m);
        // Fix: also set the URL query so it's not empty on load
        setUrlEvent(savedId);
      }
      setInitialResolutionDone(true);
      return;
    }

    // 3. No URL, no LS → try server hydration (new device)
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      void hydrate().then((lastEventId) => {
        if (lastEventId) {
          const m = events.find((e) => String(e.id) === String(lastEventId)) || null;
          if (m) {
            setCurrent(m);
            setLsCurrent(String(m.id));
            setUrlEvent(String(m.id));
          }
        }
        setInitialResolutionDone(true);
      });
    }
  }, [router.isReady, events, urlEventId, current?.id, setLsCurrent, readSavedEventId, hydrate, setUrlEvent]);

  const handleUserSelect = useCallback(
    (evt: EventRow | null) => {
      const idStr = evt?.id != null ? String(evt.id) : null;
      // Push the *previous* event's settings to server before switching
      if (current?.id) pushCurrentEvent(String(current.id));
      setCurrent(evt);
      setLsCurrent(idStr);
      setUrlEvent(idStr);
    },
    [setUrlEvent, setLsCurrent, current?.id, pushCurrentEvent]
  );

  // --- EventsPanel callbacks (lifted from CanopyPanel) ---
  const onSelectEvent = useCallback(
    (opt: { value?: string } | string) => {
      const selectedValue = typeof opt === "string" ? opt : opt?.value;
      if (!selectedValue || String(selectedValue).startsWith("__header_")) return;
      const selectedById = eventList.find((e) => String(e.id) === String(selectedValue));
      const selectedByName = eventList.find(
        (e) => (e.name ?? "").trim() === String(selectedValue).trim()
      );
      const selected = selectedById ?? selectedByName;
      if (!selected) return;
      handleUserSelect(selected);
      setNotification({
        active: true,
        persistence: 2000,
        dismissable: true,
        list: [{ label: "Event selected", message: `"${selected.name}"` }],
      });
    },
    [eventList, handleUserSelect, setNotification]
  );

  const handleToggleLive = useCallback(async () => {
    if (!current) return;
    const willEnable = !current.is_live;
    const prev = current;
    const optimistic: EventRow = { ...current, is_live: willEnable };
    setCurrent(optimistic);
    try {
      await db.updateData({ tableName: "livestream_event", set: { is_live: willEnable }, where: { id: current.id } });
      setNotification({
        active: true, dismissable: true, persistence: 2200,
        list: [{ label: willEnable ? "Live Enabled" : "Live Disabled", message: willEnable ? `"${current.name}" is now LIVE` : `"${current.name}" is no longer live` }],
      });
    } catch (err: any) {
      setCurrent(prev);
      setNotification({
        active: true, dismissable: true, persistence: 6000,
        apiError: { message: "Failed to toggle Live", status: 0, detail: err?.message ?? err, error: true },
        list: [{ label: "Toggle failed", message: "State restored." }],
      });
    }
  }, [current, db, setCurrent, setNotification]);

  const onCreateEvent = useCallback(() => {
    openModal({
      title: "Create event",
      variant:"popup",
      children: (
        <CanopyEventForm
          compact
          onRefresh={async () => { await loadEvents(); }}
          onCreated={(newEventId?: string, row?: EventRow) => {
            const created = row ?? eventList.find((e) => String(e.id) === String(newEventId));
            if (created) handleUserSelect(created as EventRow);
            closeModal();
          }}
        />
      ),
    });
  }, [eventList, openModal, closeModal, handleUserSelect, loadEvents]);

  // Prompt for an event once initial URL/LocalStorage/server resolution has
  // settled and nothing was found — shown at most once per mount so
  // dismissing it doesn't nag the user on every re-render.
  const noEventModalShownRef = useRef(false);
  useEffect(() => {
    if (!initialResolutionDone || current || noEventModalShownRef.current) return;
    noEventModalShownRef.current = true;
    openModal({
      title: "Select an event",
      dismissable: true,
            variant:"popup",

      children: (
        <EventsPickerModal
          events={eventList}
          onSelect={(evt) => { handleUserSelect(evt); closeModal(); }}
          onCreateEvent={onCreateEvent}
        />
      ),
    });
  }, [initialResolutionDone, current, eventList, openModal, closeModal, handleUserSelect, onCreateEvent]);

  const onEditEvent = useCallback(() => {
    if (!current) return;
    openModal({
      title: `Edit "${current.name}"`,
      variant: "popup",

      children: (
        <CanopyEventForm
          event={current}
          onRefresh={async () => { await loadEvents(); }}
          onDone={(updated) => {
            if (updated) {
              const merged = { ...current, ...updated } as EventRow;
              handleUserSelect(merged);
            }
            closeModal();
          }}
        />
      ),
    });
  }, [current, openModal, closeModal, handleUserSelect, loadEvents]);

  const handleCopyEvent = useCallback(async () => {
    if (!current) return;
    setCopyingId(String(current.id));
    try {
      const stripeId = user?.id != null ? String(user.id) : undefined;
      const created = await duplicateEvent(String(current.id), stripeId);
      if (!created?.id) throw new Error("Duplication failed — no event returned");
      await loadEvents();
      handleUserSelect(created);
      setNotification({
        active: true, dismissable: true, persistence: 3000,
        list: [{ label: "Event duplicated", message: `"${created.name}" (id: ${created.id})` }],
      });
    } catch (err: any) {
      setNotification({
        active: true, dismissable: true, persistence: 6000,
        apiError: { message: "Duplicate failed", status: 0, detail: err?.message ?? err, error: true },
      });
    } finally {
      setCopyingId(null);
    }
  }, [current, user, duplicateEvent, handleUserSelect, loadEvents, setNotification]);

  // Deletion logic
  const deleteEvent = useCallback(
    async (id?: string) => {
      const targetId = id ?? current?.id;
      if (!targetId) return;

      console.log(`Attempting to delete event with ID: ${targetId}`);

      const label =
        events?.find((e) => String(e.id) === String(targetId))?.name ??
        (current?.id === targetId ? current?.name : undefined) ??
        "this event";

      openModal({
        title: `Delete “${label}”?`,
        confirm: {
          body: "Choose what to remove. ‘Delete event, teams, overlays’ will permanently remove all teams and overlays for this event. This action cannot be undone.",
          statements: [
            { label: "Cancel", variant: "flat", onClick: () => closeModal() },
            {
              label: "Delete event",
              variant: "danger",
              onClick: async () => {
                console.log(`Confirmed delete for event: ${label}`);
                // closeModal();
                setDeletingId(String(targetId));

                // Delete only the event row; DB may cascade depending on FKs
                const ok = await deleteEventOnly(String(targetId));

                if (ok) {
                  console.log(`Event with ID ${targetId} deleted successfully.`);
                  // Update localStorage and clear the current event
                  setCurrent((prev) => {
                    if (String(prev?.id ?? "") === String(targetId)) {
                      setUrlEvent(null);
                      setLsCurrent(null);
                      return null;
                    }
                    return prev;
                  });

                  setNotification({
                    active: true,
                    persistence: 3000,
                    dismissable: true,
                    list: [{ label: "Deleted", message: `"${label}"` }],
                  });


                  // Remove event from localStorage
                  try {
                    let updatedEvents = JSON.parse(localStorage.getItem("events") || "[]");
                    updatedEvents = updatedEvents.filter((event: { id: string }) => event.id !== targetId);
                    localStorage.setItem("events", JSON.stringify(updatedEvents));

                    // Optionally, remove the event individually if stored under another key
                    localStorage.removeItem(`livestream_event:${targetId}`);
                  } catch (e) {
                    console.error("Error removing from localStorage:", e);
                  }

                  if (!events?.length) void loadEvents();
                } else {
                  console.log("Event deletion failed.");
                  setNotification({
                    active: true,
                    persistence: 2200,
                    dismissable: true,
                    list: [{ label: "Delete failed", message: "Could not delete event. Refreshed list." }],
                  });
                  await loadEvents();
                }
                setDeletingId(null);
              },
            },
            {
              label: "Delete event, teams, overlays (permanent)",
              variant: "danger blocky",
              onClick: async () => {
                setDeletingId(String(targetId));
                const ok = await deleteEventDb(String(targetId));
                if (ok) {
                  setCurrent((prev) => {
                    if (String(prev?.id ?? "") === String(targetId)) {
                      setUrlEvent(null);
                      setLsCurrent(null);
                      return null;
                    }
                    return prev;
                  });
                  setNotification({ active: true, persistence: 3000, dismissable: true, list: [{ label: "Deleted", message: `“${label}” and related data were permanently removed.` }] });
                } else {
                  setNotification({ active: true, persistence: 2200, dismissable: true, list: [{ label: "Delete failed", message: "Could not delete event and related data." }] });
                }
                await loadEvents();
                setDeletingId(null);
              },
            },
          ],
        },
      });
    },
    [
      current?.id,
      current?.name,
      events,
      deleteEventDb,
      loadEvents,
      setUrlEvent,
      setLsCurrent,
      openModal,
      closeModal,
      setNotification,
    ]
  );

  // Overlay subscription (fixed: no spam reload loop)
  useEffect(() => {
    if (!current?.id) return;

    const overlayUrl = `${serverUrl}/db/overlay_stream?event_id=${current.id}`;

    let inFlight = false;
    let lastRun = 0;
    const THROTTLE_MS = 2000; // Minimum 2 seconds between fetches to prevent spam

    const unsubscribe = getOverlayStream(String(current.id), overlayUrl, () => {
      const now = Date.now();
      if (inFlight) return;
      if (now - lastRun < THROTTLE_MS) return;

      inFlight = true;
      Promise.resolve(getOverlaysById(String(current.id), { force: true })).finally(() => {
        inFlight = false;
        lastRun = Date.now();
      });
    });

    return () => {
      unsubscribe?.();
    };
  }, [current?.id, getOverlaysById,]);

  if (viewId == "nav")
    return (
      <CanopyProvider eventId={current?.id} prefetchRoster prefetchOverlays>
        <CanopyPanel
          isDock
          current={current}
        />
      </CanopyProvider>
    );
  // if (viewId == 'controls') return <CanopyProvider eventId={current?.id} prefetchRoster prefetchOverlays><CanopyView current={current} view={viewId} /></CanopyProvider>

  return (
    <>
      <style jsx>{styles}</style>
      <CanopyProvider eventId={current?.id} prefetchRoster prefetchOverlays>
        <CanopyShell current={current}>
          {(viewState) => (
            <div className="canopy">
              <div className="canopy__content" >
                <CanopyHeader
                  current={current}
                  title={current ? `Event: ${current.name}` : "No event selected"}
                  currentIsLive={currentIsLive}
                  options={options}
                  onSelect={onSelectEvent}
                  handleToggleLive={handleToggleLive}
                  onCreateEvent={onCreateEvent}
                  onEditEvent={onEditEvent}
                  onCopyEvent={handleCopyEvent}
                  copyingId={copyingId ?? undefined}
                  onRefresh={async () => { await loadEvents(); }}
                  onDelete={(id: string) => { void deleteEvent(id); }}
                  deletingId={deletingId ?? undefined}
                  eventTableData={eventTableData}
                  viewState={viewState}
                />
                <CanopyResizerContent
                  key={`canopy-resizer-${String(current?.id ?? "none")}`}
                  current={current}
                  events={events || []}
                  handleUserSelect={handleUserSelect}
                  deleteEvent={deleteEvent}
                  deletingId={deletingId}
                  loadEvents={loadEvents}
                  isMobile={isMobile}
                  viewId={viewId}
                  viewState={viewState}
                />
              </div>
            </div>
          )}
        </CanopyShell>
      </CanopyProvider>
      <WindowCaptureOverlay />

      <div className="events-panel__build-info">
        Canopy:{buildInfo?.id ? ` ${buildInfo.id} ${buildInfo?.formatted}` : " No build info"}
      </div>
    </>
  );
};

export default Canopy;
