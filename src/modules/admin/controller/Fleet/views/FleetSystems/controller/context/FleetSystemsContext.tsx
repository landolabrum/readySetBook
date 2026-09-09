import React, { createContext, ReactNode, useContext } from 'react';
import useFleetSystemsNetwork, { FleetSystemsNetworkModel } from '../hooks/useFleetSystemsNetwork';

const FleetSystemsContext = createContext<FleetSystemsNetworkModel | undefined>(undefined);

type FleetSystemsProviderProps = {
  children: ReactNode;
};

export const FleetSystemsProvider: React.FC<FleetSystemsProviderProps> = ({ children }) => {
  const model = useFleetSystemsNetwork();
  return <FleetSystemsContext.Provider value={model}>{children}</FleetSystemsContext.Provider>;
};

export const useFleetSystems = (): FleetSystemsNetworkModel => {
  const context = useContext(FleetSystemsContext);
  if (!context) throw new Error('useFleetSystems must be used inside FleetSystemsProvider');
  return context;
};

export default useFleetSystems;
