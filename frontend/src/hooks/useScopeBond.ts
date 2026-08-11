// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import { TransactionStatus } from 'genlayer-js/types';
import { readClient, createWriteClient, ensureBradburyNetwork } from '../genlayer/client';
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

export function useScopeBond(activeContractAddress: string) {
  const [account, setAccount] = useState<string | null>(null);
  const [state, setState] = useState<ScopeBondState | null>(null);
  const [stateLoading, setStateLoading] = useState(false);
  const [stateError, setStateError] = useState<string | null>(null);

  const [txPhase, setTxPhase] = useState<TxPhase>('idle');
  const [txMessage, setTxMessage] = useState('');

  const disconnect = useCallback(() => {
    setAccount(null);
  }, []);

  // Auto-Connect Feature
  useEffect(() => {
    const checkConnection = async () => {
      const eth = (window as any).ethereum;
      if (eth) {
        try {
          const accounts = await eth.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            setAccount(accounts[0]);
          }
        } catch (err) {
          console.error("Auto-connect silently failed:", err);
        }
      }
    };
    checkConnection();
  }, []);

  const refetch = useCallback(async () => {
    // If address is empty or invalid, skip request
    if (!activeContractAddress || activeContractAddress.length !== 42 || !activeContractAddress.startsWith('0x')) {
      setState(null);
      setStateError("Please enter a valid GenLayer contract address (0x...) above to load the dashboard.");
      return;
    }

    setStateLoading(true);
    setStateError(null);
    try {
      const result = await readClient.readContract({
        address: activeContractAddress,
        functionName: 'get_state',
        args: [],
      });
      setState(result as ScopeBondState);
    } catch (err: any) {
      setStateError(
        `Failed to fetch contract state. Are you sure this is a valid ScopeBond contract? Error: ${err?.message ?? err}`
      );
      setState(null);
    } finally {
      setStateLoading(false);
    }
  }, [activeContractAddress]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const connectWallet = useCallback(async () => {
    const eth = (window as any).ethereum;
    if (!eth) throw new Error('MetaMask not found.');
    const [address] = await eth.request({ method: 'eth_requestAccounts' });
    setAccount(address);
    return address as string;
  }, []);

  const runWrite = useCallback(
    async (functionName: string, args: unknown[], value: bigint = 0n) => {
      if (!activeContractAddress) {
         setTxPhase('error');
         setTxMessage('No contract address specified.');
         return;
      }

      setTxPhase('awaiting_wallet');
      setTxMessage('Connecting to wallet...');
      try {
        const address = account ?? (await connectWallet());

        setTxMessage('Checking MetaMask network...');
        await ensureBradburyNetwork();

        const writeClient = createWriteClient(address);

        setTxPhase('submitting');
        setTxMessage('Waiting for transaction approval in MetaMask...');
        const txHash = await writeClient.writeContract({
          address: activeContractAddress,
          functionName,
          args,
          value,
        });

        setTxPhase('confirming');
        setTxMessage('Transaction submitted; waiting for validator consensus...');

        // Persistent Polling Loop
        let receipt = null;
        while (!receipt) {
          try {
            receipt = await readClient.waitForTransactionReceipt({
              hash: txHash,
              status: TransactionStatus.ACCEPTED,
            });
          } catch (waitErr: any) {
            const errMsg = waitErr?.message ?? String(waitErr);
            if (errMsg.includes('Timed out waiting for transaction')) {
              setTxMessage('Network is heavily loaded. Still actively waiting for confirmation...');
              await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
              throw waitErr;
            }
          }
        }

        setTxPhase('success');
        setTxMessage('Transaction confirmed! Auto-refreshing state...');
        await refetch(); 
        
        setTimeout(() => {
          setTxPhase('idle');
        }, 4000);

      } catch (err: any) {
        const errorMessage = err?.message ?? String(err);
        if (err?.code === 4001 || /user rejected/i.test(errorMessage)) {
          setTxPhase('error');
          setTxMessage('Transaction rejected by user in MetaMask.');
        } else {
          setTxPhase('error');
          setTxMessage(`Transaction error: ${errorMessage}`);
        }
      }
    },
    [account, connectWallet, refetch, activeContractAddress]
  );

  return {
    account,
    connectWallet,
    disconnect,
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
