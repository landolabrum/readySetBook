import React from "react";
import { serviceProvider } from "@webstack/common";
import environment from "~/src/core/environment";
import MemberService from "~/src/core/services/MemberService/MemberService";
import ProductService from "~/src/core/services/ProductService/ProductService";
import HomeService from "~/src/core/services/HomeService/HomeService";
import SurveillanceService from "~/src/core/services/SurveillanceService/SurveillanceService";
import AdminService from "~/src/core/services/AdminService/AdminService";
import DocumentService from "~/src/core/services/DocumentService/DocumentService";
import SocialService from "~/src/core/services/SocialService/SocialService";
import GuestService from "~/src/core/services/GuestService/GuestService";
import GPTService from "~/src/core/services/GPTService/GPTService";
import PaywallService from "~/src/core/services/PaywallService/PaywallService";
import IDataBaseService from "~/src/core/services/DataBaseService/DataBaseService";
import YoutubeService from "~/src/core/services/YoutubeService/YoutubeService";
import RoutesService from "~/src/core/services/RoutesService/RoutesService";
import DownloadService from "~/src/core/services/DownloadService/DownloadService";

interface IProps { }
export default class ServiceContainer extends React.Component<IProps> {
  constructor(props: IProps) {
    super(props);
    const mock = environment.devSettings?.mockApis;
    serviceProvider.registerService("IMemberService", MemberService);
    serviceProvider.registerService("IProductService", ProductService);
    serviceProvider.registerService("IGuestService", GuestService);
    serviceProvider.registerService("IHomeService", HomeService);
    serviceProvider.registerService("ISurveillanceService", SurveillanceService);
    serviceProvider.registerService("IAdminService", AdminService);
    serviceProvider.registerService("IDocumentService", DocumentService);
    serviceProvider.registerService("ISocialService", SocialService);
    serviceProvider.registerService("IGPTService", GPTService);
    serviceProvider.registerService("IPaywallService", PaywallService);
    serviceProvider.registerService("IDataBaseService", IDataBaseService);
    serviceProvider.registerService("IYoutubeService", YoutubeService);
    serviceProvider.registerService("IRoutesService", RoutesService);
    serviceProvider.registerService("IDownloadService", DownloadService);
  }

  render() {
    return <></>;
  }
}
