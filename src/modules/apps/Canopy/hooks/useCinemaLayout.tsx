// streamPageSetup.tsx
import { useHeader } from "@webstack/components/Containers/Header/controller/MainHeader";
import useLayout from "@webstack/layouts/default/hooks/useLayout";

import { useEffect } from "react";
// const CinemaBackground = "#00000000";
const CinemaBackground = "#0f0f0f00";
export const useCinemaLayout = (background?: any) => {
  const { layout, setLayout } = useLayout();
  const [_h, setHeader] = useHeader();

  useEffect(() => {
    // Always hide the entire header for cinema layout
    setHeader({ hide: true, hideNavbar: true, hideUiHeader: true });

    // Apply a dark background if none set, or honor explicit override
    const bg = background || CinemaBackground; // default to fully transparent
    if (!layout.background || background) {
      setLayout(prev => ({ ...prev, background: bg }));
    }

    return () => {
      // Restore header visibility on exit; other pages can override as needed
      setHeader({ hide: false, hideNavbar: false, hideUiHeader: false });
    };
  }, [background, layout.background, setLayout, setHeader]);
};