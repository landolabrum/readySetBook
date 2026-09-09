import { IDynamicRoute } from "../MemberService/IMemberService";

export default interface IRoutesService {
  listRoutes(): Promise<IDynamicRoute[]>;
  createRoute(body: Partial<IDynamicRoute>): Promise<IDynamicRoute>;
  updateRoute(id: number, body: Partial<IDynamicRoute>): Promise<IDynamicRoute>;
  deleteRoute(id: number): Promise<{ status: string; id: number }>;
}
