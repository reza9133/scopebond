import { createClient } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';
import { BRADBURY_NETWORK_PARAMS } from './config';

export const readClient = createClient({ chain: testnetBradbury });

export function createWriteClient(account: `0x${string}`) {
  return createClient({
    chain: testnetBradbury,
    account,
    provider: (window as any).ethereum,
  });
}

export async function ensureBradburyNetwork() {
  const eth = (window as any).ethereum;
  if (!eth) throw new Error('MetaMask not found.');

  try {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BRADBURY_NETWORK_PARAMS.chainIdHex }],
    });
  } catch (switchError: any) {
    if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: BRADBURY_NETWORK_PARAMS.chainIdHex,
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
