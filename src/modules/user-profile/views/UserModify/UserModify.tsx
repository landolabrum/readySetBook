
import { useEffect, useMemo, useState } from 'react';
import styles from './UserModify.scss';
import { getService } from '@webstack/common';
import IMemberService, { IChangePasswordRequest, ICustomerUpdateRequest } from '~/src/core/services/MemberService/IMemberService';
import { useNotification } from '@webstack/components/Notification/Notification';
import UiForm from '@webstack/components/UiForm/controller/UiForm';
import { IFormField } from '@webstack/components/UiForm/models/IFormModel';
import { phoneFormat } from '@webstack/helpers/userExperienceFormats';
import UiMarkdown from '@webstack/components/UiMarkDown/controller/UiMarkDown';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import type IAuthenticatedUser from '~/src/models/ICustomer';
import type { UserAddress } from '~/src/models/ICustomer';
import type { ICustomer as ICustomerPayload } from '~/src/models/CustomerContext';

// ── Types ────────────────────────────────────────────────────────────

interface UserModifyProps {
  user?: IAuthenticatedUser;
  open?: boolean;
  modifyUser?: (user: IAuthenticatedUser) => void;
}

const MIN_PASSWORD_LENGTH = 8;

// ── Component ────────────────────────────────────────────────────────

