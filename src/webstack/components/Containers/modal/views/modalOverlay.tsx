import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ModalContext, ModalContextType } from '../contexts/modalContext';
import styles from "./modalOverlay.scss";
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import { useRouter } from 'next/router';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import useKeyBoard from '@webstack/hooks/interfaces/useKeyBoard/useKeyBoard';

const ModalOverlay: React.FC<any> = () => {
  const { keyPressed, lastKeyPressed } = useKeyBoard();
  const modalRef = useRef<HTMLDivElement>(null);
  const { isModalOpen, closeModal, modalContent, replaceModal }: ModalContextType = useContext(ModalContext) as ModalContextType;
  const router = useRouter();
  const [hovered, setHovered] = useState<boolean>(false);

  useEffect(() => { if (keyPressed?.includes("Escape")) closeModal() }, [keyPressed]);
  // ✅ Fix: useEffect MUST come before conditional returns
  const normalizedModal = useMemo(() => {
    if (!modalContent) return null;
    // Allow callers to pass a bare ReactNode; wrap it as children so we render it.
    if (React.isValidElement(modalContent) || typeof modalContent === "string" || typeof modalContent === "number") {
      return { children: modalContent };
    }
    return modalContent as any;
  }, [modalContent]);

  const {
    confirm,
    title,
    children,
    footer,
    variant,
    dismissable = true,
    overlayOnly = false,
    zIndex,
  }: any = normalizedModal || {};

  const hasBodyContent = Boolean(children) || Boolean(confirm) || Boolean(footer) || Boolean(title);
  const shouldShowOverlay = Boolean(isModalOpen && normalizedModal && (overlayOnly || hasBodyContent));
  const shouldShowModal = Boolean(shouldShowOverlay && !overlayOnly && hasBodyContent);

  useEffect(() => {
    if (shouldShowOverlay) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [shouldShowOverlay]);

  // If someone opened the modal without renderable content, clean it up to avoid stray overlays.
  useEffect(() => {
    if (!isModalOpen) return;

    // No content / context - close immediately
    if (!normalizedModal) {
      closeModal();
      return;
    }

    // Normalized content exists but there's no actual body content and this is not an overlay-only call
    if (normalizedModal && !overlayOnly && !hasBodyContent) {
      closeModal();
    }
  }, [isModalOpen, normalizedModal, overlayOnly, hasBodyContent, closeModal]);

  if (!shouldShowOverlay) return null;

  // ModalOverlay.tsx (only handleClick changed)
  const handleClick = (btn: any) => {
    btn?.onClick && btn.onClick();
    if (btn?.href) router.push(btn.href);

    if (btn?.replace) {
      // swap content in-place
      replaceModal(btn.replace);
      return;
    }

    // default: close unless explicitly told not to
    if (btn?.closeOnClick !== false) {
      closeModal();
    }
  };


  const classMaker = (c: string): string => {
    let returnedClass = c;
    if (!dismissable) returnedClass += ' modal__overlay--no-dismiss';
    else if (!returnedClass && !variant) return '';
    else if (returnedClass && variant) return `${returnedClass} ${c}__${variant}`;
    return returnedClass;
  };

  const handleMouseEnter = () => setHovered(true);
  const handleMouseLeave = () => setHovered(false);

  const handleClose = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dismissable && e.target === e.currentTarget) {
      closeModal();
    }
  };
  if (!shouldShowModal) return null;
  return (
    <>
      <style jsx>{styles}</style>
      <div
        onClick={handleClose}
        id='modal-main'
        className={classMaker("modal__overlay")}
        style={zIndex ? { zIndex } : undefined}
      />
      {shouldShowModal && (
        <div
          ref={modalRef}
          className={classMaker("modal")}
          style={zIndex ? { zIndex: zIndex + 1 } : undefined}
        >
          <div className={classMaker("modal__header")}>
            <div className='modal-overlay__title'>
              {title}
              {/* <UiTextBalance
              text={title}
              direction='row'
              /> */}
            </div>
            {dismissable && (
              <div
                className='close-btn'
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <UiIcon icon={"fa-xmark"} size="lg" onClick={closeModal} />
              </div>
            )}
          </div>
          <div className={classMaker("modal__body")}>
            <div className={classMaker("modal__body--content")}>
              {children}
              {confirm && (
                <div className='modal-overlay__confirm--header header'>
                  {confirm?.title && <div className='header--title'>{confirm.title}</div>}
                  {confirm?.body && <div className='header--bg-primary'>{confirm.body}</div>}
                </div>
              )}
              {confirm && (
                <div className={`modal-overlay__confirm ${confirm.statements.length > 2 ? "modal-overlay__confirm-col" : ""}`}>
                  {confirm.statements.map((btn: any, index: number) => (
                    <UiButton
                      key={index}
                      onClick={() => handleClick(btn)}
                      variant={btn.label === 'yes' ? 'primary' : btn?.variant || "inherit"}
                    >
                      {btn.label}
                    </UiButton>
                  ))}
                </div>
              )}
            </div>
          </div>
          {footer && <div className='modal__footer'>{footer}</div>}
        </div>
      )}
    </>
  );
};

export { ModalOverlay };
