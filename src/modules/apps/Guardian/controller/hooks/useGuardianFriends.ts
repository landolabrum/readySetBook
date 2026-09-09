import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getService } from "@webstack/common";
import IMemberService from "~/src/core/services/MemberService/IMemberService";
import useLocalStorage from "@webstack/hooks/storage/useLocalStorage";
import { IVessel } from "@webstack/components/ThreeComponents/UiMap/models/IMapVessel";
import { buildLookupVessels, dedupeVessels } from "../../utils/vessels";

const FRIENDS_KEY = "guardian:friends";
const SHARE_KEY = "guardian:shareDeviceId";
const normalizeId = (val?: string) => (val ?? "").trim();

const useGuardianFriends = (userId?: string | null) => {
  const memberService = useMemo(() => getService<IMemberService>("IMemberService"), []);
  const { localItem: storedFriends, setLocalItem } = useLocalStorage(FRIENDS_KEY);
  const shareStorage = useLocalStorage(SHARE_KEY);
  const [friends, setFriends] = useState<string[]>([]);
  const [friendNames, setFriendNames] = useState<Record<string, string>>({});
  const [friendVessels, setFriendVessels] = useState<IVessel[]>([]);
  const [loading, setLoading] = useState(false);
  const [shareDeviceId, setShareDeviceId] = useState<string | null>(null);
  const lastSyncRef = useRef(0);

  useEffect(() => {
    if (Array.isArray(storedFriends)) {
      setFriends(
        storedFriends
          .filter((f) => typeof f === "string")
          .map(normalizeId)
          .filter(Boolean)
      );
    }
  }, [storedFriends]);

  useEffect(() => {
    if (typeof shareStorage.localItem === "string") {
      setShareDeviceId(shareStorage.localItem);
    }
  }, [shareStorage.localItem]);

  useEffect(() => {
    if (!shareDeviceId) {
      shareStorage.deleteLocalItem?.(SHARE_KEY);
      return;
    }
    shareStorage.setLocalItem?.(SHARE_KEY, shareDeviceId);
  }, [shareDeviceId, shareStorage]);

  const persistFriends = useCallback(
    (items: string[]) => setLocalItem?.(FRIENDS_KEY, items),
    [setLocalItem]
  );

  const syncFriendsFromServer = useCallback(async () => {
    if (!userId) return;
    const now = Date.now();
    if (now - lastSyncRef.current < 3000) return;
    lastSyncRef.current = now;
    setLoading(true);
    try {
      const res: any = await memberService.listGuardianFriends();
      const rows: any[] = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      const ids = rows
        .map((row) => normalizeId(row?.friendUserId ?? row?.friend_user_id))
        .filter(Boolean);
      setFriends(ids);
      persistFriends(ids);

      const nameMap: Record<string, string> = {};
      rows.forEach((row) => {
        const friendId = row?.friendUserId ?? row?.friend_user_id;
        if (!friendId) return;
        const label =
          row?.alias ??
          row?.name ??
          row?.displayName ??
          row?.display_name ??
          row?.friend_name ??
          friendId;
        nameMap[friendId] = label;
      });
      setFriendNames((prev) => ({ ...prev, ...nameMap }));

      const vesselRows = rows.flatMap((row) => {
        const friendId = row?.friendUserId ?? row?.friend_user_id;
        const displayName = friendId ? nameMap[friendId] ?? friendId : "user";
        return Array.isArray(row?.devices)
          ? row.devices.map((dev: any) => ({
              user_id: friendId ?? row?.user_id ?? row?.userId,
              latitude: dev?.latitude,
              longitude: dev?.longitude,
              device_id: dev?.deviceId ?? dev?.device_id,
              device_label: dev?.deviceLabel ?? dev?.device_label,
              device_type: dev?.deviceType ?? dev?.device_type,
              friend_display_name: displayName,
            }))
          : [];
      });
      setFriendVessels(buildLookupVessels(vesselRows));
    } catch (err) {
      // best-effort sync; keep silent to avoid noisy UI
    } finally {
      setLoading(false);
    }
  }, [memberService, persistFriends, userId]);

  const addFriend = useCallback(
    async (id: string, alias?: string) => {
      const targetId = normalizeId(id);
      if (!targetId) return;
      if (!userId) {
        setFriends((prev) => {
          if (prev.includes(targetId)) return prev;
          const next = [...prev, targetId];
          persistFriends(next);
          return next;
        });
        return;
      }
      await memberService.addGuardianFriend(targetId, alias || targetId);
      await syncFriendsFromServer();
    },
    [memberService, persistFriends, syncFriendsFromServer, userId]
  );

  const removeFriend = useCallback(
    async (id: string) => {
      const targetId = normalizeId(id);
      if (!targetId) return;
      if (userId) {
        try {
          await memberService.removeGuardianFriend(targetId);
        } catch {
          /* ignore */
        }
      }
      setFriends((prev) => {
        const next = prev.filter((fid) => normalizeId(fid) !== targetId);
        persistFriends(next);
        return next;
      });
      setFriendVessels((prev) => prev.filter((v) => (v as any)?.meta?.userId !== targetId));
      setFriendNames((prev) => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
    },
    [memberService, persistFriends, userId]
  );

  const friendNameForId = useCallback(
    (id?: string) => {
      const key = normalizeId(id);
      if (!key) return "";
      return friendNames[key] ?? key;
    },
    [friendNames]
  );

  const allFriendVessels = useMemo(
    () => dedupeVessels(friendVessels),
    [friendVessels]
  );

  return {
    friends,
    friendNames,
    friendVessels: allFriendVessels,
    shareDeviceId,
    setShareDeviceId,
    loading,
    syncFriendsFromServer,
    addFriend,
    removeFriend,
    friendNameForId,
  };
};

export default useGuardianFriends;
