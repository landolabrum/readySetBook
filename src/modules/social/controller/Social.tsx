import React from 'react';
import styles from './Social.scss';
import Twitch from '../views/twitch/controller/Twitch';
import { useUser } from '~/src/core/authentication/hooks/useUser';
import Instagram from '../views/instagram/controller/Instagram';
import UiRadioLayout, { UiRadioLayoutView } from '@webstack/layouts/UiRadioLayout/controller/UiRadioLayout';

// Remember to create a sibling SCSS file with the same name as this component

const Social: React.FC = () => {
  const user = useUser();
  const views: UiRadioLayoutView[] = [
    { id: 'instagram', label: 'Instagram', content: <Instagram user={user ?? {}} /> },
    { id: 'twitch', label: 'Twitch', content: <Twitch user={user ?? {}} /> },
  ];
  return (
    <>
      <style jsx>{styles}</style>
      <div className="social">
        <UiRadioLayout
          views={views}
          collapsed={false}
          layout={{ orientation: 'vertical', navigationPosition: 'top' }}
        />
      </div>
    </>
  );
};

export default Social;
