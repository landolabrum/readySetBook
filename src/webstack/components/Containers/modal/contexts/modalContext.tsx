import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { IFormControlVariant } from '@webstack/components/AdapTable/models/IVariant';

// modalContext.tsx (types only — keep the rest the same)
export type IConfirm = {
  title?: string | React.ReactElement;
  statements?: {
    label?: string;
    onClick?: (e: any) => void;
    href?: string;
    variant?: IFormControlVariant;
    /** NEW: keep modal open when false (default true) */
    closeOnClick?: boolean;
    /** NEW: replace the current modal with this content */
    replace?: IModalContent;
  }[] | undefined;
  body?: any;
} | undefined;


export interface IModal {
  title?: string | ReactNode;
  children?: ReactNode | null | string;
  footer?: ReactNode;
  variant?: "popup" | 'fullscreen' | 'container';
  dismissable?: boolean;
  confirm?: IConfirm;
  zIndex?: number;
  /** Render only the overlay (no modal chrome). Useful for temporary locks. */
  overlayOnly?: boolean;
}

export type IModalContent = IModal | ReactNode | null;

export interface ModalContextType {
  confirm?: IConfirm;
  isModalOpen: boolean;
  openModal: (content: IModalContent) => void;
  closeModal: () => void;
  modalContent: IModalContent;
  replaceModal: (content: IModalContent) => void;
}

export const ModalContext = createContext<ModalContextType | undefined>(undefined);

interface Props {
  children: any;
}

export const ModalProvider: React.FC<Props> = ({ children }) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalContent, setModalContent] = useState<IModalContent>(null);

  const openModal = (content: IModalContent) => {
    setIsModalOpen(true);
    setModalContent(content);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalContent(null);
  };

  const replaceModal = (content: IModalContent) => {
    if (isModalOpen) {
      setModalContent(content);
    } else {
      openModal(content);
    }
  };

  return (
    <ModalContext.Provider value={{ isModalOpen, openModal, closeModal, modalContent, replaceModal }}>
      {children}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const next = document.getElementById("__next");
    if (!next) return;

    next.style.maxHeight = context?.isModalOpen ? "100vh" : "";
    return () => {
      next.style.maxHeight = "";
    };
  }, [context?.isModalOpen]);

  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }

  return context;
};
