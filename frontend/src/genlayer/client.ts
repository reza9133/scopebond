// @ts-nocheck
import { createClient } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';
import { BRADBURY_NETWORK_PARAMS } from './config';

export const readClient = createClient({ 
  chain: testnetBradbury 
});

export function createWriteClient(account: string) {
  const eth = (window as any).ethereum;
  return createClient({
    chain: testnetBradbury,
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
    if (switchError.code === 4902 || String(switchError?.message).includes('4902') || String(switchError?.message).includes('not added')) {
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
