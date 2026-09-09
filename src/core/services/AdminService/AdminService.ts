import { encryptString } from "@webstack/helpers/Encryption";
import environment from "../../environment";
import { ApiError } from "../ApiService";
import FleetService from "./FleetService";

import IAdminService, { IFlipperActionResponse, IFlipperSavedResponse, IFlipperStatus, IRemoteAccessResponse } from "./IAdminService";
const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION?.trim();

/**
 * Commerce / customer / peripheral slice of the admin API. All
 * system-and-fleet administration methods (docker, device config,
 * fleet config, GPIO) are inherited from FleetService.
 */
export default class AdminService
  extends FleetService
  implements IAdminService {
  constructor() {
    super(environment.serviceEndpoints.membership);
  }

  // Admin requests authenticate as the signed-in admin via the base class's
  // session JWT (auth-token). We intentionally do NOT inject a static service
  // token here — a static export ships client JS publicly, so any baked-in
  // bearer would be a privileged credential leak. Authorization is enforced
  // backend-side by the admin user's role.

  public async deleteProduct(productId: string, price_id?: string): Promise<any> {
    if (productId) {
      try {
        const customer = await this.get<any>(`/product/delete?id=${price_id ? `${productId}&price_id=${price_id}` : productId}`);
        return customer;
      } catch (error: any) {
        return error;
      }
    } else throw new ApiError("No PRODUCT Provided", 400, "MS.SI.02");
  };

  public async createProduct(productData: any): Promise<any> {
    if (!productData) throw new ApiError("No PRODUCT Provided", 400, "MS.SI.02");

    const {
      id,
      name,
      active,
      description,
      metadata = {},
      price,
      imageFiles = [],
      imageFilenames = [],
      merchant_id,
      marketing_features,
      priceImageMap = [],
    } = productData;

    const formData = new FormData();
    const fld = (k: string, v: any, cond = true) => cond && formData.append(k, v);

    // Only append id when it's a real value
    const validId =
      id != null &&
      String(id).trim() !== "" &&
      id !== "undefined" &&
      id !== "null";

    fld("id", id, validId);
    fld("name", name);
    fld("active", String(Boolean(active)));         // normalize
    fld("description", description || "");
    fld("merchant_id", merchant_id);
    fld("metadata", JSON.stringify(metadata || {}));
    fld("marketing_features", JSON.stringify(marketing_features), Array.isArray(marketing_features));
    fld("price", JSON.stringify(price));            // you already send cents upstream
    fld(
      "price_image_map",
      JSON.stringify(priceImageMap),
      Array.isArray(priceImageMap) && priceImageMap.length > 0
    );

    for (const file of imageFiles) {
      // Only append actual File instances with valid names and proper extensions
      if (
        file instanceof File &&
        typeof file.name === 'string' &&
        file.name.length > 0 &&
        file.name.includes('.') &&  // Must have an extension
        file.size > 0
      ) {
        fld("imageFiles", file);
      }
    }

    fld("filenames", JSON.stringify(imageFilenames), Array.isArray(imageFilenames) && imageFilenames.length > 0);

    try {
      return await this.post<FormData, any>("/product/", formData);
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ||
        error?.detail ||
        (typeof error === "string" ? error : "Unexpected error");

      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Product creation failed";

      const status = error?.response?.status || 400;

      throw { message, detail, status, error: true };
    }
  }

  public async setupRemoteAccess(): Promise<IRemoteAccessResponse> {
    try {
      const response = await this.post<any, any>(`/remote-access/setup`, {});
      return response;
    } catch (error: any) {
      return error;
    }
  }

  // THREATS
  public async listThreats(): Promise<any> {
    try {
      // TODO NOT LIST THREATS, SUPPOSED TO LOG THEIR STUFF
      return;
    } catch (error: any) {
      return error;
    }
  };

  // ACCOUNTS
  public async getAccount(accountId: string): Promise<any> {
    try {
      const account = await this.get<any>(`/account?id=${accountId}`);
      return account;
    } catch (error: any) {
      return error;
    }
  };

  public async listAccounts(): Promise<any> {
    try {
      const accountsList = await this.get<any>(`/accounts/`);
      return accountsList;
    } catch (error: any) {
      return error;
    }
  };

  // CUSTOMERS
  public async getCustomer(customerId: string): Promise<any> {
    if (customerId) {
      try {
        const customer = await this.get<any>(`/usage/admin/customer?id=${customerId}`);
        return customer;
      } catch (error: any) {
        return error;
      }
    } else throw new ApiError("No Token Provided", 400, "MS.SI.02");
  };

  public async deleteCustomers(customerIds: string[]): Promise<any> {
    if (customerIds) {
      try {
        const customer = await this.post<any, any>(`/usage/admin/customer/delete`, { ids: customerIds });
        return customer;
      } catch (error: any) {
        return error;
      }
    } else throw new ApiError("No Token Provided", 400, "MS.SI.02");
  };

  public async listCustomers(page?: number, perPage?: number, search?: string): Promise<any> {
    try {
      const params = new URLSearchParams();
      if (typeof page === "number") params.append("page", String(page));
      if (typeof perPage === "number") params.append("per_page", String(perPage));
      if (typeof search === "string" && search.trim().length > 0) {
        params.append("search", search.trim());
      }
      const query = params.toString();

      const url = `/usage/admin/customer/list${query ? `?${query}` : ""}`;
      const customersList = await this.get<any>(url);
      return customersList;
    } catch (error: any) {
      return error;
    }
  };

  public async updateCustomer(customer: any): Promise<any> {
    if (customer) {
      const encryptedCustomerData = encryptString(JSON.stringify(customer), ENCRYPTION_KEY);
      return await this.put<any, any>(`/usage/admin/customer`, { data: encryptedCustomerData });
    }
    if (!customer) throw new ApiError("NO MEMBER DATA PROVIDED", 400, "MS.SI.02");
  };

  public async createCustomer(customer: any): Promise<any> {
    try {
      if (customer) {
        const encryptedCustomerData = encryptString(JSON.stringify(customer), ENCRYPTION_KEY);
        return await this.post<any, any>(`/usage/admin/customer/create`, { data: encryptedCustomerData });
      }
      if (!customer) throw new ApiError("NO MEMBER DATA PROVIDED", 400, "MS.SI.02");
    } catch (e: any) {
      console.error("[ ERROR CREATING CUSTOMER ]", e)
    }
  };

  // PRICES
  public async getPrice(priceId: string): Promise<any> {
    if (priceId) {
      try {
        const customer = await this.get<any>(`/price/?id=${priceId}`);
        return customer;
      } catch (error: any) {
        return error;
      }
    } else throw new ApiError("No PriceID Provided", 400, "MS.SI.02");
  };

  public async deletePrice(priceId: string): Promise<any> {
    if (priceId) {
      try {
        const deleted = await this.get<any>(`/price/delete?id=${priceId}`);
        return deleted;
      } catch (error: any) {
        return error;
      }
    } else throw new ApiError("No PRODUCT Provided", 400, "MS.SI.02");
  };

  // FLIPPER ZERO
  public async getFlipperStatus(): Promise<IFlipperStatus> {
    return this.get<IFlipperStatus>("/flipper/status");
  }

  public async flipperVibrate(payload: { duration?: number }): Promise<IFlipperActionResponse> {
    return this.post<typeof payload, IFlipperActionResponse>("/flipper/vibrate", payload);
  }

  public async flipperInfrared(payload: { signal: string; repeat?: number }): Promise<IFlipperActionResponse> {
    return this.post<typeof payload, IFlipperActionResponse>("/flipper/infrared", payload);
  }

  public async flipperSubGhz(payload: { payload: string; repeat?: number; remember?: boolean }): Promise<IFlipperActionResponse> {
    return this.post<typeof payload, IFlipperActionResponse>("/flipper/subghz", payload);
  }

  public async getFlipperSavedSubGhz(): Promise<IFlipperSavedResponse> {
    return this.get<IFlipperSavedResponse>("/flipper/subghz/saved");
  }

  public async ingestFlipperSavedSubGhz(): Promise<IFlipperSavedResponse> {
    return this.post<undefined, IFlipperSavedResponse>("/flipper/subghz/ingest");
  }

  public async flipperPushFile(file: File): Promise<IFlipperActionResponse> {
    const formData = new FormData();
    formData.append("file", file);
    return this.post<FormData, IFlipperActionResponse>("/flipper/file", formData);
  }

  public async flipperReboot(): Promise<IFlipperActionResponse> {
    return this.post<undefined, IFlipperActionResponse>("/flipper/reboot");
  }
}
