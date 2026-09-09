import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";
import UiInput from "@webstack/components/UiForm/components/UiInput/controller/UiInput";
import AdapTable, { TableOptions } from "@webstack/components/AdapTable/views/AdapTable";
import { getService } from "@webstack/common";
import IMemberService, { GuardianFriend, GuardianFriendDevice, SearchCustomer } from "~/src/core/services/MemberService/IMemberService";
import styles from "./UserSocial.scss";

const MIN_SEARCH = 6;
const SEARCH_DELAY_MS = 3000;

const normalizeDevice = (devices?: GuardianFriendDevice[]) => {
    if (!devices || !devices.length) return { deviceLabel: "—", lastLocation: "—", recordedAt: "" };
    const primary = devices[0];
    const coords =
        primary.latitude !== undefined && primary.longitude !== undefined
            ? `${primary.latitude}, ${primary.longitude}`
            : "—";
    return {
        deviceLabel: primary.deviceLabel || primary.deviceId,
        lastLocation: coords,
        recordedAt: primary.recordedAt || "",
    };
};

const UserSocial: React.FC = () => {
    const memberService = getService<IMemberService>("IMemberService");
    const [friends, setFriends] = useState<GuardianFriend[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [inputValue, setInputValue] = useState<string>("");
    const [aliasValue, setAliasValue] = useState<string>("");
    const [searchResults, setSearchResults] = useState<SearchCustomer[]>([]);
    const [followers, setFollowers] = useState(0);
    const [following, setFollowing] = useState(0);
    const [search, setSearch] = useState<string>("");
    const timerRef = useRef<number | null>(null);
    const [searchReady, setSearchReady] = useState(false);
    const [adding, setAdding] = useState(false);

    const fetchFriends = useCallback(async () => {
        setLoading(true);
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
            setLoading(false);
        }
    }, [memberService]);

    useEffect(() => {
        fetchFriends();
    }, [fetchFriends]);

    useEffect(() => {
        if (timerRef.current) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        const trimmed = inputValue.trim();
        setSearchReady(false);

        if (!trimmed) {
            setSearch("");
            return undefined;
        }

        if (trimmed.length < MIN_SEARCH) {
            setSearch("");
            return undefined;
        }

        timerRef.current = window.setTimeout(() => {
            setSearch(trimmed);
            setSearchReady(true);
            timerRef.current = null;
        }, SEARCH_DELAY_MS);

        return () => {
            if (timerRef.current) {
                window.clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [inputValue]);

    const handleAdd = useCallback(async (friendOverride?: string, aliasOverride?: string) => {
        const trimmed = (friendOverride || search).trim();
        const allow = friendOverride ? trimmed.length >= MIN_SEARCH : searchReady;
        if (!trimmed || !allow || trimmed.length < MIN_SEARCH) return;
        setAdding(true);
        setError(null);
        setStatus(null);
        try {
            const alias = (aliasOverride || aliasValue || "").trim() || undefined;
            const res = await memberService.addGuardianFriend(trimmed, alias);
            await fetchFriends();
            setInputValue("");
            setSearch("");
            setSearchReady(false);
            setAliasValue("");
            setStatus("Friend added");
            if (res?.followers !== undefined) setFollowers(res.followers);
            if (res?.following !== undefined) setFollowing(res.following);
        } catch (err: any) {
            setError(err?.message || "Unable to add friend");
        } finally {
            setAdding(false);
        }
    }, [aliasValue, fetchFriends, memberService, search, searchReady]);

    const handleRemove = useCallback(
        async (friendUserId: string) => {
            setError(null);
            try {
                const res = await memberService.removeGuardianFriend(friendUserId);
                await fetchFriends();
                if (res?.followers !== undefined) setFollowers(res.followers);
                if (res?.following !== undefined) setFollowing(res.following);
            } catch (err: any) {
                setError(err?.message || "Unable to remove friend");
            }
        },
        [fetchFriends, memberService]
    );

    const rows = useMemo(() => {
        const filtered = search
            ? friends.filter((f) => {
                const q = search.toLowerCase();
                return (
                    f.friendUserId?.toLowerCase().includes(q) ||
                    (f.alias || "").toLowerCase().includes(q)
                );
            })
            : friends;

        return filtered.map((f) => {
            const device = normalizeDevice(f.devices);
            return {
                friendUserId: f.friendUserId,
                alias: f.alias || "—",
                deviceLabel: device.deviceLabel,
                lastLocation: device.lastLocation,
                recordedAt: device.recordedAt,
                actions: f.friendUserId,
            };
        });
    }, [friends, search]);

    const tableOptions: TableOptions = {
        tableTitle: "Friendships",
        hideColumns: ["recordedAt"],
        renderCell: (key, item) => {
            if (key === "actions") {
                return (
                    <UiButton variant="danger" onClick={() => handleRemove(item.actions)}>
                        Remove
                    </UiButton>
                );
            }
            return undefined;
        },
    };

    useEffect(() => {
        const term = search.trim();
        if (!searchReady || term.length < MIN_SEARCH) {
            setSearchResults([]);
            return;
        }
        let cancelled = false;
        memberService
            .searchCustomers(term)
            .then((res) => {
                if (cancelled) return;
                setSearchResults(res?.data || []);
            })
            .catch((err: any) => {
                if (cancelled) return;
                setError(err?.message || "Unable to search");
                setSearchResults([]);
            });
        return () => {
            cancelled = true;
        };
    }, [memberService, search, searchReady]);

    return (
        <>
            <style jsx>{styles}</style>
            <div className="user-social">
                <div className="user-social__actions">
                    <UiInput
                        label="Find or add friend"
                        placeholder="Enter name, email, or customer id"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        traits={{ afterIcon: "fa-user-plus" }}
                    />
                    <UiInput
                        label="Alias (optional)"
                        placeholder="How you want to label them"
                        value={aliasValue}
                        onChange={(e) => setAliasValue(e.target.value)}
                        traits={{}}
                    />
                    <UiButton
                        onClick={() => handleAdd()}
                        disabled={adding || !searchReady || search.trim().length < MIN_SEARCH}
                        busy={adding}
                    >
                        Add friend
                    </UiButton>
                    {error && <div className="user-social__error">{error}</div>}
                    {!error && status && <div className="user-social__status">{status}</div>}
                </div>

                <div className="user-social__counts">Following: {following} · Followers: {followers}</div>

                {searchResults.length > 0 && (
                    <div className="user-social__search-results">
                        <div className="user-social__search-title">Search results</div>
                        {searchResults.map((r) => (
                            <div key={r.id} className="user-social__search-row">
                                <div className="user-social__search-main">
                                    <div className="user-social__search-name">{r.name || r.email || r.id}</div>
                                    <div className="user-social__search-meta">{r.email}</div>
                                    <div className="user-social__search-meta">{r.id}</div>
                                </div>
                                <UiButton onClick={() => handleAdd(r.id, r.name || r.email || undefined)} busy={adding}>
                                    Add
                                </UiButton>
                            </div>
                        ))}
                    </div>
                )}

                <AdapTable
                    data={rows}
                    loading={loading}
                    search={search}
                    onRowClick={undefined}
                    options={tableOptions}
                />
                <div className="user-social__dm">
                    <div className="user-social__dm-header">Direct messages have moved.</div>
                    <div className="user-social__dm-compose">
                        <div>Open the dedicated Direct page to read and send messages.</div>
                        <Link href="/direct">
                            <UiButton variant="primary">Go to Direct</UiButton>
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
};

export default UserSocial;
