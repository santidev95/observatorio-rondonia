import { revenueSourceUrl } from "../../core/revenues";
import { createPublicaRevenues } from "../publica/revenues";

export const ariquemesRevenuesSource = (year: number) =>
  revenueSourceUrl("ariquemes", year);
export const fetchAriquemesRevenues = createPublicaRevenues("ariquemes");
