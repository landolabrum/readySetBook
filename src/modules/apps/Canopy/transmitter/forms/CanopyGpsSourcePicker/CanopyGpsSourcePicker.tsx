import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import UiForm from '@webstack/components/UiForm/controller/UiForm';
import UiSelect from '@webstack/components/UiForm/components/UiSelect/UiSelect';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import UiButtonGroup from '@webstack/components/UiForm/components/UiButtonGroup/controller/UiButtonGroup';
import { getService } from '@webstack/common';
import IMemberService from '~/src/core/services/MemberService/IMemberService';
import type { GpsSource, GpsSourceKind } from '@Canopy/models/overlay/gpsSource';
import type { TeamOption } from '../CanopyTeamPicker/CanopyTeamPicker';
import styles from './CanopyGpsSourcePicker.scss';

export type CanopyGpsSourcePickerProps = {
  value: GpsSource | GpsSource[] | null;
  onChange: (next: GpsSource | GpsSource[] | null) => void;
  allow: GpsSourceKind[];
  teamOptions: TeamOption[];
  eventDefaults?: { lat?: number; lng?: number };
  /** Multi-select mode (Map only) — value and onChange use GpsSource[] */
  multi?: boolean;
};

type GuardianUser = { user_id: string; label: string };

const toFloat = (v: any): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const TAB_LABELS: Record<GpsSourceKind, string> = {
  manual:   'Address',
  team:     'Team GPS',
  guardian: 'Guardian',
};

