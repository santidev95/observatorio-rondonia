import { publicaSource } from "../../core/municipal-sources";
import { publicaTransport } from "../publica/transport";
export {
  publicaText as jiText,
  publicaMoney as jiMoney,
  publicaDate as jiDate,
} from "../publica/transport";
export type { PublicaPage as JiParanaPage } from "../publica/transport";
const source = publicaSource("ji-parana");
const transport = publicaTransport("ji-parana");
export const JI_PARANA_ORIGIN = source.apiOrigin;
export const JI_PARANA_COMPANY = source.company;
export const currentJiParanaYear = transport.currentYear;
export const configureJiParanaRateLimit = transport.configureRateLimit;
export const jiParanaFetch = transport.fetch;
export const jiParanaUrl = transport.url;
export const fetchJiParanaJson = transport.fetchJson;
export const readJiParanaPage = transport.readPage;
export const collectJiParanaPages = transport.collectPages;
