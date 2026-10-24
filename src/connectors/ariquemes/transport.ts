import { publicaSource } from "../../core/municipal-sources";
import { publicaTransport } from "../publica/transport";
export {
  publicaText as ariquemesText,
  publicaMoney as ariquemesMoney,
  publicaDate as ariquemesDate,
} from "../publica/transport";
export type { PublicaPage as AriquemesPage } from "../publica/transport";
const source = publicaSource("ariquemes");
const transport = publicaTransport("ariquemes");
export const ARIQUEMES_ORIGIN = source.apiOrigin;
export const ARIQUEMES_COMPANY = source.company;
export const currentAriquemesYear = transport.currentYear;
export const configureAriquemesRateLimit = transport.configureRateLimit;
export const ariquemesFetch = transport.fetch;
export const ariquemesUrl = transport.url;
export const fetchAriquemesJson = transport.fetchJson;
export const readAriquemesPage = transport.readPage;
export const collectAriquemesPages = transport.collectPages;
