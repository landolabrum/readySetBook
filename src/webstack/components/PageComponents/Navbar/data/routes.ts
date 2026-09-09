

import keyStringConverter from "@webstack/helpers/keyStringConverter";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "~/src/core/authentication/hooks/useUser";
import { useDynamicRoutes } from "~/src/core/authentication/hooks/useDynamicRoutes";
import { IDynamicRoute } from "~/src/core/services/MemberService/IMemberService";
import environment from "~/src/core/environment";
import { DM_UNREAD_KEY, clearDmStorage } from "~/src/modules/direct/utils/dmStorage";

export type SelectableRoute = {
  href?: string;
  icon?: string;
  label?: string;
  active?: boolean;
  clearance?: number;
  badge?: string | number;
  // Optional alt text or secondary display label for menu items
  alt?: string;
  // Merchant identifier scoping support (single or multiple merchants)
  mid?: string | string[];
  // Optional value to interop cleanly with UiMenu when present
  value?: string;
  // Optional modal key for menu-driven routes
  modal?: string;
  // Nested menu items for hierarchical navigation
  items?: SelectableRoute[];
};

export interface IRoute extends HandleRouteProps {
  icon?: string;
  hide?: boolean;
  clearance?: number;

  badge?: string | number;
  label?: string;
  active?: boolean;
  altLabel?: string;
  altIcon?: string;
  // Merchant identifier scoping support (single or multiple merchants)
  mid?: string | string[];
}

export interface HandleRouteProps {
  href?: string;
  modal?: string;
  items?: SelectableRoute[] | undefined;
  active?: boolean;
}

const useDmUnread = () => {
  const [count, setCount] = useState<number>(0);
  const authedUser = useUser();

  useEffect(() => {
    const read = () => {
      if (typeof window === "undefined") return;
      const raw = window.localStorage.getItem(DM_UNREAD_KEY);
      const next = raw ? Number(raw) : 0;
      setCount(Number.isFinite(next) ? next : 0);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== DM_UNREAD_KEY) return;
      read();
    };

    if (!authedUser) {
      clearDmStorage();
      setCount(0);
      return undefined;
    }

    read();
    window.addEventListener("storage", handleStorage);
    const poll = window.setInterval(read, 15000);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.clearInterval(poll);
    };
  }, [authedUser]);

  return count;
};

const merchantName = environment.merchant?.name || 'deepturn';
const currentMid = environment.merchant?.mid;

