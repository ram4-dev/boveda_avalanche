import { FUJI_CHAIN_ID, type FujiContractsConfig } from './fujiContracts.js';

export const DEFAULT_FUJI_RPC_URL = 'https://api.avax-test.network/ext/bc/C/rpc';

export type FujiReadOnlyContractStatus = {
  name: string;
  address: string;
  bytecodePresent: boolean;
  bytecodeBytes: number;
};

export type FujiReadOnlyStatus = {
  ok: boolean;
  mode: 'fuji';
  rpcUrlSource: 'default-public' | 'env:BOVEDA_FUJI_RPC_URL' | 'test';
  chainId: number | null;
  expectedChainId: typeof FUJI_CHAIN_ID;
  contracts: FujiReadOnlyContractStatus[];
  errors: string[];
};

export type JsonRpcRequester = (method: string, params: unknown[]) => Promise<unknown>;

export async function checkFujiReadOnlyConnection(
  contracts: FujiContractsConfig | undefined,
  options: { rpcUrlSource: FujiReadOnlyStatus['rpcUrlSource']; requestJsonRpc: JsonRpcRequester }
): Promise<FujiReadOnlyStatus> {
  const errors: string[] = [];
  const contractStatuses: FujiReadOnlyContractStatus[] = [];

  if (!contracts) {
    return {
      ok: false,
      mode: 'fuji',
      rpcUrlSource: options.rpcUrlSource,
      chainId: null,
      expectedChainId: FUJI_CHAIN_ID,
      contracts: [],
      errors: ['Fuji contracts config is missing']
    };
  }

  const chainId = await readChainId(options.requestJsonRpc, errors);
  if (chainId !== FUJI_CHAIN_ID) {
    errors.push(`Fuji RPC chainId mismatch: expected ${FUJI_CHAIN_ID}, received ${chainId ?? 'unknown'}`);
  }

  for (const [name, contract] of Object.entries(contracts.contracts)) {
    try {
      const code = await options.requestJsonRpc('eth_getCode', [contract.address, 'latest']);
      const bytecode = typeof code === 'string' ? code : '0x';
      const bytecodePresent = bytecode !== '0x' && /^0x[a-fA-F0-9]+$/.test(bytecode);
      const bytecodeBytes = bytecodePresent ? (bytecode.length - 2) / 2 : 0;
      if (!bytecodePresent) {
        errors.push(`${name} has no bytecode at ${contract.address}`);
      }
      contractStatuses.push({ name, address: contract.address, bytecodePresent, bytecodeBytes });
    } catch (error) {
      errors.push(`${name} bytecode check failed: ${safeErrorMessage(error)}`);
      contractStatuses.push({ name, address: contract.address, bytecodePresent: false, bytecodeBytes: 0 });
    }
  }

  return {
    ok: errors.length === 0,
    mode: 'fuji',
    rpcUrlSource: options.rpcUrlSource,
    chainId,
    expectedChainId: FUJI_CHAIN_ID,
    contracts: contractStatuses,
    errors
  };
}

export function createFetchJsonRpcRequester(rpcUrl: string): JsonRpcRequester {
  let id = 1;
  return async (method, params) => {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: id++, method, params })
    });
    const payload = await response.json() as { result?: unknown; error?: { message?: string } };
    if (!response.ok || payload.error) {
      throw new Error(payload.error?.message ?? `RPC request failed with status ${response.status}`);
    }
    return payload.result;
  };
}

async function readChainId(requestJsonRpc: JsonRpcRequester, errors: string[]): Promise<number | null> {
  try {
    const result = await requestJsonRpc('eth_chainId', []);
    if (typeof result !== 'string' || !/^0x[a-fA-F0-9]+$/.test(result)) {
      errors.push('Fuji RPC returned an invalid eth_chainId result');
      return null;
    }
    return Number.parseInt(result, 16);
  } catch (error) {
    errors.push(`Fuji RPC chainId check failed: ${safeErrorMessage(error)}`);
    return null;
  }
}

function safeErrorMessage(_error: unknown): string {
  // Public runtime endpoints must not reflect provider URLs, API keys embedded in URLs, or transport details.
  return 'RPC request failed';
}
