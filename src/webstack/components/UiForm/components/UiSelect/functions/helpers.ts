import React from "react";

export type OpenDirection = "up" | "down" | "left" | "right";
export type TitleProps = any;

export const normalizeOptions = (options: any[], input?: boolean, customInput?: string) => {
    if (!Array.isArray(options)) return [];
    const nextOptions = [...options];
    if (input && customInput && !options.some(opt => opt?.value === customInput)) {
        nextOptions.push({ label: customInput, value: customInput });
    }
    return nextOptions;
};

export const hasNestedOptions = (options: any[]) =>
    options.some((opt: any) => Array.isArray(opt?.items) && opt.items.length);

export const filterOptions = (
    options: any[],
    isOpen: "open" | "closed",
    search?: boolean,
    searchValue?: string
) => {
    if (isOpen !== "open" || !search || !searchValue?.trim()) return options;
    const q = searchValue.trim().toLowerCase();
    const haystack = (o: any) =>
        [o?.name, o?.label, o?.value]
            .filter(Boolean)
            .map((v: any) => String(v).toLowerCase())
            .join(" ");
    return options.filter(o => haystack(o).includes(q));
};

export const isAnySelected = (options: any[]) =>
    options.some(option => option?.active);

export const computeSelectedLabel = (options: any[], value?: string | null) => {
    if (typeof value !== "string") return null;
    const match = options.find((o: any) => String(o?.value) === String(value));
    return match?.label ?? null;
};

export const submenuSideClass = (openDirection: OpenDirection) =>
    openDirection === "left"
        ? "select__options-inner--submenu-left"
        : "select__options-inner--submenu-right";

export const isTitleObject = (
    title?: TitleProps
): title is { text?: string | number; beforeIcon?: string; postIcon?: string } =>
    typeof title === "object" && !React.isValidElement(title);

interface AfterIconConfig {
    traits?: any;
    variant?: any;
    isMenuOpen: boolean;
    openDirection: OpenDirection;
    clearAndClose: (e: any) => void;
}

export const buildAfterIcon = ({
    traits,
    variant,
    isMenuOpen,
    openDirection,
    clearAndClose
}: AfterIconConfig) => {
    if (variant?.includes?.("nav-item")) {
        return !isMenuOpen ? traits?.afterIcon : { icon: "fa-xmark", onClick: clearAndClose };
    }
    return isMenuOpen
        ? { icon: "fa-xmark", onClick: clearAndClose }
        : `fa-chevron-${openDirection}`;
};
