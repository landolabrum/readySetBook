import { useCallback, useMemo, useState } from "react";
import { getService } from "@webstack/common";
import { useModal } from "@webstack/components/Containers/modal/contexts/modalContext";
import useProfile from "@/core/authentication/hooks/useProfile";
import IPaywallService from "@/core/services/PaywallService/IPaywallService";
import { PaywallRequirement, PaywallState } from "./types";
import PaywallModal from "./PaywallModal";

interface EnforceOptions {
  openModalOnBlock?: boolean;
}

const buildInitialState = (requiresPaywall?: boolean): PaywallState => ({
  status: requiresPaywall ? "idle" : "allowed",
  allowed: !requiresPaywall,
  matches: [],
});

const usePaywall = (requirement: PaywallRequirement) => {
  const paywallService = useMemo(
    () => getService<IPaywallService>("IPaywallService"),
    []
  );
  const profile = useProfile();
  const { openModal, replaceModal, isModalOpen } = useModal();
  const [state, setState] = useState<PaywallState>(
    buildInitialState(requirement?.requiresPaywall)
  );

  const customerId = profile?.id;
  const hasIds = Boolean(requirement?.stripePriceId || requirement?.stripeProductId);
  const missingConfig = Boolean(requirement?.requiresPaywall) && !hasIds;

  const presentPaywallModal = useCallback(() => {
    if (!requirement?.requiresPaywall) return;
    const modalPayload = {
      title: "Unlock access",
      children: (
        <PaywallModal
          requirement={requirement}
          customerId={customerId}
          missingConfig={missingConfig}
        />
      ),
      dismissable: true,
      variant: "fullscreen" as const,
    };
    if (isModalOpen) replaceModal(modalPayload);
    else openModal(modalPayload);
  }, [customerId, isModalOpen, missingConfig, openModal, replaceModal, requirement]);

  const checkAccess = useCallback(
    async (options: EnforceOptions = {}) => {
      if (!requirement?.requiresPaywall) {
        setState(buildInitialState(false));
        return true;
      }

      if (missingConfig) {
        setState({
          status: "error",
          allowed: false,
          error: "stripePriceId or stripeProductId is required for this paywall.",
        });
        if (options.openModalOnBlock) presentPaywallModal();
        return false;
      }

      if (!customerId) {
        setState({
          status: "blocked",
          allowed: false,
          needsAuth: true,
          matches: [],
        });
        if (options.openModalOnBlock) presentPaywallModal();
        return false;
      }

      setState((prev) => ({
        ...prev,
        status: "checking",
        error: undefined,
      }));

      try {
        const response = await paywallService.checkEntitlement({
          customerId,
          stripePriceId: requirement.stripePriceId,
          stripeProductId: requirement.stripeProductId,
          requiresPaywall: requirement.requiresPaywall,
          limit: 25,
        });

        if (response.entitled) {
          setState({
            status: "allowed",
            allowed: true,
            matches: response.matches,
          });
          return true;
        }

        setState({
          status: "blocked",
          allowed: false,
          matches: response.matches,
        });
        if (options.openModalOnBlock) presentPaywallModal();
        return false;
      } catch (e: any) {
        setState({
          status: "error",
          allowed: false,
          error: e?.message || "Unable to check paywall access.",
        });
        if (options.openModalOnBlock) presentPaywallModal();
        return false;
      }
    },
    [
      customerId,
      missingConfig,
      paywallService,
      presentPaywallModal,
      requirement?.requiresPaywall,
      requirement?.stripePriceId,
      requirement?.stripeProductId,
    ]
  );

  const blocking = Boolean(requirement?.requiresPaywall && !state.allowed);

  return {
    ...state,
    blocking,
    requirement,
    checkAccess,
    openPaywall: presentPaywallModal,
  };
};

export default usePaywall;
