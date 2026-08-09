import { useCallback, useEffect, useState } from 'react';
import { TransactionStatus, ExecutionResult } from 'genlayer-js/types';
import { readClient, createWriteClient, ensureBradburyNetwork } from '../genlayer/client';
import { CONTRACT_ADDRESS } from '../genlayer/config';
import type { ScopeBondState, TxPhase } from '../genlayer/types';

function parseGenToAtto(amount: string): bigint {
  const [whole, frac = ''] = amount.trim().split('.');
  const fracPadded = (frac + '0'.repeat(18)).slice(0, 18);
  return BigInt(whole || '0') * 10n ** 18n + BigInt(fracPadded || '0');
}

export function formatAtto(atto: string | bigint): string {
  const v = typeof atto === 'bigint' ? atto : BigInt(atto || '0');
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : `${whole}`;
}

export function useScopeBond() {
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [state, setState] = useState<ScopeBondState | null>(null);
  const [stateLoading, setStateLoading] = useState(true);
  const [stateError, setStateError] = useState<string | null>(null);

  const [txPhase, setTxPhase] = useState<TxPhase>('idle');
  const [txMessage, setTxMessage] = useState('');

  const refetch = useCallback(async () => {
    setStateLoading(true);
    setStateError(null);
    try {
      const result = await readClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName: 'get_state',
        args: [],
      });
      setState(result as ScopeBondState);
    } catch (err: any) {
      setStateError(
        `Failed to fetch contract state from network: ${err?.message ?? err}. ` +
          `Please check the address on explorer-bradbury.genlayer.com`
      );
    } finally {
      setStateLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const connectWallet = useCallback(async () => {
    const eth = (window as any).ethereum;
    if (!eth) throw new Error('MetaMask not found.');
    const [address] = await eth.request({ method: 'eth_requestAccounts' });
    setAccount(address);
    return address as `0x${string}`;
  }, []);

  const runWrite = useCallback(
    async (functionName: string, args: unknown[], value: bigint = 0n) => {
      setTxPhase('awaiting_wallet');
      setTxMessage('Connecting to wallet...');
      try {
        const address = account ?? (await connectWallet());

        setTxMessage('Checking MetaMask network (GenLayer Bradbury Testnet)...');
        await ensureBradburyNetwork();

        const writeClient = createWriteClient(address);

        setTxPhase('submitting');
        setTxMessage('Waiting for transaction approval in MetaMask...');
        const txHash = await writeClient.writeContract({
          address: CONTRACT_ADDRESS,
          functionName,
          args,
          value,
        });

        setTxPhase('confirming');
        setTxMessage(
          'Transaction submitted; waiting for GenLayer validator consensus ' +
            '(finalization may take a while)...'
        );

        const receipt = await readClient.waitForTransactionReceipt({
          hash: txHash,
          status: TransactionStatus.ACCEPTED,
        });

        if (receipt.txExecutionResultName !== ExecutionResult.FINISHED_WITH_RETURN) {
          throw new Error('Transaction execution was rejected on-chain.');
        }

        setTxPhase('success');
        setTxMessage('Transaction accepted successfully.');
        await refetch();
      } catch (err: any) {
        setTxPhase('error');
        if (err?.code === 4001 || /user rejected/i.test(err?.message ?? '')) {
          setTxMessage('Transaction rejected by user in MetaMask.');
        } else {
          setTxMessage(`Transaction error: ${err?.message ?? String(err)}`);
        }
      }
    },
    [account, connectWallet, refetch]
  );

  return {
    account,
    connectWallet,
    state,
    stateLoading,
    stateError,
    refetch,
    txPhase,
    txMessage,
    fund: (amountInGen: string) => runWrite('fund', [], parseGenToAtto(amountInGen)),
    acceptEngagement: () => runWrite('accept_engagement', []),
    submitDelivery: (url: string, notes: string) => runWrite('submit_delivery', [url, notes]),
    approveDelivery: () => runWrite('approve_delivery', []),
    openDispute: (feedbackUrl: string) => runWrite('open_dispute', [feedbackUrl]),
    rule: () => runWrite('rule', []),
    release: () => runWrite('release', []),
  };
}
