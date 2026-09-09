import React, { useEffect, useMemo, useState } from 'react';
import UiForm from '@webstack/components/UiForm/controller/UiForm';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import type { ToggleableService } from '../../../../helpers/hostServices';
import { missingRequiredParams } from '../../../../helpers/hostServices';

type Props = {
    service: ToggleableService;
    services: Record<string, any> | null | undefined;
    saving?: boolean;
    toggling?: boolean;
    onSaveServices: (nextServices: Record<string, any>) => Promise<void> | void;
    onToggle: (flag: string, enabled: boolean) => Promise<void> | void;
    onClose: () => void;
};

/**
 * Parameter editor for one toggleable service, shown above the container
 * table when its row is clicked. Required params must be filled (and saved
 * to the system_hosts.services row — the DB is the source of truth) before
 * the image can spin up; Enable saves the draft first, then flips the flag.
 */
const ServiceConfigPanel: React.FC<Props> = ({
    service, services, saving, toggling, onSaveServices, onToggle, onClose,
}) => {
    const current = services ?? {};
    const enabled = Boolean(current[service.flag]);
    const [draft, setDraft] = useState<Record<string, string>>({});

    useEffect(() => {
        const d: Record<string, string> = {};
        service.params.forEach(p => { d[p.key] = String(current[p.key] ?? ''); });
        setDraft(d);
        // Re-seed only when the selected service (or its row values) change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [service.flag, services]);

    // UiForm has no dedicated secret input — smb_pass renders as text, the
    // same convention ConfigEditableHost uses for the services JSON section.
    const fields = useMemo(() => service.params.map(p => ({
        name: p.key,
        label: p.label + (p.required ? ' *' : ''),
        type: 'text',
        placeholder: p.placeholder ?? '',
        value: draft[p.key] ?? '',
    })), [service.params, draft]);

    const draftServices = useMemo(() => {
        const next: Record<string, any> = { ...current };
        service.params.forEach(p => {
            const v = (draft[p.key] ?? '').trim();
            if (v) next[p.key] = v;
            else delete next[p.key];
        });
        return next;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [current, draft, service.params]);

    const missing = missingRequiredParams(service, draftServices);
    const busy = Boolean(saving || toggling);

    const handleChange = (e: any) => {
        const { name, value } = e?.target ?? {};
        if (name) setDraft(prev => ({ ...prev, [name]: String(value ?? '') }));
    };

    const handleSave = async () => {
        await onSaveServices(draftServices);
    };

    const handleEnable = async () => {
        if (missing.length) return;
        if (service.params.length) await onSaveServices(draftServices);
        await onToggle(service.flag, true);
    };

    const handleDisable = async () => {
        await onToggle(service.flag, false);
    };

    return (
        <div className="card--content" data-testid="service-config-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontWeight: 600 }}>
                    <UiIcon icon="fa-sliders" /> {service.label}
                    <span style={{ marginLeft: 8, fontSize: '11px', color: enabled ? 'var(--green-40)' : 'var(--gray-50)' }}>
                        {enabled ? 'enabled' : 'disabled'} · profile: {service.profile}
                    </span>
                </span>
                <UiButton variant="ghost" size="xs" onClick={onClose} traits={{ beforeIcon: 'fa-xmark' }}>
                    Close
                </UiButton>
            </div>

            {service.note && (
                <div style={{ fontSize: '11px', color: 'var(--gray-50)', marginBottom: '6px' }}>
                    <UiIcon icon="fa-circle-info" /> {service.note}
                </div>
            )}

            {service.params.length > 0 ? (
                <UiForm
                    fields={fields as any}
                    onChange={handleChange}
                    onSubmit={handleSave}
                    submitText="Save Parameters"
                    loading={busy}
                />
            ) : (
                <div style={{ fontSize: '12px', color: 'var(--gray-50)', marginBottom: '6px' }}>
                    No configurable parameters for this service.
                </div>
            )}

            {missing.length > 0 && (
                <div style={{ fontSize: '11px', color: 'var(--red-30)', margin: '6px 0' }}>
                    Required before enabling: {missing.map(m => m.label).join(', ')}
                </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                {enabled ? (
                    <UiButton
                        busy={toggling}
                        variant="flat"
                        onClick={handleDisable}
                        traits={{ beforeIcon: 'fa-stop' }}
                    >
                        Disable
                    </UiButton>
                ) : (
                    <UiButton
                        busy={toggling}
                        variant={missing.length ? 'disabled' : 'success'}
                        disabled={Boolean(missing.length)}
                        onClick={handleEnable}
                        traits={{ beforeIcon: 'fa-play' }}
                    >
                        Enable
                    </UiButton>
                )}
            </div>
        </div>
    );
};

export default ServiceConfigPanel;