export const routes: IRoute[] = [
  { href: "/captures/", hide: true },
  { href: "/payment", hide: true },
  { href: "/location", hide: true, mid: "mb1" },
  { href: "/live", hide: true, },
  { href: "/pipeline", hide: true, },
  { href: "/gps", hide: true },
  { href: "/verify", hide: true },
  { href: "/transaction", hide: true },
  { href: "/build", hide: true },

  {
    label: keyStringConverter(merchantName),
    icon: `${keyStringConverter(merchantName,{dashed: true})}-logo`,
    href: "/",
  },
  {
    label: currentMid=='nirv1'?"services":'products',
    href: "/services",
    icon: "fa-tags",
  },




  { modal: 'contact', label: "contact", altLabel: "contact", icon: "fa-circle-phone-flip", mid: "nirv1" },
  // { label: "stream", href: "/stream", icon: "fa-tags", hide: true },
  // App links now live under /app/<name>; keep menu paths in sync with /app router.
  {
    label: "Services",
    icon: "fa-handshake",
    href: "/services",
    hide: true,
  },
  {
    label: "downloads",
    icon: "fa-download",
    href: "/download",
    mid:"mb1",
  },
  { href: "/feed", label:"feed", icon: "fa-satellite-dish", mid: ["xi1", "mb1"] },
  {
    label: "apps",
    mid: ["xi1", "mb1"],

    icon: "fa-app-store",
    // clearance: environment?.isProduction ? 1 : undefined,
    items: [
      { href: "/app/pipeline", label: "pipeline", icon: "fa-wave-square", mid: ["xi1", "mb1"] },
      { href: "/feed", label: "Live Feed", icon: "fa-satellite-dish", mid: ["xi1", "mb1"] },
      { href: "/app/guardian", label: "Guardian", icon: "fa-shield", mid: ["xi1", "mb1"] },
      { href: "/app/obscure", label: "Obscure", icon: "obs-logo", mid: ["xi1", "mb1"] },
      {
        href: "/app/ytl", label: "Youtube Downloader", icon: "fa-youtube",
        mid: ["xi1", "mb1"]
      },
    ],
  },
  {
    label: "profile",
    icon: "fal-circle-user",

    // icon: "fal-circle-user",
    clearance: 1,
    items: [],
  },
  { href: "/authentication", label: "auth", hide: true },
  { href: "/3d", label: "3d", hide: true },
  {
    label: "login",
    modal: "login",
    icon: "fa-circle-user",
    clearance: 0,
  },
  { label: "", href: "/cart", icon: "fal-bag-shopping" },
  { label: "", href: "/checkout", hide: true },
  { label: "", href: "/social", hide: true },

  { label: "", href: "/privacy-policy", hide: true, active: true },
  { label: "", href: "/terms-of-service", hide: true, active: true },
];
export const useClearanceRoutes = () => {
  const authedUser = useUser();
  const level = authedUser?.metadata?.user?.clearance || 0;
  const merchantMid = environment.merchant?.mid;
  const dmUnread = useDmUnread();
  const dynamicRoutes = useDynamicRoutes();

  const access = useMemo(() => {
    const dynamicToRoute = (r: IDynamicRoute): IRoute => {
      const kids = (r.items || r.children || []) as IDynamicRoute[];
      const items = kids.map(dynamicToRoute) as unknown as SelectableRoute[];
      return {
        href: r.href || undefined,
        modal: r.modal || undefined,
        label: r.label || undefined,
        altLabel: r.altLabel || undefined,
        icon: r.icon || undefined,
        clearance: r.clearance,
        mid: (r.mid as any) || undefined,
        hide: r.hide || undefined,
        badge: (r.badge as any) || undefined,
        items: items.length ? items : undefined,
      };
    };

    // Backend already filtered by clearance + merchant; convert + merge into static tree.
    const dynamic: IRoute[] = (dynamicRoutes || []).map(dynamicToRoute);
    const mergedRoutes: IRoute[] = routes.map((staticRoute) => {
      if (!staticRoute.label) return staticRoute;
      const match = dynamic.find((d) => d.label && staticRoute.label && d.label === staticRoute.label);
      if (!match) return staticRoute;
      const staticItems = (staticRoute.items || []) as SelectableRoute[];
      const dynItems = (match.items || []) as SelectableRoute[];
      return { ...staticRoute, items: [...staticItems, ...dynItems] };
    });
    // Dynamic top-level entries (no matching static label) get appended.
    const remainingDynamic = dynamic.filter((d) => {
      if (!d.label) return true;
      return !routes.some((s) => s.label === d.label);
    });
    const allRoutes = [...mergedRoutes, ...remainingDynamic];
    const filterSelectableRoute = (item: SelectableRoute): SelectableRoute | null => {
      if (item.mid) {
        if (typeof item.mid === "string") {
          if (item.mid !== merchantMid) return null;
        } else if (Array.isArray(item.mid)) {
          if (!merchantMid || !item.mid.includes(merchantMid)) return null;
        }
      }

      if (item.clearance !== undefined && level < item.clearance) return null;

      const childItems = item.items
        ?.map(filterSelectableRoute)
        .filter((child): child is SelectableRoute => child !== null);

      return {
        ...item,
        items: childItems && childItems.length ? childItems : undefined,
      };
    };

    const filtered = allRoutes
      .filter((route) => {
        // Exclude if mid mismatch
        if (route.mid) {
          if (typeof route.mid === 'string') {
            if (route.mid !== merchantMid) return false;
          } else if (Array.isArray(route.mid)) {
            if (!merchantMid || !route.mid.includes(merchantMid)) return false;
          }
        }

        // Exclude if hide is explicitly true
        // if (route.hide) return false;

        // Hide login if user is authed
        if (route.label === "login" && authedUser) return false;

        // Exclude if clearance is too high
        if (route.clearance !== undefined && level < route.clearance) return false;

        return true;
      })
      .map((route) => {
        // Recursively apply same logic to sub-items, including merchant mid scoping
        const items = route.items
          ?.map(filterSelectableRoute)
          .filter((item): item is SelectableRoute => item !== null);
        const badge = route.href === "/direct" ? (dmUnread || undefined) : route.badge;
        return { ...route, items, badge };
      })
      .sort((a, b) => {
        const lastLabels = ["login", "profile"];
        const aIndex = a.label && lastLabels.includes(a.label) ? lastLabels.indexOf(a.label) : a.href === "/cart" ? lastLabels.length : -1;
        const bIndex = b.label && lastLabels.includes(b.label) ? lastLabels.indexOf(b.label) : b.href === "/cart" ? lastLabels.length : -1;

        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return 1;
        if (bIndex !== -1) return -1;
        return 0;
      });

    return filtered.reverse();
  }, [authedUser, level, merchantMid, dmUnread, dynamicRoutes]);

  return access;
};


export const pruneRoutes = (pruneLabels: string[]) => {
  const pruned: IRoute[] = [];

  routes.forEach((item) => {
    const hasMatchingMerchant =
      !item.mid ||
      (typeof item.mid === 'string'
        ? item.mid === currentMid
        : Array.isArray(item.mid)
          ? !!currentMid && item.mid.includes(currentMid)
          : false);
    const isNotPrunedByLabel = item.label === undefined || !pruneLabels.includes(item.label);

    if (hasMatchingMerchant && isNotPrunedByLabel) {
      if (item.items && item.label) {
        // When flattening labeled groups, respect child item merchant scoping
        const scoped = item.items.filter((sub) =>
          !sub.mid ||
          (typeof sub.mid === 'string'
            ? sub.mid === currentMid
            : Array.isArray(sub.mid)
              ? !!currentMid && sub.mid.includes(currentMid)
              : false)
        );
        pruned.push(...scoped);
      } else {
        pruned.push(item);
      }
    }
  });

  return pruned;
};
