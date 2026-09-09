import CookieHelper from "@webstack/helpers/CookieHelper";

const updateTotalQty = () => {
  const raw = CookieHelper.getCookie("cart");
  if (typeof raw !== "string" || raw.trim() === "") return 0;

  try {
    const cartObject: any = JSON.parse(raw);
    const items: any[] | undefined = Array.isArray(cartObject?.items)
      ? cartObject.items
      : undefined;

    if (!items) return 0;

    return items.reduce(
      (sum: number, item: any) => sum + (item?.price?.qty || 0),
      0,
    );
  } catch (err) {
    console.error("Failed to parse cart cookie in updateTotalQty:", err);
    return 0;
  }
};

export default updateTotalQty;
