import { format } from "path";
import { dateFormat } from "./userExperienceFormats";


const createBuildDate = () => dateFormat(new Date(), {format: "MM-DD-YYYY", time: true, returnType: "string"});
export default createBuildDate;
