// Relative Path: ./AdminRoutes.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { getService } from '@webstack/common';
import styles from './AdminRoutes.scss';
import AdapTable from '@webstack/components/AdapTable/views/AdapTable';
import UiForm from '@webstack/components/UiForm/controller/UiForm';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import UiInput from '@webstack/components/UiForm/components/UiInput/controller/UiInput';
import UiButtonGroup from '@webstack/components/UiForm/components/UiButtonGroup/controller/UiButtonGroup';
import IRoutesService from '~/src/core/services/RoutesService/IRoutesService';
import { IDynamicRoute } from '~/src/core/services/MemberService/IMemberService';
import { useClearance } from '~/src/core/authentication/hooks/useUser';
import { useModal } from '@webstack/components/Containers/modal/contexts/modalContext';
import { routesToButtons } from '~/src/modules/authentication/views/WelcomeBack/utils/routesToButtons';

type EditState = Partial<IDynamicRoute> & { id?: number };

const EMPTY: EditState = {
  href: '',
  label: '',
  icon: '',
  clearance: 0,
  sort_order: 0,
  hide: false,
  modal: '',
  parent_id: null,
  mid: null,
};

const assembleTree = (flat: IDynamicRoute[]): IDynamicRoute[] => {
  const byId = new Map<number, IDynamicRoute & { items: IDynamicRoute[] }>();
  flat.forEach((r) => { if (r.id != null) byId.set(r.id, { ...r, items: [] }); });
  const roots: IDynamicRoute[] = [];
  byId.forEach((node) => {
    if (node.parent_id != null && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.items.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
};

const AdminRoutes: React.FC = () => {
  const routesService = useMemo(() => getService<IRoutesService>('IRoutesService'), []);
  const userClearance = useClearance();
  const { push } = useRouter();
  const { closeModal } = useModal();
  const [rows, setRows] = useState<IDynamicRoute[] | undefined>(undefined);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewClearance, setPreviewClearance] = useState<number>(userClearance);

  useEffect(() => { setPreviewClearance(userClearance); }, [userClearance]);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await routesService.listRoutes();
      setRows(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load routes');
    }
  }, [routesService]);

  useEffect(() => { refresh(); }, [refresh]);

  const parentOptions = useMemo(() => {
    const opts: { label: string; value: string }[] = [{ label: '— none —', value: '' }];
    (rows || []).forEach((r) => {
      if (!r.id) return;
      opts.push({ label: `${r.label || r.href || `#${r.id}`} (id ${r.id})`, value: String(r.id) });
    });
    return opts;
  }, [rows]);

  const midOptions = useMemo(() => ([
    { label: 'all merchants', value: '' },
    { label: 'mb1', value: 'mb1' },
    { label: 'xi1', value: 'xi1' },
    { label: 'mb1 + xi1', value: 'mb1,xi1' },
  ]), []);

  const tableData = useMemo(() => {
    return (rows || []).map((r) => {
      const parent = (rows || []).find((x) => x.id === r.parent_id);
      const midStr = Array.isArray(r.mid) ? r.mid.join(', ') : (r.mid || '');
      return {
        id: r.id,
        label: r.label || '',
        href: r.href || '',
        clearance: r.clearance ?? 0,
        mid: midStr,
        parent: parent ? (parent.label || parent.href || `#${parent.id}`) : '',
        hide: r.hide ? 'yes' : '',
        sort: r.sort_order ?? 0,
      };
    });
  }, [rows]);

  const handleRowClick = (row: any) => {
    const id = row?.id ?? row?.row?.id;
    const found = (rows || []).find((r) => r.id === id);
    if (found) setEditing({ ...found });
  };

  const handleNew = () => setEditing({ ...EMPTY });

  const handleFormChange = (e: any) => {
    const next: any = { ...editing };
    if (e?.target) {
      const { name, value, checked, type } = e.target;
      next[name] = type === 'checkbox' ? checked : value;
    } else if (e && typeof e === 'object') {
      Object.assign(next, e);
    }
    setEditing(next);
  };

  const normalize = (s: EditState): Partial<IDynamicRoute> => {
    const out: any = { ...s };
    if (out.parent_id === '' || out.parent_id == null) out.parent_id = null;
    else out.parent_id = Number(out.parent_id);
    out.clearance = Number(out.clearance ?? 0);
    out.sort_order = Number(out.sort_order ?? 0);
    if (typeof out.mid === 'string') {
      const trimmed = out.mid.trim();
      out.mid = trimmed === '' ? null : (trimmed.includes(',') ? trimmed.split(',').map((x: string) => x.trim()).filter(Boolean) : [trimmed]);
    }
    delete out.id;
    return out;
  };

  const handleSubmit = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const payload = normalize(editing);
      if (editing.id) await routesService.updateRoute(editing.id, payload);
      else await routesService.createRoute(payload);
      setEditing(null);
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!editing?.id) return;
    if (!window.confirm(`Delete route #${editing.id} (${editing.label || editing.href || ''})?`)) return;
    setBusy(true);
    setError(null);
    try {
      await routesService.deleteRoute(editing.id);
      setEditing(null);
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const previewBtns = useMemo(() => {
    const filtered = (rows || []).filter((r) => (r.clearance ?? 0) <= previewClearance);
    const tree = assembleTree(filtered);
    return routesToButtons(tree, (href) => {
      if (!href) return;
      closeModal();
      push(href);
    });
  }, [rows, previewClearance, push, closeModal]);

  const handlePreviewChange = (e: any) => {
    const v = Number(e?.target?.value);
    if (Number.isFinite(v)) {
      const clamped = Math.max(0, Math.min(12, v));
      setPreviewClearance(clamped);
    }
  };

  const formFields = useMemo(() => {
    if (!editing) return [];
    return [
      { name: 'label', label: 'label', type: 'text', value: editing.label ?? '' },
      { name: 'href', label: 'href', type: 'text', value: editing.href ?? '' },
      { name: 'modal', label: 'modal key', type: 'text', value: editing.modal ?? '' },
      { name: 'icon', label: 'icon', type: 'text', value: editing.icon ?? '' },
      { name: 'altLabel', label: 'alt label', type: 'text', value: editing.altLabel ?? '' },
      { name: 'clearance', label: 'clearance', type: 'number', value: editing.clearance ?? 0 },
      { name: 'sort_order', label: 'sort order', type: 'number', value: editing.sort_order ?? 0 },
      { name: 'parent_id', label: 'parent', type: 'select', value: editing.parent_id == null ? '' : String(editing.parent_id), options: parentOptions },
      { name: 'mid', label: 'merchant scope', type: 'select', value: Array.isArray(editing.mid) ? editing.mid.join(',') : (editing.mid ?? ''), options: midOptions },
      { name: 'badge', label: 'badge', type: 'text', value: editing.badge ?? '' },
      { name: 'hide', label: 'hide', type: 'checkbox', value: !!editing.hide },
    ];
  }, [editing, parentOptions, midOptions]);

  return (
    <>
      <style jsx>{styles}</style>
      <div className='admin-routes'>
        <div className='admin-routes__bar'>
          <h1>Admin Routes</h1>
          <div className='admin-routes__actions'>
            <UiButton onClick={refresh} traits={{ afterIcon: 'fa-rotate' }} busy={rows === undefined}>refresh</UiButton>
            <UiButton onClick={handleNew} traits={{ afterIcon: 'fa-plus' }}>new route</UiButton>
          </div>
        </div>

        {error && <div className='admin-routes__error'>{error}</div>}

        <div className='admin-routes__main'>
          <div className='admin-routes__table'>
            <AdapTable
              options={{
                tableTitle: 'routes',
                hideColumns: [],
              }}
              loading={rows === undefined}
              data={tableData as any}
              onRowClick={handleRowClick as any}
            />
          </div>

          <div className='admin-routes__preview'>
            <div className='admin-routes__preview-header'>
              <h3>Welcome preview (clearance {previewClearance})</h3>
              <UiInput
                name='previewClearance'
                type='number'
                label='preview clearance'
                min={0}
                max={12}
                value={previewClearance}
                onChange={handlePreviewChange}
              />
            </div>
            <div className='admin-routes__preview-body'>
              <UiButtonGroup direction='ttb' btns={previewBtns} />
            </div>
          </div>
        </div>

        {editing && (
          <div className='admin-routes__edit'>
            <UiForm
              title={editing.id ? `Edit route #${editing.id}` : 'New route'}
              fields={formFields as any}
              onChange={handleFormChange}
              onSubmit={handleSubmit}
              submitText={editing.id ? 'save' : 'create'}
              loading={busy}
            />
            <div className='admin-routes__edit-actions'>
              <UiButton onClick={() => setEditing(null)} variant='secondary'>cancel</UiButton>
              {editing.id && (
                <UiButton onClick={handleDelete} variant='danger' traits={{ afterIcon: 'fa-trash-can' }}>delete</UiButton>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AdminRoutes;
