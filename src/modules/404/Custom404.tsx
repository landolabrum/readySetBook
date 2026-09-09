// ./404.tsx
import React, { useEffect, useRef } from 'react';
import styles from './Custom404.scss';
import { useRouter } from 'next/router';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import { useUser } from '~/src/core/authentication/hooks/useUser';

const Custom404: React.FC = () => {
  const router = useRouter();
  const user = useUser();
  // Capture the location ONCE; never update URL or state that could cause loops.
  const locRef = useRef<string>('');

  useEffect(() => {
    if (locRef.current) return;

    // Prefer explicit ?loc param if present, else use the path the user attempted.
    const qLoc = typeof router.query?.loc === 'string' ? router.query.loc : '';
    // For custom 404 rendered for /bad/path, router.asPath will be "/bad/path"
    // For explicit /404?loc=/bad/path, asPath is "/404?loc=/bad/path"
    const attempted = qLoc || (router.asPath?.startsWith('/404') ? '' : router.asPath) || '';
console.log(`[ Custom404 ]: \n ${attempted}`)
    // Final, safe display value (no URL writes)
    locRef.current = decodeURIComponent(attempted);
  }, [router.asPath, router.query?.loc]);

  return (
    <>
      <style jsx>{styles}</style>
      <div className="custom-404">
        <div className="custom-404__container">
          <div className="custom-404__content">
            <div className="custom-404__content--header">
              <div className="custom-404__content--header__title">
                <div>
                  <UiButton
                    variant="lite"
                    traits={{ beforeIcon: 'fa-chevron-left' }}
                    onClick={() => {
                      // Prefer back() (no query juggling). Fallback to home.
                      if (window.history.length > 2 && user) router.back();
                      else router.push('/');
                    }}
                  >
                    back
                  </UiButton>
                </div>
                <UiIcon icon="fa-exclamation-triangle" />
                {`This page does not exist`}
              </div>
              <div className="custom-404__content--header__location">
                {locRef.current || '404'}
              </div>
            </div>

            <div className="custom-404__content--content" />
          </div>
        </div>
      </div>
    </>
  );
};

export default Custom404;
