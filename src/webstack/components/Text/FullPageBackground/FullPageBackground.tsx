// Relative Path: ./FullPageBackground.tsx
import React from 'react';
import styles from './FullPageBackground.scss';
import UiMedia from '@webstack/components/UiMedia/controller/UiMedia';

// Remember to create a sibling SCSS file with the same name as this component
interface FullPageBackgroundProps {
  children: React.ReactNode;
  src: string; // URL of the background image
  onClick?: (e?: any) => void;
  // Define any props if needed
}

const FullPageBackground: React.FC<FullPageBackgroundProps> = ({ children, src, onClick }) => {

  return (
    <>
      <style jsx>{styles}</style>
      <div className='full-page-background'>

      {src && <div className='full-page-background__media'>
        <UiMedia
          variant='background'
          src={src}
         />
      </div>
      }
      <div className='full-page-background__overlay' onClick={onClick}>
        {children}
      </div>
      </div>
    </>
  );
};

export default FullPageBackground;