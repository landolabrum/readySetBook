import ApiService, { ApiError } from "../ApiService";
import { getService } from "@webstack/common";
import environment from "~/src/core/environment";
import IProductService, { IGetProduct } from "./IProductService"
import IMemberService from "../MemberService/IMemberService";

const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION?.trim();

export default class ProductService extends ApiService implements IProductService {

  private MemberService: IMemberService;

  constructor() {
    const rawEndpoint =
      environment.serviceEndpoints.shopping ||
      environment.serviceEndpoints.membership ||
      environment.serviceEndpoints.social ||
      "";
    const endpoint = String(rawEndpoint).trim();
    // Treat common placeholder values as missing.
    const normalized =
      endpoint === "" || endpoint === "undefined" || endpoint === "null" ? "" : endpoint;

    super(normalized);
    this.MemberService = getService<IMemberService>('IMemberService');
  }
  public async getProducts(request: Record<string, any>): Promise<any> {
    if(request==null || request==undefined) return;
    // Build query params including search, filters, pagination
    const queryParams = new URLSearchParams();

    Object.entries(request).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        queryParams.append(key, String(value));
      }
    });

    const url = `/products${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

    // console.log("request URL:", url);

    const products = await this.get<any>(url);

    if (products) {
      const parseToken = (token: string): any => {
        const segments = token.split('.');
        if (segments.length !== 3) return null;

        const encodedPayload = segments[1].replace(/-/g, '+').replace(/_/g, '/');
        try {
          const decodedPayload = window.atob(encodedPayload);
          return JSON.parse(decodedPayload);
        } catch (error) {
          console.error('Error decoding JWT payload', error, '[MemberService.ts]');
          return null;
        }
      };

      const decrypted = parseToken(products);
      return decrypted;
    }

    return { error: true };
  }


  public async getProduct({ id, pri }: IGetProduct): Promise<any> {
    if (pri) {
      return this.get<any>(
        `/product?id=${id}&pri=${pri}`,
      );
    }
    return this.get<any>(
      `/product?id=${id}`,
    );
  }
}
