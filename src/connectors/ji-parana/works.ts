import { createPublicaWorks } from "../publica/works";

const works = createPublicaWorks("ji-parana");
export const normalizeJiParanaWork = works.normalizeWork;
export const fetchJiParanaWorks = works.fetchWorks;
