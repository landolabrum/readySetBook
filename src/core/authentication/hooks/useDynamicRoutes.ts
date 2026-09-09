import { getService } from "@webstack/common";
import { useEffect, useState } from "react";
import { Subscription } from "rxjs";
import IMemberService, { IDynamicRoute } from "../../services/MemberService/IMemberService";

export const useDynamicRoutes = (): IDynamicRoute[] => {
  const MemberService = getService<IMemberService>("IMemberService");
  const [routes, setRoutes] = useState<IDynamicRoute[]>(() => MemberService.getMemberRoutes());

  useEffect(() => {
    const subs: Subscription[] = [];
    subs.push(
      MemberService.userChanged.subscribe(() => {
        setRoutes(MemberService.getMemberRoutes());
      }),
    );
    return () => { subs.forEach((s) => s.unsubscribe()); };
  }, [MemberService.userChanged]);

  return routes;
};

export default useDynamicRoutes;
