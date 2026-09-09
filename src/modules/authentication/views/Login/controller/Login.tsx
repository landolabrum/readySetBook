
// Relative Path: ./SignIn.tsx
import React, { useEffect, useMemo, useState } from 'react';
import styles from './Login.scss';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import keyStringConverter from '@webstack/helpers/keyStringConverter';
import { capitalizeAll } from '@webstack/helpers/Capitalize';
import UiViewLayout from '@webstack/layouts/UiViewLayout/controller/UiViewLayout';
import type { ILogin } from '../../../controller/AuthTypes';
import { normalizeProviders, resolveProvider } from '../../../controller/AuthProviders';

// Remember to create a sibling SCSS file with the same name as this component
const Login: React.FC<ILogin> = ({
  email,
  view,
  title,
  onSuccess,
  providers,
  providerId,
}: ILogin) => {
  const [current, setView] = useState<string | undefined>(view || 'login');

  // Resolve the active provider (defaults to email/password)
  const providerRegistry = normalizeProviders(providers);
  const provider = resolveProvider(providerRegistry, providerId);

  const ProviderLoginView = provider?.components.Login;
  const ProviderResetPassword = provider?.components.ResetPassword;

  const views = useMemo(() => {
    const map: Record<string, React.JSX.Element> = {};
    if (ProviderLoginView) {
      map.login = <ProviderLoginView onSuccess={onSuccess} email={email} />;
    }
    if (ProviderResetPassword) {
      map['reset-password'] = <ProviderResetPassword email={email} />;
    }
    return map;
  }, [ProviderLoginView, ProviderResetPassword, onSuccess, email]);

  const submitText
    = current === 'login' ? 'reset-password' : 'login';

  useEffect(() => {
    if (current && views[current]) return;
    const fallback = views.login ? 'login' : Object.keys(views)[0];
    if (fallback) setView(fallback);
  }, [current, views]);
  return (
    <>
      <style jsx>{styles}</style>
      <div className='login'>
        <UiViewLayout
          showTitle={true}
          currentView={current}
          actions={false}
          views={views}
        />
        <div className="login__reset">
          <UiButton variant='link' onClick={() => setView(submitText)} >
            {capitalizeAll(keyStringConverter(submitText))}
          </UiButton>
        </div>
      </div>
    </>
  );
};

export default Login;