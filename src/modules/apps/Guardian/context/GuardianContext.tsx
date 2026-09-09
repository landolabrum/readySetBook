import React, { PropsWithChildren, createContext, useContext } from "react";
import useGuardianTracker from "../hooks/useGuardian";

export type GuardianContextValue = ReturnType<typeof useGuardianTracker>;

const GuardianContext = createContext<GuardianContextValue | null>(null);

export const GuardianProvider: React.FC<PropsWithChildren<unknown>> = ({ children }) => {
  const value = useGuardianTracker();
  return <GuardianContext.Provider value={value}>{children}</GuardianContext.Provider>;
};

export const useGuardian = (): GuardianContextValue => {
  const ctx = useContext(GuardianContext);
  if (!ctx) {
    throw new Error("useGuardian must be used inside a GuardianProvider");
  }
  return ctx;
};

// Backwards-compatible alias for legacy imports
export const useGaurdian = useGuardian;

export default GuardianProvider;
