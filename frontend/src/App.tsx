import { useState } from 'react';
import { useScopeBond, formatAtto } from './hooks/useScopeBond';
import { CONTRACT_ADDRESS } from './genlayer/config';

function TxBanner({ phase, message }: { phase: string; message: string }) {
  if (phase === 'idle') return null;
  const color =
    phase === 'success' ? '#1a7f37' : phase === 'error' ? '#cf222e' : '#9a6700';
  return (
    <div style={{ padding: 12, marginBottom: 16, borderRadius: 8, background: '#f6f8fa', color, border: `1px solid ${color}` }}>
      {phase !== 'success' && phase !== 'error' && '⏳ '}
      {phase === 'success' && '✅ '}
      {phase === 'error' && '❌ '}
      {message}
    </div>
  );
}

export default function App() {
  const {
    account, connectWallet,
    state, stateLoading, stateError,
    txPhase, txMessage,
    fund, submitDelivery, rule, acceptEngagement, approveDelivery, openDispute
  } = useScopeBond();

  const [fundAmount, setFundAmount] = useState('1');
  const [deliveryUrl, setDeliveryUrl] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [feedbackUrl, setFeedbackUrl] = useState('');

  const busy = txPhase === 'awaiting_wallet' || txPhase === 'submitting' || txPhase === 'confirming';

  return (
    <div style={{ maxWidth: 640, margin: '40px auto', fontFamily: 'sans-serif', padding: '0 20px' }}>
      <h1>ScopeBond — GenLayer Bradbury Testnet</h1>
      <p style={{ fontSize: 13, color: '#666' }}>Contract: {CONTRACT_ADDRESS}</p>

      {!account ? (
        <button onClick={connectWallet} style={{ padding: '8px 16px', cursor: 'pointer' }}>Connect MetaMask</button>
      ) : (
        <p><b>Connected Account:</b> {account}</p>
      )}

      <TxBanner phase={txPhase} message={txMessage} />

      {stateLoading && <p>Reading live contract state from network...</p>}
      {stateError && <p style={{ color: '#cf222e' }}>{stateError}</p>}

      {state && (
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 24, background: '#fafafa' }}>
          <p><b>Contract Status:</b> {state.status}</p>
          <p><b>Escrow Balance:</b> {formatAtto(state.escrow_atto)} GEN</p>
          <p><b>Client:</b> {state.client}</p>
          <p><b>Freelancer:</b> {state.freelancer}</p>
          {state.delivery_url && <p><b>Delivery URL:</b> {state.delivery_url}</p>}
          {state.outcome && <p><b>Ruling Outcome:</b> {state.outcome}</p>}
        </div>
      )}

      {state?.status === 'AWAITING_FUNDING' && (
        <section style={{ marginBottom: 20 }}>
          <h3>Fund Escrow</h3>
          <input value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} placeholder="GEN Amount" style={{ marginRight: 8, padding: 6 }} />
          <button disabled={busy} onClick={() => fund(fundAmount)} style={{ padding: '6px 12px' }}>Fund Escrow</button>
        </section>
      )}

      {state?.status === 'AWAITING_FREELANCER_ACCEPTANCE' && (
        <section style={{ marginBottom: 20 }}>
          <button disabled={busy} onClick={acceptEngagement} style={{ padding: '6px 12px' }}>Accept Engagement (Freelancer)</button>
        </section>
      )}

      {state?.status === 'ACTIVE' && (
        <section style={{ marginBottom: 20 }}>
          <h3>Submit Delivery</h3>
          <input value={deliveryUrl} onChange={(e) => setDeliveryUrl(e.target.value)} placeholder="Delivery URL" style={{ display: 'block', marginBottom: 8, width: '100%', padding: 6 }} />
          <textarea value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} placeholder="Notes" style={{ display: 'block', marginBottom: 8, width: '100%', padding: 6 }} />
          <button disabled={busy} onClick={() => submitDelivery(deliveryUrl, deliveryNotes)} style={{ padding: '6px 12px' }}>Submit Delivery</button>
        </section>
      )}

      {state?.status === 'DELIVERED' && (
        <section style={{ marginBottom: 20 }}>
          <button disabled={busy} onClick={approveDelivery} style={{ padding: '6px 12px', marginRight: 8 }}>Approve Delivery (Client)</button>
          <input value={feedbackUrl} onChange={(e) => setFeedbackUrl(e.target.value)} placeholder="Feedback URL" style={{ padding: 6, marginRight: 8 }} />
          <button disabled={busy} onClick={() => openDispute(feedbackUrl)} style={{ padding: '6px 12px', background: '#cf222e', color: '#fff', border: 'none' }}>Open Dispute</button>
        </section>
      )}

      {state?.status === 'DISPUTED' && (
        <section style={{ marginBottom: 20 }}>
          <button disabled={busy} onClick={rule} style={{ padding: '6px 12px' }}>Invoke AI Adjudication (Rule)</button>
        </section>
      )}
    </div>
  );
}
