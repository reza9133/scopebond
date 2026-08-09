// @ts-nocheck
import { createClient } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';
import { BRADBURY_NETWORK_PARAMS } from './config';

// Read client — talks directly to the GenLayer Bradbury RPC, no wallet
// needed. Using genlayer-js's own `testnetBradbury` (instead of a
// hand-rolled chain object built from BRADBURY_NETWORK_PARAMS) guarantees
// the correct GenLayer-aware RPC URL and chain id, and picks up GenLayer's
// Bradbury-specific fixes automatically whenever you bump the SDK version.
export const readClient = createClient({
  chain: testnetBradbury,
});

// Write client — signs transactions through MetaMask.
//
// THE FIX: `provider: eth`, not `transport: custom(eth)`. genlayer-js has
// its own `provider` option for browser-wallet accounts — it's what tells
// the SDK "route signing/sending through this injected provider"
// (eth_sendTransaction) instead of expecting `account` to sign itself.
// A raw viem `transport` doesn't carry that signal, so genlayer-js falls
// back to expecting a locally-signable account — and a bare address string
// can't sign itself, hence "Account does not support signTransaction".
export function createWriteClient(account: string) {
  const eth = (window as any).ethereum;
  if (!eth) throw new Error('MetaMask not found.');
  return createClient({
    chain: testnetBradbury,
    account: account as `0x${string}`,
    provider: eth,
  });
}

export async function ensureBradburyNetwork() {
  const eth = (window as any).ethereum;
  if (!eth) throw new Error('MetaMask not found.');
  const chainIdHex = '0x107d'; // 4221 decimal — already correct for Bradbury
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
            // Double-check this points at https://rpc-bradbury.genlayer.com
            // (the GenLayer-aware RPC) and not the plain L2 chain RPC
            // (rpc.testnet-chain.genlayer.com) — the latter doesn't
            // understand GenLayer intelligent-contract calls.
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
