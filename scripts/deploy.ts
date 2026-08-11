import { createClient } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';
import { readFileSync } from 'fs';
import { privateKeyToAccount } from 'viem/accounts';
import path from 'path';

// Usage: PRIVATE_KEY=0x... npm run deploy
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
  throw new Error("PRIVATE_KEY environment variable is missing.");
}

const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);

const client = createClient({
  chain: testnetBradbury,
  account: account,
});

async function deployScopeBond() {
  console.log("Initializing ScopeBond deployment...");
  console.log(`Deployer Address: ${account.address}`);

  const contractPath = path.resolve(__dirname, '../../contracts/scope_bond.py');
  const contractSource = readFileSync(contractPath, 'utf-8');

  const clientAddress = account.address;
  const freelancerAddress = "0x0000000000000000000000000000000000000000"; 
  const briefUrl = "ipfs://QmYourImmutableBriefHashHere";
  
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const autoReleaseDeadline = currentTimestamp + (30 * 24 * 60 * 60);
  const deadlockDeadline = currentTimestamp + (60 * 24 * 60 * 60);

  console.log("Submitting deployment transaction to GenLayer Bradbury...");

  try {
    const txHash = await client.deployContract({
      source: contractSource,
      args: [
        clientAddress,
        freelancerAddress,
        briefUrl,
        autoReleaseDeadline,
        deadlockDeadline
      ],
    });

    console.log(`Transaction hash: ${txHash}`);
    console.log("Waiting for network confirmation and AI validator consensus...");

    const receipt = await client.waitForTransactionReceipt({ hash: txHash });
    
    console.log("========================================");
    console.log(`Success! New ScopeBond Engagement Created.`);
    console.log(`Contract Address: ${receipt.contractAddress}`);
    console.log("========================================");
    
  } catch (error) {
    console.error("Deployment failed during execution:", error);
    process.exit(1);
  }
}

deployScopeBond();