const CanopyGpsSourcePicker: React.FC<CanopyGpsSourcePickerProps> = ({
  value,
  onChange,
  allow,
  teamOptions,
  eventDefaults,
  multi = false,
}) => {
  const memberService = useMemo(() => getService<IMemberService>('IMemberService'), []);

  const singleValue = !multi && !Array.isArray(value) ? (value as GpsSource | null) : null;
  const multiValue  = multi  &&  Array.isArray(value) ? (value as GpsSource[])      : [];
  const derivedKind: GpsSourceKind = singleValue?.kind ?? multiValue[0]?.kind ?? allow[0];

  const [activeTab, setActiveTab] = useState<GpsSourceKind>(() => derivedKind);
  const [guardianUsers, setGuardianUsers] = useState<GuardianUser[]>([]);
  const guardianFetchedRef = useRef(false);

  // Sync tab when persisted value kind changes (e.g. overlay reloaded from DB)
  useEffect(() => {
    const kind = singleValue?.kind ?? multiValue[0]?.kind;
    if (kind && kind !== activeTab) setActiveTab(kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singleValue?.kind, multiValue[0]?.kind]);

  // Lazy-fetch guardian users only when that tab is first opened
  useEffect(() => {
    if (activeTab !== 'guardian' || guardianFetchedRef.current) return;
    guardianFetchedRef.current = true;
    memberService?.getAdminUserLocations?.()
      .then((res: any) => {
        const rows: any[] = Array.isArray(res?.data) ? res.data : [];
        setGuardianUsers(
          rows.map((r: any) => {
            const uid  = String(r?.user_id || r?.userId || r?.friend_user_id || r?.friendUserId || '').trim();
            const name = r?.friend_display_name || r?.displayName || r?.display_name || r?.user_name || r?.name || uid;
            return { user_id: uid, label: String(name) };
          }).filter((u) => u.user_id)
        );
      })
      .catch(() => { /* user can type manually */ });
  }, [activeTab, memberService]);

  const handleTabClick = useCallback((kind: GpsSourceKind) => {
    if (kind === activeTab) return;
    setActiveTab(kind);
    if (multi) onChange([]);
    else onChange(null);
  }, [activeTab, onChange, multi]);

  // UiButtonGroup fires onSelect with e.target.name === button name
  const handleGroupSelect = useCallback((e: any) => {
    const kind = (e?.target?.name ?? e?.detail?.name ?? '') as GpsSourceKind;
    if (kind && allow.includes(kind)) handleTabClick(kind);
  }, [allow, handleTabClick]);

  // ── Manual panel ──────────────────────────────────────────────────────────
  const manualSrc = singleValue?.kind === 'manual' ? singleValue : null;
  const locationFormValue = {
    lat:         manualSrc?.lat ?? toFloat(eventDefaults?.lat) ?? 0,
    lng:         manualSrc?.lng ?? toFloat(eventDefaults?.lng) ?? 0,
    line1:       manualSrc?.address?.line1       ?? '',
    line2:       manualSrc?.address?.line2       ?? '',
    city:        manualSrc?.address?.city        ?? '',
    state:       manualSrc?.address?.state       ?? '',
    postal_code: manualSrc?.address?.postal_code ?? '',
    country:     manualSrc?.address?.country     ?? '',
  };

  const handleManualChange = useCallback((e: any) => {
    const src  = e?.target ?? e;
    const name = String(src?.name ?? '');
    const val: any = src?.value ?? e?.value;
    if (name === 'location' && val && typeof val === 'object') {
      onChange({ kind: 'manual', lat: toFloat(val.lat) ?? 0, lng: toFloat(val.lng) ?? 0, address: val });
    }
  }, [onChange]);

  // ── Team panel ────────────────────────────────────────────────────────────
  const teamSingle = singleValue?.kind === 'team' ? singleValue : null;
  const selectedTeams: string[] = multi
    ? multiValue.filter((s) => s.kind === 'team').map((s) => (s as any).team_number)
    : teamSingle ? [(teamSingle as any).team_number] : [];

  // All teams shown; live-GPS ones marked with ●
  const teamSelectOptions = teamOptions.map((o) => ({
    label: o.hasGps ? `${o.label}  #${o.vehicle}  ●` : `${o.label}  #${o.vehicle}`,
    value: o.vehicle,
  }));

  const handleTeamSelect = useCallback((opt: any) => {
    const veh = String(opt?.value ?? opt ?? '').trim();
    if (!veh) return;
    if (multi) {
      const already = selectedTeams.includes(veh);
      const next = already ? selectedTeams.filter((v) => v !== veh) : [...selectedTeams, veh];
      onChange(next.map((t) => ({ kind: 'team', team_number: t } as GpsSource)));
    } else {
      onChange({ kind: 'team', team_number: veh });
    }
  }, [multi, selectedTeams, onChange]);

  const handleTeamRemove = useCallback((veh: string) => {
    if (!multi) return;
    const next = selectedTeams.filter((v) => v !== veh);
    onChange(next.map((t) => ({ kind: 'team', team_number: t } as GpsSource)));
  }, [multi, selectedTeams, onChange]);

  // ── Guardian panel ────────────────────────────────────────────────────────
  const guardianSingle = singleValue?.kind === 'guardian' ? singleValue : null;
  const guardianSelectOptions = guardianUsers.map((u) => ({ label: u.label, value: u.user_id }));

  const handleGuardianSelect = useCallback((opt: any) => {
    const uid = String(opt?.value ?? opt ?? '').trim();
    if (uid) onChange({ kind: 'guardian', user_id: uid });
  }, [onChange]);

  const handleGuardianIdChange = useCallback((e: any) => {
    const uid = String(e?.value ?? e?.target?.value ?? '').trim();
    if (uid) onChange({ kind: 'guardian', user_id: uid });
  }, [onChange]);

  // ── Render ────────────────────────────────────────────────────────────────
  const renderPanel = () => {
    if (activeTab === 'manual') {
      return (
        <UiForm
          fields={[{ name: 'location', label: 'Location', type: 'address', value: locationFormValue }]}
          onChange={handleManualChange}
        />
      );
    }

    if (activeTab === 'team') {
      return (
        <>
          <UiSelect
            label="Team GPS"
            options={teamSelectOptions}
            value={multi
              ? (selectedTeams.length ? `${selectedTeams.length} selected` : '')
              : (teamSingle?.team_number ?? '')}
            onSelect={handleTeamSelect}
            search
            overlay
            openDirection="down"
          />
          {multi && selectedTeams.length > 0 && (
            <div className="gps-source-picker__chips">
              {selectedTeams.map((veh) => {
                const meta = teamOptions.find((o) => o.vehicle === veh);
                return (
                  <UiButton
                    key={veh}
                    variant="pill"
                    traits={{ afterIcon: 'fa-xmark' }}
                    onClick={() => handleTeamRemove(veh)}
                  >
                    {meta ? `${meta.label} #${veh}` : `#${veh}`}
                  </UiButton>
                );
              })}
            </div>
          )}
        </>
      );
    }

    if (activeTab === 'guardian') {
      return (
        <>
          {guardianSelectOptions.length > 0 && (
            <UiSelect
              label="Sharing Users"
              options={guardianSelectOptions}
              value={guardianSingle?.user_id ?? ''}
              onSelect={handleGuardianSelect}
              search
              overlay
              openDirection="down"
            />
          )}
          <UiForm
            fields={[{
              name:        'userId',
              label:       guardianSelectOptions.length > 0 ? 'Or enter User ID' : 'User ID',
              type:        'text',
              value:       guardianSingle?.user_id ?? '',
              placeholder: 'user UUID',
            }]}
            onChange={handleGuardianIdChange}
          />
        </>
      );
    }

    return null;
  };

  // Only render the tab strip when there are multiple sources to choose from
  const showTabs = allow.length > 1;

  return (
    <>
      <style jsx>{styles}</style>
      <div className="gps-source-picker">
        {showTabs && (
          <UiButtonGroup
            variant="bundle"
            btns={allow.map((kind) => ({
              name:    kind,
              label:   TAB_LABELS[kind] ?? kind,
              checked: activeTab === kind,
            }))}
            onSelect={handleGroupSelect}
          />
        )}
        <div className="gps-source-picker__panel">
          {renderPanel()}
        </div>
      </div>
    </>
  );
};

export default CanopyGpsSourcePicker;
