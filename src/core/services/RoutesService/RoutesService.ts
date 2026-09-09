import environment from "../../environment";
import ApiService from "../ApiService";
import IRoutesService from "./IRoutesService";
import { IDynamicRoute } from "../MemberService/IMemberService";
import { getService } from "@webstack/common";
import IMemberService from "../MemberService/IMemberService";

export default class RoutesService extends ApiService implements IRoutesService {
  constructor() {
    super(environment.serviceEndpoints.membership);
  }

  protected appendHeaders(headers: { [key: string]: string }) {
    super.appendHeaders(headers);
    const member = getService<IMemberService>("IMemberService");
    const token = member?.getCurrentUserToken?.();
    if (token) {
      headers["Authorization"] = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
    }
  }

  public async listRoutes(): Promise<IDynamicRoute[]> {
    const res = await this.get<any>("routes/all");
    return Array.isArray(res) ? res : (res?.data ?? []);
  }

  public async createRoute(body: Partial<IDynamicRoute>): Promise<IDynamicRoute> {
    return this.post<Partial<IDynamicRoute>, IDynamicRoute>("routes", body);
  }

  public async updateRoute(id: number, body: Partial<IDynamicRoute>): Promise<IDynamicRoute> {
    return this.put<Partial<IDynamicRoute>, IDynamicRoute>(`routes/${id}`, body);
  }

  public async deleteRoute(id: number): Promise<{ status: string; id: number }> {
    return this.delete<{ status: string; id: number }>(`routes/${id}`);
  }
}
