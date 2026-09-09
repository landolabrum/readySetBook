import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getService } from "@webstack/common";
import { useUser } from "~/src/core/authentication/hooks/useUser";
import { useNotification } from "@webstack/components/Notification/Notification";
import IMemberService, {
    GuardianFriend,
    DmMessage,
    DmThread,
    DmParticipant,
    SearchCustomer,
} from "~/src/core/services/MemberService/IMemberService";
import { DM_CACHE_PREFIX, persistUnread, clearDmStorage } from "../utils/dmStorage";

const POLL_MS = 60_000;
const MESSAGE_LIMIT = 50;

// Global guard to ensure only a single polling instance of this hook is active.
let activeDirectMessageInstanceId: number | null = null;

export type ThreadRow = {
    threadId: number;
    title: string;
    lastMessage: string;
    unread: number;
};

const normalizeMessage = (msg: any): DmMessage => {
    return {
        id: msg.id,
        threadId: msg.threadId ?? msg.thread_id,
        senderId: msg.senderId ?? msg.sender_id,
        recipientId: msg.recipientId ?? msg.recipient_id,
        body: msg.body,
        sentAt: msg.sentAt ?? msg.sent_at,
        readAt: msg.readAt ?? msg.read_at,
    } as DmMessage;
};

const mergeMessages = (existing: DmMessage[], incoming: DmMessage[]) => {
    const map = new Map<number, DmMessage>();
    [...existing, ...incoming].forEach((m) => {
        const normalized = normalizeMessage(m);
        map.set(normalized.id, normalized);
    });
    return Array.from(map.values()).sort((a, b) => {
        const aTs = a?.sentAt ? new Date(a.sentAt).getTime() : 0;
        const bTs = b?.sentAt ? new Date(b.sentAt).getTime() : 0;
        return bTs - aTs;
    });
};

export const formatTimestamp = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
};

const readFromStorage = (threadId: number): DmMessage[] => {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(`${DM_CACHE_PREFIX}thread-${threadId}`);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as DmMessage[];
    } catch (err) {
        console.warn("Unable to parse cached messages", err);
    }
    return [];
};

const persistMessages = (threadId: number, messages: DmMessage[]) => {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(`${DM_CACHE_PREFIX}thread-${threadId}`, JSON.stringify(messages));
    } catch (err) {
        console.warn("Unable to persist messages", err);
    }
};

const clearThreadCache = (threadId: number) => {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.removeItem(`${DM_CACHE_PREFIX}thread-${threadId}`);
    } catch (err) {
        console.warn("Unable to clear cached messages", err);
    }
};

