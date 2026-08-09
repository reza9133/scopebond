import { createClient } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';

export const readClient = createClient({ chain: testnetBradbury });

export function createWriteClient(account: `0x${string}`) {
  return createClient({
    chain: testnetBradbury,
    account,
    provider: (window as any).ethereum,
  });
}

export async function ensureBradburyNetwork(client: ReturnType<typeof createWriteClient>) {
  await client.connect('testnetBradbury');
}
