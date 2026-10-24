import { createPublicaWorks } from "../publica/works";

const works = createPublicaWorks("ariquemes");
export const normalizeAriquemesWork = works.normalizeWork;
export const fetchAriquemesWorks = works.fetchWorks;
