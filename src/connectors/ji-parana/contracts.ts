import { createPublicaContracts } from "../publica/contracts";

const contracts = createPublicaContracts("ji-parana");
export const fetchJiParanaContractsPage = contracts.fetchPage;
export const fetchJiParanaContract = contracts.fetchContract;
export const jiParanaContractId = contracts.contractId;
export const parseJiParanaContractId = contracts.parseContractId;
