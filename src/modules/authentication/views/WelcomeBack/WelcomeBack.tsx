import React from 'react';
import { useRouter } from 'next/router';
import styles from './WelcomeBack.scss';
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";
import UiButtonGroup from "@webstack/components/UiForm/components/UiButtonGroup/controller/UiButtonGroup";
import keyStringConverter from '@webstack/helpers/keyStringConverter';
import useDynamicRoutes from "~/src/core/authentication/hooks/useDynamicRoutes";
import { useModal } from '@webstack/components/Containers/modal/contexts/modalContext';
import { routesToButtons } from './utils/routesToButtons';

interface IWelcomeBack {
  user: { name?: string;[key: string]: any };
  onClose?: () => void;
}

const WelcomeBack: React.FC<IWelcomeBack> = ({ user, onClose }) => {
  const routes = useDynamicRoutes();
  const { push } = useRouter();
  const { closeModal } = useModal();
  const btns = routesToButtons(routes, (href) => {
    if (!href) return;
    closeModal();
    push(href);
  });
  return (
    <>
      <style jsx>{styles}</style>
      <div className="welcome">
        <h3>Welcome Back, {keyStringConverter(user.name || "", { textTransform: "capitalize" })}</h3>
        <UiButtonGroup variant="nav-item" direction='ttb' btns={btns} />
        <div className="welcome__close">
          <UiButton onClick={onClose}>Close</UiButton>
        </div>
      </div>
    </>
  );
};

export default WelcomeBack;
