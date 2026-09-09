// Pull-based self-update arming: target_ref + self_update_enabled.
// Edits live in local draft state and are pushed via saveDeviceConfig.
import React, { useCallback, useEffect, useState } from 'react';
import styles from './ConfigSelfUpdate.scss';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';

interface Props {
  config: any | null;
  hostKey: string;
  saving: boolean;
  onSave: (patch: Record<string, any>) => Promise<void>;
}

type Draft = { target_ref: string; self_update_enabled: boolean };

const ConfigSelfUpdate: React.FC<Props> = ({ config, hostKey, saving, onSave }) => {
  const [draft, setDraft] = useState<Draft>({ target_ref: '', self_update_enabled: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft({
      target_ref: config?.target_ref ?? '',
      self_update_enabled: Boolean(config?.self_update_enabled),
    });
  }, [config]);

  const dirty = Boolean(
    config && (
      (config.target_ref ?? '') !== (draft.target_ref ?? '') ||
      Boolean(config.self_update_enabled) !== draft.self_update_enabled
    )
  );

  const handleSave = useCallback(async () => {
    if (!dirty) return;
    setBusy(true);
    try {
      const patch: Record<string, any> = {};
      const nextRef = (draft.target_ref ?? '').trim();
      if ((config?.target_ref ?? '') !== nextRef) {
        patch.target_ref = nextRef === '' ? null : nextRef;
      }
      if (Boolean(config?.self_update_enabled) !== draft.self_update_enabled) {
        patch.self_update_enabled = draft.self_update_enabled;
      }
      if (Object.keys(patch).length > 0) await onSave(patch);
    } finally {
      setBusy(false);
    }
  }, [config, draft, dirty, onSave]);

  return (
    <>
      <style jsx>{styles}</style>
      <div className="config-self-update">
        <label className="config-self-update__row">
          <span className="config-self-update__label">target ref</span>
          <input
            type="text"
            className="config-self-update__input"
            placeholder="e.g. beta, main, or commit SHA"
            value={draft.target_ref}
            onChange={(e) => setDraft(p => ({ ...p, target_ref: e.target.value }))}
          />
        </label>
        <label className="config-self-update__row config-self-update__row--inline">
          <input
            type="checkbox"
            checked={draft.self_update_enabled}
            onChange={(e) => setDraft(p => ({ ...p, self_update_enabled: e.target.checked }))}
          />
          <span className="config-self-update__label">
            self-update armed
            <span className="config-self-update__hint">
              host polls /hosts/{hostKey}/target and reconciles to target ref
            </span>
          </span>
        </label>
        <div className="config-self-update__actions">
          <UiButton busy={busy || saving} disabled={!dirty} onClick={handleSave}>
            {dirty ? 'Save fleet settings' : 'Saved'}
          </UiButton>
        </div>
      </div>
    </>
  );
};

export default ConfigSelfUpdate;