export const useDirectMessage = () => {
    const instanceId = useMemo(() => Math.random(), []);
    const isPrimaryRef = useRef(false);
    const [isPrimaryInstance, setIsPrimaryInstance] = useState(false);

    useEffect(() => {
        // Claim primary ownership if none exists; otherwise stay passive to avoid duplicate polling.
        if (activeDirectMessageInstanceId === null) {
            activeDirectMessageInstanceId = instanceId;
            isPrimaryRef.current = true;
            setIsPrimaryInstance(true);
        } else if (activeDirectMessageInstanceId === instanceId) {
            isPrimaryRef.current = true;
            setIsPrimaryInstance(true);
        } else {
            isPrimaryRef.current = false;
            setIsPrimaryInstance(false);
            console.warn("useDirectMessage is already mounted elsewhere; this instance is read-only");
        }

        return () => {
            if (activeDirectMessageInstanceId === instanceId) {
                activeDirectMessageInstanceId = null;
            }
            isPrimaryRef.current = false;
            setIsPrimaryInstance(false);
        };
    }, [instanceId]);

    const memberService = getService<IMemberService>("IMemberService");
    const [, setNotification] = useNotification();
    const user = useUser();
    const viewerId =
        (user as any)?.metadata?.user?.id ||
        (user as any)?.metadata?.user?.customer_id ||
        (user as any)?.customer?.id ||
        (user as any)?.id ||
        (user as any)?.metadata?.user?.email ||
        (user as any)?.email ||
        "";

    const [friends, setFriends] = useState<GuardianFriend[]>([]);
    const [threads, setThreads] = useState<DmThread[]>([]);
    const [participantsByThread, setParticipantsByThread] = useState<Record<number, DmParticipant[]>>({});
    const [followers, setFollowers] = useState<number>(0);
    const [following, setFollowing] = useState<number>(0);
    const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
    const [messagesByFriend, setMessagesByFriend] = useState<Record<number, DmMessage[]>>({});
    const messagesByFriendRef = useRef<Record<number, DmMessage[]>>({});
    const [cursorByFriend, setCursorByFriend] = useState<Record<number, number | null>>({});
    const [dmBusyFriend, setDmBusyFriend] = useState<number | null>(null);
    // Legacy alias so existing handlers keep working while we migrate to threadId terminology
    const selectedFriendId = selectedThreadId;
    const setSelectedFriendId = setSelectedThreadId;
    const [dmBody, setDmBody] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [searchStatus, setSearchStatus] = useState<string | null>(null);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [friendLocation, setFriendLocation] = useState<string>("—");
    const [friendLocationTime, setFriendLocationTime] = useState<string>("—");
    const [loadingFriends, setLoadingFriends] = useState(false);
    const [searchValue, setSearchValue] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<SearchCustomer[]>([]);
    const [searching, setSearching] = useState(false);
    const [participantTerm, setParticipantTerm] = useState("");
    const [participantResults, setParticipantResults] = useState<SearchCustomer[]>([]);
    const [participantSearching, setParticipantSearching] = useState(false);
    const [participantStatus, setParticipantStatus] = useState<string | null>(null);
    const [participantError, setParticipantError] = useState<string | null>(null);
    const [participantsSupported, setParticipantsSupported] = useState(true);
    const pollRef = useRef<number | null>(null);
    const loadingMessagesRef = useRef<Record<number, boolean>>({});
    const initialLoadRef = useRef(false);

    useEffect(() => {
        if (!viewerId) {
            clearDmStorage();
        }
    }, [viewerId]);

    useEffect(() => {
        messagesByFriendRef.current = messagesByFriend;
    }, [messagesByFriend]);

    const resolveCounterpartyId = useCallback(
        (threadId: number): string | null => {
            const thread = threads.find((t) => t.id === threadId);
            if (!thread) return null;

            const threadUserId = (thread as any)?.userId || null;
            const friendId = thread.friendUserId || null;

            if (friendId && friendId !== viewerId) return friendId;
            if (friendId && friendId === viewerId && threadUserId) return threadUserId;

            const participants = thread.participants || [];
            const otherParticipant =
                participants.find((p) => p.userId && p.userId !== viewerId)?.userId ||
                participants[0]?.userId ||
                null;
            if (otherParticipant) return otherParticipant;

            const msgs = messagesByFriendRef.current[threadId] || [];
            for (const msg of msgs) {
                if (msg.senderId && msg.senderId !== viewerId) return msg.senderId;
                if (msg.recipientId && msg.recipientId !== viewerId) return msg.recipientId;
            }

            if (threadUserId && threadUserId !== viewerId) return threadUserId;
            return friendId || threadUserId || null;
        },
        [threads, viewerId]
    );

    const fetchFriends = useCallback(async () => {
        setLoadingFriends(true);
        setError(null);
        try {
            const res = await memberService.listGuardianFriends();
            const rows: GuardianFriend[] = res?.data || [];
            setFriends(rows);
            setFollowers(res?.followers ?? 0);
            setFollowing(res?.following ?? rows.length);
        } catch (err: any) {
            setError(err?.message || "Unable to load friends");
        } finally {
            setLoadingFriends(false);
        }
    }, [memberService]);

    useEffect(() => {
        const term = searchTerm.trim();
        if (term.length < 3) {
            setSearchResults([]);
            setSearching(false);
            return;
        }

        let canceled = false;
        setSearching(true);
        setSearchError(null);
        memberService
            .searchCustomers(term)
            .then((res) => {
                if (canceled) return;
                setSearchResults(res?.data || []);
            })
            .catch((err: any) => {
                if (canceled) return;
                setSearchError(err?.message || "Unable to search");
                setSearchResults([]);
            })
            .finally(() => {
                if (!canceled) setSearching(false);
            });

        return () => {
            canceled = true;
        };
    }, [memberService, searchTerm]);

    useEffect(() => {
        const term = participantTerm.trim();
        if (term.length < 3) {
            setParticipantResults([]);
            setParticipantSearching(false);
            return;
        }

        let canceled = false;
        setParticipantSearching(true);
        setParticipantError(null);
        memberService
            .searchCustomers(term)
            .then((res) => {
                if (canceled) return;
                setParticipantResults(res?.data || []);
            })
            .catch((err: any) => {
                if (canceled) return;
                setParticipantError(err?.message || "Unable to search");
                setParticipantResults([]);
            })
            .finally(() => {
                if (!canceled) setParticipantSearching(false);
            });

        return () => {
            canceled = true;
        };
    }, [memberService, participantTerm]);

    const fetchThreads = useCallback(async () => {
        if (!isPrimaryRef.current) return threads;
        try {
            const res = await memberService.listDmThreads();
            const data: DmThread[] = res?.data || [];
            setThreads(data);

            setMessagesByFriend((prev) => {
                const next = { ...prev } as Record<number, DmMessage[]>;
                data.forEach((t) => {
                    if (!t?.id) return;
                    if (t.lastMessage) {
                        const msg = normalizeMessage(t.lastMessage as any);
                        const existing = next[t.id] || [];
                        next[t.id] = mergeMessages(existing, [msg]);
                    }
                });
                return next;
            });

            if (!selectedThreadId && data.length) {
                setSelectedThreadId(data[0].id);
            }
            return data;
        } catch (err: any) {
            setError(err?.message || "Unable to load message threads");
            return [] as DmThread[];
        }
    }, [memberService, selectedThreadId]);

    const loadMessages = useCallback(
        async (threadId: number, cursor?: number | null, silent?: boolean) => {
            if (!isPrimaryRef.current) return;
            if (!threadId) return;
            if (loadingMessagesRef.current[threadId]) return;
            const targetUserId = resolveCounterpartyId(threadId);
            if (!targetUserId) {
                if (!silent) setDmBusyFriend(null);
                setError("Unable to identify conversation participant");
                return;
            }
            if (!silent) setDmBusyFriend(threadId);
            loadingMessagesRef.current[threadId] = true;
            try {
                const res = await memberService.listDmMessages(
                    targetUserId,
                    cursor || undefined,
                    MESSAGE_LIMIT
                );
                const items: DmMessage[] = (res?.data || []).map(normalizeMessage);
                setCursorByFriend((prev) => ({ ...prev, [threadId]: res?.nextCursor ?? null }));
                setMessagesByFriend((prev) => {
                    const existing = prev[threadId] || readFromStorage(threadId);
                    const merged = mergeMessages(existing, items);
                    persistMessages(threadId, merged);
                    return { ...prev, [threadId]: merged };
                });
            } catch (err: any) {
                if (err?.status === 403) {
                    setError("Friendship required");
                } else {
                    setError(err?.message || "Unable to load messages");
                }
            } finally {
                loadingMessagesRef.current[threadId] = false;
                if (!silent) setDmBusyFriend(null);
            }
        },
        [memberService, resolveCounterpartyId]
    );

    const loadParticipants = useCallback(
        async (threadId: number) => {
            if (!isPrimaryRef.current) return;
            if (!threadId) return;
            if (!participantsSupported) return;
            try {
                const res = await memberService.listDmParticipants(threadId);
                const rows: DmParticipant[] = res?.data || [];
                setParticipantsByThread((prev) => ({ ...prev, [threadId]: rows }));
                setParticipantsSupported(true);
            } catch (err: any) {
                if (err?.status === 404) {
                    // Backend does not support participants yet; avoid noisy errors.
                    setParticipantsSupported(false);
                    return;
                }
                setParticipantError(err?.message || "Unable to load participants");
            }
        },
        [memberService, participantsSupported]
    );

    const addFriend = useCallback(
        async (friendUserId: string, alias?: string) => {
            if (!isPrimaryRef.current) return;
            if (!friendUserId) return;
            setSearchStatus(null);
            setSearchError(null);
            try {
                await memberService.addGuardianFriend(friendUserId, alias);
                setSearchStatus("Friend added");
                setSearchTerm("");
                setSearchResults([]);
                await fetchFriends();
                await fetchThreads();
            } catch (err: any) {
                setSearchError(err?.message || "Unable to add friend");
            }
        },
        [fetchFriends, fetchThreads, memberService]
    );

    const addParticipant = useCallback(
        async (userId: string) => {
            if (!isPrimaryRef.current) return;
            if (!selectedThreadId || !userId) return;
            if (!participantsSupported) {
                setParticipantError("Participants are not supported for this conversation");
                return;
            }
            setParticipantStatus(null);
            setParticipantError(null);
            try {
                const res = await memberService.addDmParticipants(selectedThreadId, [userId]);
                const rows: DmParticipant[] = res?.data || [];
                setParticipantsByThread((prev) => ({ ...prev, [selectedThreadId]: rows }));
                setParticipantStatus("Participant added");
                setParticipantTerm("");
                setParticipantResults([]);
                setNotification({
                    active: true,
                    persistence: 3000,
                    dismissable: true,
                    list: [{ label: "Conversation", message: "Participant added" }],
                });
            } catch (err: any) {
                setParticipantError(err?.message || "Unable to add participant");
            }
        },
        [memberService, selectedThreadId, setNotification]
    );

    const removeParticipant = useCallback(
        async (userId: string) => {
            if (!isPrimaryRef.current) return;
            if (!selectedThreadId || !userId) return;
            if (!participantsSupported) {
                setParticipantError("Participants are not supported for this conversation");
                return;
            }
            setParticipantStatus(null);
            setParticipantError(null);
            try {
                const res = await memberService.removeDmParticipant(selectedThreadId, userId);
                const rows: DmParticipant[] = res?.data || [];
                setParticipantsByThread((prev) => ({ ...prev, [selectedThreadId]: rows }));
                setParticipantStatus("Participant removed");
                setNotification({
                    active: true,
                    persistence: 3000,
                    dismissable: true,
                    list: [{ label: "Conversation", message: "Participant removed" }],
                });
            } catch (err: any) {
                setParticipantError(err?.message || "Unable to remove participant");
            }
        },
        [memberService, selectedThreadId, setNotification]
    );

    const markThreadRead = useCallback(
        async (threadId: number) => {
            if (!isPrimaryRef.current) return;
            if (!viewerId || !threadId) return;
            const targetUserId = resolveCounterpartyId(threadId);
            if (!targetUserId) return;
            const messages = messagesByFriend[threadId] || [];
            const unread = messages.filter((m) => m.recipientId === viewerId && !m.readAt);
            if (!unread.length) return;
            const latestId = Math.max(...unread.map((m) => m.id));
            try {
                await memberService.markDmRead(targetUserId, latestId);
                const now = new Date().toISOString();
                const updated = messages.map((m) =>
                    m.recipientId === viewerId && !m.readAt ? { ...m, readAt: now } : m
                );
                setMessagesByFriend((prev) => ({ ...prev, [threadId]: updated }));
                persistMessages(threadId, updated);
            } catch (err: any) {
                setError(err?.message || "Unable to mark messages read");
            }
        },
        [memberService, messagesByFriend, viewerId]
    );

    useEffect(() => {
        if (!isPrimaryInstance) return;
        fetchFriends();
    }, [fetchFriends, isPrimaryInstance]);

    useEffect(() => {
        if (!isPrimaryInstance) return;
        if (initialLoadRef.current) return;
        initialLoadRef.current = true;

        const shouldPoll = () =>
            typeof document === "undefined" ? true : document.visibilityState === "visible";

        const run = async () => {
            if (!shouldPoll()) return;
            const data = await fetchThreads();
            const targetId =
                selectedThreadId || data.find((t) => typeof t?.id === "number" && Number.isFinite(t.id))?.id;
            if (targetId) {
                await loadMessages(targetId, undefined, true);
            }
        };

        run();

        return () => {
            if (pollRef.current) window.clearInterval(pollRef.current);
        };
    }, [fetchThreads, isPrimaryInstance, loadMessages, selectedThreadId]);

    useEffect(() => {
        if (!isPrimaryInstance) return;
        if (!selectedThreadId) return;
        const cached = readFromStorage(selectedThreadId);
        if (cached.length) {
            setMessagesByFriend((prev) => ({ ...prev, [selectedThreadId]: cached }));
        }
        loadMessages(selectedThreadId);
        loadParticipants(selectedThreadId);
    }, [isPrimaryInstance, loadMessages, loadParticipants, selectedThreadId]);

    const selectedThread = useMemo(
        () => threads.find((t) => t.id === selectedThreadId) || null,
        [threads, selectedThreadId]
    );

    useEffect(() => {
        if (!isPrimaryInstance || !selectedThreadId) {
            setFriendLocation("—");
            setFriendLocationTime("—");
            return;
        }

        let canceled = false;
        const loadLocation = async () => {
            try {
                const targetUserId = resolveCounterpartyId(selectedThreadId);
                if (!targetUserId) {
                    if (!canceled) {
                        setFriendLocation("—");
                        setFriendLocationTime("—");
                    }
                    return;
                }

                const res = await memberService.getUserLocation(targetUserId);
                const rows = Array.isArray(res?.data)
                    ? res.data
                    : Array.isArray(res)
                        ? res
                        : res?.data
                            ? [res.data]
                            : [];
                if (!rows.length) {
                    if (!canceled) {
                        setFriendLocation("—");
                        setFriendLocationTime("—");
                    }
                    return;
                }

                const latest = rows.reduce((acc: any, row: any) => {
                    if (!row) return acc;
                    const ts = row.timestamp || row.recorded_at || row.recordedAt || 0;
                    if (!acc) return row;
                    const accTs = acc.timestamp || acc.recorded_at || acc.recordedAt || 0;
                    return ts >= accTs ? row : acc;
                }, null as any);

                const lat = Number(latest?.latitude ?? latest?.lat);
                const lng = Number(latest?.longitude ?? latest?.lng);
                const tsRaw =
                    latest?.timestamp ??
                    latest?.recorded_at ??
                    latest?.recordedAt ??
                    latest?.createdAt ??
                    latest?.updatedAt;

                const normalizeDate = (value: any) => {
                    if (value === undefined || value === null) return null;
                    if (typeof value === "number") {
                        const num = Number(value);
                        const millis = num > 1e12 ? num : num * 1000;
                        const d = new Date(millis);
                        return Number.isNaN(d.getTime()) ? null : d;
                    }
                    if (typeof value === "string") {
                        const asNum = Number(value);
                        if (Number.isFinite(asNum)) {
                            const millis = asNum > 1e12 ? asNum : asNum * 1000;
                            const dNum = new Date(millis);
                            if (!Number.isNaN(dNum.getTime())) return dNum;
                        }
                        const dStr = new Date(value);
                        return Number.isNaN(dStr.getTime()) ? null : dStr;
                    }
                    return null;
                };

                const tsDate = normalizeDate(tsRaw);

                if (Number.isFinite(lat) && Number.isFinite(lng)) {
                    if (!canceled) setFriendLocation(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
                } else if (!canceled) {
                    setFriendLocation("—");
                }

                if (!canceled) {
                    setFriendLocationTime(tsDate ? tsDate.toLocaleString() : "—");
                }
            } catch (err) {
                if (!canceled) {
                    setFriendLocation("—");
                    setFriendLocationTime("—");
                }
            }
        };

        loadLocation();
        return () => {
            canceled = true;
        };
    }, [isPrimaryInstance, memberService, resolveCounterpartyId, selectedThreadId]);

    const unreadByFriend = useMemo(() => {
        const result: Record<number, number> = {};
        Object.entries(messagesByFriend).forEach(([threadKey, msgs]) => {
            const threadId = Number(threadKey);
            result[threadId] = msgs.filter((m) => m.recipientId === viewerId && !m.readAt).length;
        });
        return result;
    }, [messagesByFriend, viewerId]);

    const totalUnread = useMemo(
        () => Object.values(unreadByFriend).reduce((acc, val) => acc + val, 0),
        [unreadByFriend]
    );

    const friendlyLabel = useCallback(
        (userId: string) => {
            if (userId === viewerId) {
                const nameParts = [(user as any)?.first_name, (user as any)?.last_name]
                    .filter(Boolean)
                    .join(" ")
                    .trim();
                return nameParts || (user as any)?.name || (user as any)?.email || userId;
            }
            const friend = friends.find((f) => f.friendUserId === userId);
            const participant = Object.values(participantsByThread)
                .flat()
                .find((p) => p.userId === userId);
            return (
                participant?.alias ||
                participant?.name ||
                participant?.email ||
                friend?.alias ||
                friend?.friendUserId ||
                userId
            );
        },
        [friends, participantsByThread, user, viewerId]
    );

    const prevUnreadRef = useRef<number>(0);

    useEffect(() => {
        if (totalUnread > prevUnreadRef.current) {
            const allMsgs = Object.values(messagesByFriend).flat();
            const unreadMsgs = allMsgs.filter((m) => m.recipientId === viewerId && !m.readAt);
            const latest = unreadMsgs.sort((a, b) => {
                const aTs = a.sentAt ? new Date(a.sentAt).getTime() : 0;
                const bTs = b.sentAt ? new Date(b.sentAt).getTime() : 0;
                return bTs - aTs;
            })[0];
            if (latest) {
                const label = friendlyLabel(latest.senderId);
                setNotification({
                    active: true,
                    persistence: 4000,
                    dismissable: true,
                    list: [{ label, message: latest.body }],
                });
            }
        }
        prevUnreadRef.current = totalUnread;
    }, [friendlyLabel, messagesByFriend, setNotification, totalUnread, viewerId]);

    useEffect(() => {
        persistUnread(totalUnread);
    }, [totalUnread]);

    const messagesForSelected = useMemo(
        () => (selectedThreadId ? messagesByFriend[selectedThreadId] || [] : []),
        [messagesByFriend, selectedThreadId]
    );

    const participantsForSelected = useMemo(
        () => (selectedThreadId ? participantsByThread[selectedThreadId] || [] : []),
        [participantsByThread, selectedThreadId]
    );

    const memberCellData = useCallback(
        (userId: string) => {
            const label = friendlyLabel(userId);
            const email = userId === viewerId ? (user as any)?.email || userId : userId;
            return { name: label, id: userId, email };
        },
        [friendlyLabel, user, viewerId]
    );

    const threadRows: ThreadRow[] = useMemo(() => {
        return threads.map((t) => {
            const unread = unreadByFriend[t.id] || 0;
            const cached = messagesByFriend[t.id] || [];
            const latest = cached[0];
            const participantList = participantsByThread[t.id] || t.participants || [];
            const inferredIds = new Set<string>();
            participantList.forEach((p) => p.userId && inferredIds.add(p.userId));
            if (t.friendUserId) inferredIds.add(t.friendUserId);
            if (latest?.senderId) inferredIds.add(latest.senderId);
            if (latest?.recipientId) inferredIds.add(latest.recipientId);

            const friendlyNames = Array.from(inferredIds)
                .filter((uid) => uid !== viewerId)
                .map((uid) => friendlyLabel(uid))
                .filter(Boolean)
                .join(", ");

            const title = t.name || friendlyNames || t.friendUserId || "Conversation";
            return {
                threadId: t.id,
                title,
                lastMessage: latest?.body || "",
                unread,
            };
        });
    }, [friendlyLabel, messagesByFriend, participantsByThread, threads, unreadByFriend, viewerId]);

    const handleSelectThread = useCallback((threadId: number) => {
        setSelectedThreadId(threadId);
        setStatus(null);
    }, []);

    const handleSendDm = useCallback(async () => {
        if (!isPrimaryRef.current) return;
        if (!selectedThreadId || !dmBody.trim()) return;
        const targetUserId = resolveCounterpartyId(selectedThreadId);
        if (!targetUserId) {
            setError("Friendship required to send messages");
            return;
        }
        setError(null);
        setDmBusyFriend(selectedThreadId);
        try {
            const res = await memberService.sendDm(targetUserId, dmBody.trim());
            const msg: DmMessage | undefined = res?.data;
            if (msg) {
                setMessagesByFriend((prev) => {
                    const existing = prev[selectedThreadId] || [];
                    const merged = mergeMessages(existing, [msg]);
                    persistMessages(selectedThreadId, merged);
                    return { ...prev, [selectedThreadId]: merged };
                });
                setDmBody("");
                setStatus("Message sent");
            }
        } catch (err: any) {
            setError(err?.message || "Unable to send message");
        } finally {
            setDmBusyFriend(null);
        }
    }, [dmBody, memberService, selectedThreadId]);

    const removeConversation = useCallback(
        async (threadId: number) => {
            if (!threadId) return;
            // Purely client-side pruning; backend lacks thread delete.
            setThreads((prev) => prev.filter((t) => t.id !== threadId));
            setMessagesByFriend((prev) => {
                const next = { ...prev } as Record<number, DmMessage[]>;
                delete next[threadId];
                return next;
            });
            setParticipantsByThread((prev) => {
                const next = { ...prev } as Record<number, DmParticipant[]>;
                delete next[threadId];
                return next;
            });
            setCursorByFriend((prev) => {
                const next = { ...prev } as Record<number, number | null>;
                delete next[threadId];
                return next;
            });
            clearThreadCache(threadId);
            if (selectedThreadId === threadId) {
                setSelectedThreadId(null);
            }
        },
        [selectedThreadId]
    );

    const removeFriend = useCallback(
        async (friendUserId?: string | null, threadId?: number) => {
            const targetUserId = (friendUserId || (threadId ? resolveCounterpartyId(threadId) : null) || "").trim();
            if (!targetUserId) return;
            try {
                await memberService.removeGuardianFriend(targetUserId);
            } catch {
                // Non-fatal; continue client cleanup
            }

            setFriends((prev) => prev.filter((f) => f.friendUserId !== targetUserId));

            setThreads((prev) => prev.filter((t) => t.friendUserId !== targetUserId));

            const affectedThreadIds = new Set<number>();
            threads.forEach((t) => {
                if (t.friendUserId === targetUserId && typeof t.id === "number") {
                    affectedThreadIds.add(t.id);
                }
            });
            if (threadId) affectedThreadIds.add(threadId);

            if (affectedThreadIds.size) {
                setMessagesByFriend((prev) => {
                    const next = { ...prev } as Record<number, DmMessage[]>;
                    affectedThreadIds.forEach((id) => delete next[id]);
                    return next;
                });
                setParticipantsByThread((prev) => {
                    const next = { ...prev } as Record<number, DmParticipant[]>;
                    affectedThreadIds.forEach((id) => delete next[id]);
                    return next;
                });
                setCursorByFriend((prev) => {
                    const next = { ...prev } as Record<number, number | null>;
                    affectedThreadIds.forEach((id) => delete next[id]);
                    return next;
                });
                affectedThreadIds.forEach((id) => clearThreadCache(id));
                if (selectedThreadId && affectedThreadIds.has(selectedThreadId)) {
                    setSelectedThreadId(null);
                }
            }
            setStatus("Friend removed");
        },
        [memberService, resolveCounterpartyId, selectedThreadId, threads]
    );

    const handleLoadMore = useCallback(() => {
        if (!selectedThreadId) return;
        const cursor = cursorByFriend[selectedThreadId];
        if (!cursor) return;
        loadMessages(selectedThreadId, cursor);
    }, [cursorByFriend, loadMessages, selectedThreadId]);

    const hasMoreMessages = useMemo(
        () => (selectedThreadId ? Boolean(cursorByFriend[selectedThreadId]) : false),
        [cursorByFriend, selectedThreadId]
    );

    return {
        addFriend,
        removeFriend,
        removeConversation,
        dmBody,
        dmBusyFriend,
        error,
        followers,
        friendLocation,
        friendLocationTime,
        friendlyLabel,
        handleLoadMore,
        handleSelectFriend: handleSelectThread,
        handleSendDm,
        hasMoreMessages,
        loadingFriends,
        markThreadRead,
        memberCellData,
        messagesForSelected,
        participants: participantsForSelected,
        participantTerm,
        participantResults,
        participantSearching,
        participantStatus,
        participantError,
        setParticipantTerm,
        addParticipant,
        removeParticipant,
        searchError,
        searchResults,
        searchStatus,
        searchTerm,
        searching,
        searchValue,
        selectedFriend: selectedThread,
        selectedFriendId: selectedThreadId,
        setDmBody,
        setSearchTerm,
        setSearchValue,
        status,
        following,
        threadRows,
        totalUnread,
        unreadByFriend,
        viewerId,
    };
};

export type UseDirectMessageReturn = ReturnType<typeof useDirectMessage>;