import { useState, useEffect } from "react";
import CookieHelper from "@webstack/helpers/CookieHelper";
import { IProduct } from "~/src/models/Shopping/IProduct";

const useCart = () => {
    const [total, setTotalQty] = useState<number>(0);

    const getCartItems = () => {
        const raw = CookieHelper.getCookie("cart");
        if (typeof raw !== "string" || raw.trim() === "") return [];

        try {
            // Decode URI-encoded JSON (new format), fall back to raw JSON for legacy cookies
            let jsonString = raw;
            try {
                jsonString = decodeURIComponent(raw);
            } catch {
                // ignore decode failures, raw may already be plain JSON
            }

            const parsed: any = JSON.parse(jsonString);
            const items = parsed?.items;

            if (!Array.isArray(items)) return [];

            // Normalize to a lightweight cart item shape to keep cookies small
            return items.map((item: any) => {
                const price = item?.price ?? {};
                return {
                    id: item?.id,
                    name: item?.name,
                    description: item?.description,
                    images: Array.isArray(item?.images) ? item.images : [],
                    price: {
                        id: price.id,
                        unit_amount: price.unit_amount,
                        nickname: price.nickname,
                        recurring: price.recurring,
                        qty: Number(price.qty ?? 0),
                    },
                } as IProduct;
            });
        } catch {
            // Bad/legacy cart cookie; clear it silently so future valid carts can be stored
            CookieHelper.deleteCookieSilent("cart");
            return [];
        }
    };
    const [cart, setCart] = useState<IProduct[] | null>(getCartItems());

    const updateCartInCookie = (updatedCart: IProduct[]) => {
        if (updatedCart.length === 0) {
            CookieHelper.deleteCookie("cart");
            setCart([]);
            return;
        }

        // Only persist the minimal fields needed across flows to avoid oversized cookies
        const compactCart = updatedCart.map((item) => {
            const price = item.price;
            return {
                id: item.id,
                name: item.name,
                // Description can be very large; omit from cookie to avoid Safari size issues.
                images: Array.isArray(item.images) ? item.images : [],
                price: {
                    id: price.id,
                    unit_amount: price.unit_amount,
                    nickname: price.nickname,
                    recurring: price.recurring,
                    qty: Number(price.qty ?? 0),
                },
            } as IProduct;
        });

        const serialized = JSON.stringify({ items: compactCart });
        const encoded = encodeURIComponent(serialized);

        CookieHelper.setCookie("cart", encoded, { path: "/" });
        setCart(compactCart);
    };
const addCartItem = (newItem: IProduct) => {
    const currentCart = getCartItems();
    // Find if the item already exists in the cart based on both product.id and price.id
    const existingIndex = currentCart.findIndex(item => 
        item.price.id === newItem.price.id
    );
    
    if (existingIndex > -1) {
        const existingItem = currentCart[existingIndex];
        
        if (newItem.price.qty === 0) {
            // Remove the item from the cart if its quantity becomes 0
            currentCart.splice(existingIndex, 1);
        } else {
            // Update the quantity of the existing item
            existingItem.price.qty = Number(newItem.price.qty);
        }
    } else {
        if (newItem.price.qty !== 0) {
            // Add the new item to the cart only if its quantity is not 0
            currentCart.push(newItem);
        }
    }
    
    updateCartInCookie(currentCart);
};


    useEffect(() => {
        const updateCart = () => {
            setCart(getCartItems());
        };

        const cookieChangeHandler = (e: CustomEvent) => {
            if (e.detail.cookieName === "cart") {
                updateCart();
            }
        };

        window.addEventListener("cookieChange", cookieChangeHandler as EventListener);
        return () => window.removeEventListener("cookieChange", cookieChangeHandler as EventListener);
    }, []);
    useEffect(() => {
        if (cart) {
            const newTotalQty = cart.reduce((sum: number, item: any) => sum + (item?.price?.qty || 0), 0);
            setTotalQty(newTotalQty);
        }
    }, [cart]); 
    return { cart, addCartItem, total };
};

export default useCart;
