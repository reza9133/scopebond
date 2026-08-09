// @ts-nocheck
import { createClient } from 'genlayer-js';
import { custom } from 'viem';
import { BRADBURY_NETWORK_PARAMS } from './config';

const customChain = {
  id: BRADBURY_NETWORK_PARAMS.chainId,
  name: BRADBURY_NETWORK_PARAMS.chainName,
  nativeCurrency: BRADBURY_NETWORK_PARAMS.nativeCurrency,
  rpcUrls: {
    default: { http: BRADBURY_NETWORK_PARAMS.rpcUrls },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: BRADBURY_NETWORK_PARAMS.blockExplorerUrls[0] },
  },
};

export const readClient = createClient({ chain: customChain });

export function createWriteClient(account: string) {
  const eth = (window as any).ethereum;
  return createClient({
    chain: customChain,
    account: account as any,
    transport: custom(eth),
  });
}

export async function ensureBradburyNetwork() {
  const eth = (window as any).ethereum;
  if (!eth) throw new Error('MetaMask not found.');

  const chainIdHex = '0x107d';

  try {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
  } catch (switchError: any) {
    if (switchError.code === 4902 || String(switchError?.message).includes('4902')) {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: chainIdHex,
            chainName: BRADBURY_NETWORK_PARAMS.chainName,
            nativeCurrency: BRADBURY_NETWORK_PARAMS.nativeCurrency,
            rpcUrls: BRADBURY_NETWORK_PARAMS.rpcUrls,
            blockExplorerUrls: BRADBURY_NETWORK_PARAMS.blockExplorerUrls,
          },
        ],
      });
    } else {
      throw switchError;
    }
  }
}
