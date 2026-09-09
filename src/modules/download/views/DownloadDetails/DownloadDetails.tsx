// Relative Path: ./DownloadDetails.tsx
import React, { useState } from 'react';
import styles from './DownloadDetails.scss';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import { IDownloadTarget } from '../../models/IDownloadTarget';

interface IDownloadDetails {
  target: IDownloadTarget;
  entitled: boolean;
  checking?: boolean;
  needsAuth?: boolean;
  token?: string;
  onBack: () => void;
  onSubscribe: () => void;
}

const TOKEN_PLACEHOLDER = '{TOKEN}';

const DownloadDetails: React.FC<IDownloadDetails> = ({
  target,
  entitled,
  checking,
  needsAuth,
  token,
  onBack,
  onSubscribe,
}) => {
  const [copied, setCopied] = useState(false);

  const command = token
    ? target.installCommandTemplate.replace(TOKEN_PLACEHOLDER, token)
    : target.installCommandTemplate;
  const canShowCommand = entitled && Boolean(token);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("clipboard unavailable")
      /* clipboard unavailable — user can still select the text */
    }
  };

  return (
    <>
      <style jsx>{styles}</style>
      <div className='download-details'>
        <button type='button' className='download-details__back' onClick={onBack}>
          ← All devices
        </button>

        <div className='download-details__head'>
          <span className='download-details__head-icon'>
            <UiIcon icon={target.icon} />
          </span>
          <div>
            <h2 className='download-details__title'>{target.label}</h2>
            <div className='download-details__build'>
              Build {target.buildRef || '—'}
              {target.builtAt ? ` · ${new Date(target.builtAt).toLocaleString()}` : ''}
              <span className='download-details__nosemver'> · rolling build, no version number</span>
            </div>
          </div>
        </div>

        <section className='download-details__section'>
          <h3>What you get</h3>
          <p>
            The full MindBurn Network for your device. On install it joins the fleet and
            contributes capacity (e.g. streaming workers) the way your OS class does today.
          </p>
        </section>

        <section className='download-details__section'>
          <h3>Requirements</h3>
          <ul className='download-details__reqs'>
            {(target.requirements || []).map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </section>

        <section className='download-details__section'>
          <h3>Install</h3>

          {checking && <div className='download-details__state'>Checking your subscription…</div>}

          {!checking && needsAuth && (
            <div className='download-details__state'>Sign in to your account to download.</div>
          )}

          {!checking && !needsAuth && !entitled && (
            <div className='download-details__cta'>
              <p>An active subscription is required to download.</p>
              <UiButton variant='primary' onClick={onSubscribe} children='Subscribe' />
            </div>
          )}

          {!checking && entitled && !token && (
            <div className='download-details__state'>Preparing your install command…</div>
          )}

          {canShowCommand && (
            <div className='download-details__command'>
              <pre className='download-details__code'>
                <code>{command}</code>
              </pre>
              <UiButton variant={copied? 'success': '' } onClick={copy} children={copied ? 'Copied' : 'Copy'} traits={{
                afterIcon: { icon:copied? 'fa-check': 'fa-copy' }
              }} />
              <p className='download-details__hint'>
                Cert-free — paste into Terminal. Your browser never downloads a file, so there is
                no Gatekeeper / notarization prompt.
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
};

export default DownloadDetails;
