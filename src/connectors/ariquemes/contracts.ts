import { createPublicaContracts } from "../publica/contracts";

const contracts = createPublicaContracts("ariquemes");
export const fetchAriquemesContractsPage = contracts.fetchPage;
export const fetchAriquemesContract = contracts.fetchContract;
export const ariquemesContractId = contracts.contractId;
export const parseAriquemesContractId = contracts.parseContractId;
