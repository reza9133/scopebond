// @ts-nocheck
import { createClient } from 'genlayer-js';
import { BRADBURY_NETWORK_PARAMS } from './config';

const customChain = {
  id: 4221,
  name: BRADBURY_NETWORK_PARAMS.chainName,
  nativeCurrency: BRADBURY_NETWORK_PARAMS.nativeCurrency,
  rpcUrls: {
    default: { http: ['https://rpc-bradbury.genlayer.com'] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://explorer-bradbury.genlayer.com' },
  },
};

export const readClient = createClient({ chain: customChain });

export function createWriteClient(account: string) {
  const eth = (window as any).ethereum;
  return createClient({
    chain: customChain,
    account: account as any,
    provider: eth,
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
            rpcUrls: ['https://rpc-bradbury.genlayer.com'],
            blockExplorerUrls: ['https://explorer-bradbury.genlayer.com'],
          },
        ],
      });
    } else {
      throw switchError;
    }
  }
}
