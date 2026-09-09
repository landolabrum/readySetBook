import { IDynamicRoute } from "~/src/core/services/MemberService/IMemberService";
import { IButton } from "@webstack/components/UiForm/components/UiButton/UiButton";

export function routesToButtons(
  routes: IDynamicRoute[] | undefined | null,
  onNavigate: (href?: string | null) => void,
  onModal?: (key: string) => void,
): IButton[] {
  const out: IButton[] = [];
  const walk = (nodes: IDynamicRoute[] | undefined | null) => {
    if (!Array.isArray(nodes) || !nodes.length) return;
    const sorted = [...nodes].sort(
      (a, b) => (a?.sort_order ?? 0) - (b?.sort_order ?? 0),
    );
    for (const r of sorted) {
      if (!r || r.hide) continue;
      const hasLeaf = !!(r.href || r.modal);
      if (hasLeaf) {
        const name = (r.href || r.modal || r.label || '') as string;
        const btn: IButton = {
          name,
          label: r.label || r.href || '',
          traits: r.icon ? { beforeIcon: r.icon } : undefined,
          onClick: r.modal && onModal ? () => onModal(r.modal as string) : () => onNavigate(r.href),
        };
        out.push(btn);
      }
      const kids = r.items ?? r.children;
      if (Array.isArray(kids) && kids.length) walk(kids);
    }
  };
  walk(routes || []);
  return out;
}

export default routesToButtons;
