import React from "react";
import { GuardianProvider } from "../context/GuardianContext";
import GuardianContainer from "./GuardianContainer";

const Guardian: React.FC = () => (
  <GuardianProvider>
    <GuardianContainer />
  </GuardianProvider>
);

export default Guardian;
