import { revenueSourceUrl } from "../../core/revenues";
import { createPublicaRevenues } from "../publica/revenues";

export const jiParanaRevenuesSource = (year: number) =>
  revenueSourceUrl("ji-parana", year);
export const fetchJiParanaRevenues = createPublicaRevenues("ji-parana");
