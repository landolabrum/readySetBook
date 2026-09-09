import React from "react";
import UiInput from "@webstack/components/UiForm/components/UiInput/controller/UiInput";
import UiSelect from "@webstack/components/UiForm/components/UiSelect/UiSelect";
import styles from "./GuardianPanel.scss";
import { GuardianVesselScope } from "../../hooks/types";

type Props = {
  clearanceLevel?: number;
  vesselScope?: GuardianVesselScope;
  onVesselScopeChange?: (scope: GuardianVesselScope) => void;
  vesselSearch?: string;
  onVesselSearchChange?: (value: string) => void;
  deviceTypeFilter?: string;
  onDeviceTypeFilterChange?: (value: string) => void;
  deviceTypeOptions?: string[];
};

const capitalize = (value: string) =>
  value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : "";

const GuardianAdminFilters: React.FC<Props> = ({
  clearanceLevel,
  vesselScope = "all",
  onVesselScopeChange,
  vesselSearch = "",
  onVesselSearchChange,
  deviceTypeFilter = "",
  onDeviceTypeFilterChange,
  deviceTypeOptions = [],
}) => {
  // "Fleet devices" is available to everyone (the backend scopes non-admins
  // to devices they own); the cross-user scopes and filters stay admin-only.
  const isAdmin = (clearanceLevel ?? 0) >= 12;

  const scopeButton = (scope: GuardianVesselScope, label: string) => (
    <button
      type="button"
      className={`guardian__admin-filter-btn ${
        vesselScope === scope ? "guardian__admin-filter-btn--active" : ""
      }`}
      onClick={() => onVesselScopeChange?.(scope)}
    >
      {label}
    </button>
  );

  const selectOptions = [
    { label: "All device types", value: "" },
    ...deviceTypeOptions.map((type) => ({
      label: capitalize(type || ""),
      value: type || "",
    })),
  ];

  return (
    <>
      <style jsx>{styles}</style>
      <div className="guardian__admin-filters">
        <div className="guardian__admin-filters-scopes">
          {isAdmin ? scopeButton("all", "All user vessels") : null}
          {scopeButton("mine", "My vessels")}
          {scopeButton("fleet", "Fleet devices")}
        </div>
        {isAdmin ? (
          <div className="guardian__admin-filters-inputs">
            <div className="guardian__admin-filter-input-wrapper">
              <UiInput
                value={vesselSearch}
                onChange={(ev: any) => onVesselSearchChange?.(ev?.target?.value ?? "")}
                placeholder="Find user or vessel"
                autoComplete="off"
              />
            </div>
            <div className="guardian__admin-filter-select-wrapper">
              <UiSelect
                options={selectOptions}
                value={deviceTypeFilter}
                onSelect={(opt: any) => onDeviceTypeFilterChange?.((opt?.value || "").toLowerCase())}
              />
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
};

export default GuardianAdminFilters;
