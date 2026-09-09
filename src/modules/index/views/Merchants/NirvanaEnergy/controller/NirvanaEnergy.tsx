// Relative Path: ./MbOne.tsx
import React, { useEffect, useState } from 'react';
import styles from "./NirvanaEnergy.scss";
import AdaptGrid from '@webstack/components/Containers/AdaptGrid/AdaptGrid';
import HomeGridItem from '../../../HomeGridItem/HomeGridItem';
import UiMedia from '@webstack/components/UiMedia/controller/UiMedia';
import useWindow from '@webstack/hooks/window/useWindow';
import { useRouter } from 'next/router';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import { getService } from '@webstack/common';
import FullPageBackground from '@webstack/components/Text/FullPageBackground/FullPageBackground';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import ProductsPage from '~/src/pages/services';
import { useModal } from '@webstack/components/Containers/modal/contexts/modalContext';
import ContactUs from '@shared/components/Contact/forms/ContactUs/ContactUs';
import UiSnapPageLayout from '@webstack/layouts/UiSnapPageLayout/UiSnapPageLayout';

const NirvanaEnergy = () => {
  const { width } = useWindow();
  const { push } = useRouter();
  const { openModal } = useModal();
  const [snapIndex, setSnapIndex] = useState(0);

  const handleModal = (cmd: 'terms' | 'privacy' | 'contact') => {
    if (cmd === 'terms') push('/terms-and-conditions');
    else if (cmd === 'privacy') push('/privacy-policy');
    else if (cmd === 'contact') openModal({ children: <ContactUs /> });
    else push('/');
  };

  useEffect(() => {
    const service: any = getService("IAdminService");
    service?.listThreats?.().catch(console.error);
  }, []);

  const isDesktop = width > 1100;

  type ModalKey = "terms" | "privacy" | "contact";
  const modalLinks: Record<ModalKey, string> = {
    terms: "Terms & Conditions",
    privacy: "Privacy Policy",
    contact: "Contact Us",
  };

  /* ─── Snap-page views ────────────────────────────────────────────── */
  const servicesView = (
    <>
      <style jsx>{styles}</style>
      <div id="Nirvana Energy Services" className="nirvana-energy__content--services">
        <div>Services</div>
        <ProductsPage hide={['header']} showLayoutSelector={false} variant={width > 1100 ? "carousel" : "view"} />
      </div>
    </>
  );
  // View 0 — Hero
  const heroView = (
    <>
      <style jsx>{styles}</style>
      <div
        className="nirvana-energy__bg-overlay"
        // onClick={() => setSnapIndex(1)}
        role="button"
        aria-label="Scroll to content"
      >
        <FullPageBackground
          src={`${process.env.NEXT_PUBLIC_FILESERVER_BASE_URL ?? "https://mb1-orch-1.tiktok.soy/files/"}srv/nirv1/broll/SolarPanelDesert.png`}

        >
          <div
            className="nirvana-energy__content--hero"
          >
            <div
              className="nirvana-energy__build glass"
              onClick={(e) => {
                e.stopPropagation();
                push("/build");
              }}>
              Nirvana Energy
              <UiIcon icon="nirvana-energy-logo" />

<div>
              <UiButton size="xxl" variant="primary">Build & Price</UiButton>
</div>
            </div>
            {/* {isDesktop && servicesView} */}
          </div>
        </FullPageBackground>
        <div className="nirvana-energy__content--cta">




          <div>
            <UiButton
              traits={{ afterIcon: "fa-chevron-down" }}
              onClick={(e) => { e.stopPropagation(); setSnapIndex(1); }}
            >

              more
            </UiButton>
          </div>
        </div>
      </div>
    </>
  );
  // View 3 — Why Batteries + Footer
  const whyBatteriesView = (
    <>
      <style jsx>{styles}</style>
      <div className="nirvana-energy__section">
        <div className="nirvana-energy__content--title">
          The Importance of Backup Batteries
        </div>
        <div className="s-h-100">
          <div>

            <AdaptGrid sm={1} md={3} margin={isDesktop ? '0 0 45px' : undefined} gap={15}>
              <HomeGridItem icon="fal-cloud-bolt-sun" title="power outages">
                With backup batteries, you can be sure your home will have power even during outages...
              </HomeGridItem>
              <HomeGridItem icon="fa-globe" title="environmental concerns">
                Using solar battery backup systems helps reduce your carbon footprint...
              </HomeGridItem>
              <HomeGridItem icon="fal-circle-dollar" title="cost savings">
                Solar battery backup systems can help you save money in the long run...
              </HomeGridItem>
            </AdaptGrid>
          </div>
        </div>
        { (servicesView)}
        {/* {(!isDesktop && servicesView)} */}
        <div className="nirvana-energy__footer">
          ROC: 357597
          <div className="nirvana-energy__footer--links">
            {(Object.entries(modalLinks) as [ModalKey, string][]).map(([key, label]) => (
              <div key={key}>
                <UiButton variant="link" onClick={() => handleModal(key)}>
                  {label}
                </UiButton>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  // View 1 — Intro (title + video)
  const introView = (
    <>
      <style jsx
      >{styles}</style>
      <div className="nirvana-energy__section">
        <div className="nirvana-energy__content--title">
          Protect your future, create your Nirvana.
        </div>
        <div className="nirvana-energy__content--label">
          On and Off-grid battery back up If you&apos;re thinking about going off grid or want to learn more about
          backup battery systems, it&apos;s time to create your Nirvana.
        </div>
        <UiMedia
          type="video"
          controls
          muted={isDesktop}
          autoplay={isDesktop}
          variant='contain'
          poster={
            <img
              alt="nirv1-home"
              className="d-flex s-w-100"
              src="/merchant/nirv1/videos/nirv1_index1-poster.png"
            />
          }
          src="/merchant/nirv1/videos/nirv1_index1.mp4"
        />
      </div>
    </>
  );




  return (
    <UiSnapPageLayout
      currentViewIndex={snapIndex}
      onViewChange
      ={setSnapIndex}
      views={[heroView, introView, whyBatteriesView]}
    />
  );
};

export default NirvanaEnergy;