const UserModify = ({ user, modifyUser }: UserModifyProps) => {
  const MemberService = getService<IMemberService>('IMemberService');
  const [, setNotification] = useNotification();
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  // ── Profile fields ───────────────────────────────────────────────

  const profileFieldsDef = useMemo<IFormField[]>(() => ([
    { name: 'first_name', label: 'first name', required: true },
    { name: 'last_name', label: 'last name', required: true },
    { name: 'email', label: 'email', required: true },
    { name: 'phone', label: 'phone', required: true, constraints: { min: 1, max: 16 } },
    { name: 'address', label: 'address', type: 'address', required: true },
  ]), []);

  const [profileFields, setProfileFields] = useState<IFormField[]>(profileFieldsDef);

  // ── Password fields ──────────────────────────────────────────────

  const passwordFieldsDef = useMemo<IFormField[]>(() => ([
    { name: 'current_password', label: 'current password', type: 'password', required: true },
    { name: 'new_password', label: 'new password', type: 'password', required: true, constraints: { min: MIN_PASSWORD_LENGTH } },
    { name: 'confirm_password', label: 'confirm password', type: 'password', required: true },
  ]), []);

  const [passwordFields, setPasswordFields] = useState<IFormField[]>(passwordFieldsDef);

  // ── Helpers ──────────────────────────────────────────────────────

  const fieldValue = (fields: IFormField[], name: string) =>
    fields.find(f => f.name === name)?.value;


  const sanitizeAddress = (raw: unknown): UserAddress | undefined => {
    if (!raw) return undefined;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      return trimmed ? { line1: trimmed } : undefined;
    }
    if (typeof raw !== 'object') return undefined;

    const clone: Record<string, any> = JSON.parse(JSON.stringify(raw));
    delete clone.lat;
    delete clone.lng;

    const coerce = (value?: unknown) => {
      if (value === null || value === undefined) return undefined;
      const str = String(value).trim();
      return str || undefined;
    };

    const normalized: UserAddress = {
      line1: coerce(clone.line1 ?? clone.street ?? clone.address1),
      line2: coerce(clone.line2 ?? clone.address2),
      city: coerce(clone.city ?? clone.locality),
      state: coerce(clone.state ?? clone.region),
      postal_code: coerce(clone.postal_code ?? clone.postalCode ?? clone.zip),
      country: coerce(clone.country ?? clone.country_code),
    };

    return Object.values(normalized).some(Boolean) ? normalized : undefined;
  };

  const mergeAddress = (existing?: UserAddress, incoming?: UserAddress | null): UserAddress | null => {
    if (incoming === null) return null;
    if (incoming === undefined) return sanitizeAddress(existing) || null;
    return { ...(sanitizeAddress(existing) || {}), ...incoming };
  };

  const addressToStripe = (address?: UserAddress): ICustomerPayload['address'] | null => {
    if (!address) return null;
    const toNullable = (value?: string) => (value && value.trim().length ? value.trim() : null);
    return {
      line1: toNullable(address.line1),
      line2: toNullable(address.line2),
      city: toNullable(address.city),
      state: toNullable(address.state),
      postal_code: toNullable(address.postal_code ?? address.zip),
      country: toNullable(address.country),
    };
  };

  // ── Hydrate profile fields from user prop ────────────────────────

  const hydrateProfileFields = () => {
    if (!user) return;

    const safePhone = user.phone ? phoneFormat(String(user.phone)) : '';
    const firstLast = (user.name || '').trim().split(' ');
    const firstName = user.first_name || firstLast[0] || '';
    const lastName = user.last_name || firstLast.slice(1).join(' ') || '';
    const normalizedAddress = sanitizeAddress(user.address);

    setProfileFields(profileFieldsDef.map(field => {
      switch (field.name) {
        case 'first_name': return { ...field, value: firstName };
        case 'last_name': return { ...field, value: lastName };
        case 'email': return { ...field, value: user.email || '' };
        case 'phone': return { ...field, value: safePhone };
        case 'address': return { ...field, value: normalizedAddress || user.address || '' };
        default: return field;
      }
    }));
  };

  // ── Profile handlers ─────────────────────────────────────────────

  const onProfileChange = (e: { target: { name: string; value: any } }) => {
    const { name, value } = e.target;
    setProfileFields(cur => cur.map(f => (f.name === name ? { ...f, value } : f)));
  };

  const handleProfileSubmit = async () => {
    if (!user) return;
    setProfileBusy(true);

    const firstName = String(fieldValue(profileFields, 'first_name') || '').trim();
    const lastName = String(fieldValue(profileFields, 'last_name') || '').trim();
    const email = String(fieldValue(profileFields, 'email') || '').trim();
    const phoneRaw = String(fieldValue(profileFields, 'phone') || '').trim();
    const normalizedPhone = phoneRaw ? phoneFormat(phoneRaw, 'US', true) : undefined;
    const existingAddress = sanitizeAddress(user.address);
    const rawAddressInput = fieldValue(profileFields, 'address');
    const userInputAddress = rawAddressInput ? sanitizeAddress(rawAddressInput) : null;
    const mergedAddress = mergeAddress(existingAddress, userInputAddress);

    const payload: ICustomerUpdateRequest = {
      id: user.id,
      name: [firstName, lastName].filter(Boolean).join(' ').trim() || user.name,
      email,
      phone: normalizedPhone ?? null,
    };

    if (mergedAddress !== undefined) {
      payload.address = mergedAddress === null ? null : addressToStripe(mergedAddress);
    }

    try {
      const updatedUser = await MemberService.modifyCustomer(payload);
      const resolvedUser: any =
        updatedUser && typeof updatedUser === 'object'
          ? (updatedUser as IAuthenticatedUser)
          : user
            ? { ...user, ...payload, address: mergedAddress === undefined ? user.address : mergedAddress }
            : undefined;

      setNotification({
        active: true,
        list: [{ label: 'success', message: `Profile updated: *${resolvedUser?.name || payload.name}*` }],
      });

      if (resolvedUser) modifyUser?.(resolvedUser);

      setProfileFields(cur => cur.map(f => {
        switch (f.name) {
          case 'first_name': return { ...f, value: firstName };
          case 'last_name': return { ...f, value: lastName };
          case 'email': return { ...f, value: email };
          case 'phone': return { ...f, value: phoneFormat(phoneRaw) };
          case 'address': return { ...f, value: (mergedAddress === undefined ? existingAddress : mergedAddress) ?? '' };
          default: return f;
        }
      }));
    } catch (error: any) {
      const raw = error?.detail?.detail || error?.detail || error?.message || 'Unable to update profile.';
      const message = typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
      setNotification({
        active: true,
        list: [{ label: 'error', message: <UiMarkdown text={`Update failed: **${message}**`} /> }],
      });
    } finally {
      setProfileBusy(false);
    }
  };

  // ── Password handlers ────────────────────────────────────────────

  const onPasswordChange = (e: { target: { name: string; value: any } }) => {
    const { name, value } = e.target;

    setPasswordFields(cur => {
      const updated = cur.map(f => (f.name === name ? { ...f, value, error: undefined } : f));

      // Cross-field validation: new vs confirm
      const newPw = String(fieldValue(updated, 'new_password') || '');
      const confirmPw = String(fieldValue(updated, 'confirm_password') || '');

      if (confirmPw && newPw && confirmPw !== newPw) {
        return updated.map(f =>
          f.name === 'confirm_password' ? { ...f, error: 'Passwords do not match' } : f,
        );
      }
      return updated.map(f => (f.name === 'confirm_password' ? { ...f, error: undefined } : f));
    });
  };

  const handlePasswordSubmit = async () => {
    if (!user) return;

    const currentPw = String(fieldValue(passwordFields, 'current_password') || '');
    const newPw = String(fieldValue(passwordFields, 'new_password') || '');
    const confirmPw = String(fieldValue(passwordFields, 'confirm_password') || '');

    // Client-side guards
    if (!currentPw) {
      setPasswordFields(cur => cur.map(f =>
        f.name === 'current_password' ? { ...f, error: 'Required' } : f));
      return;
    }
    if (newPw.length < MIN_PASSWORD_LENGTH) {
      setPasswordFields(cur => cur.map(f =>
        f.name === 'new_password' ? { ...f, error: `Must be at least ${MIN_PASSWORD_LENGTH} characters` } : f));
      return;
    }
    if (newPw !== confirmPw) {
      setPasswordFields(cur => cur.map(f =>
        f.name === 'confirm_password' ? { ...f, error: 'Passwords do not match' } : f));
      return;
    }

    setPasswordBusy(true);

    const payload: IChangePasswordRequest = {
      customer_id: user.id,
      current_password: currentPw,
      new_password: newPw,
    };

    try {
      await MemberService.changePassword(payload);
      setNotification({
        active: true,
        list: [{ label: 'success', message: 'Password changed successfully' }],
      });
      // Reset password fields and collapse
      setPasswordFields(passwordFieldsDef);
      setShowPasswordSection(false);
    } catch (error: any) {
      const raw = error?.detail || error?.message || 'Unable to change password.';
      const message = typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
      setNotification({
        active: true,
        list: [{ label: 'error', message: <UiMarkdown text={`Password change failed: **${message}**`} /> }],
      });
    } finally {
      setPasswordBusy(false);
    }
  };

  // ── Effects ──────────────────────────────────────────────────────

  useEffect(() => {
    0
    hydrateProfileFields();
  }, [profileFieldsDef]);

  // ── Render ───────────────────────────────────────────────────────

  return (
    <>
      <style jsx>{styles}</style>
      <div className="user-modify">
        {/* Profile section */}
        <div className="user-modify__section">
          <UiForm
            fields={profileFields}
            onChange={onProfileChange}
            onSubmit={handleProfileSubmit}
            loading={profileBusy}
            submitText="save profile"
          />
        </div>

        {/* Change password toggle + collapsible section */}
        <div className="user-modify__section user-modify__section--password">
          <UiButton
            variant="link"
            onClick={() => {
              setShowPasswordSection(prev => !prev);
              if (showPasswordSection) setPasswordFields(passwordFieldsDef);
            }}
          >
            {showPasswordSection ? 'Cancel' : 'Change Password'}
          </UiButton>

          {showPasswordSection && (
            <div className="user-modify__password-form">
              <UiForm
                fields={passwordFields}
                onChange={onPasswordChange}
                onSubmit={handlePasswordSubmit}
                loading={passwordBusy}
                submitText="update password"
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UserModify;
