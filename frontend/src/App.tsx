import React, { useState } from 'react';
import { useScopeBond, formatAtto } from './hooks/useScopeBond';
import { CONTRACT_ADDRESS } from './genlayer/config';

const GITHUB_REPO_URL = "https://github.com/reza9133/scopebond";

function TxBanner({ phase, message }: { phase: string; message: string }) {
  if (phase === 'idle') return null;
  const isSuccess = phase === 'success';
  const isError = phase === 'error';
  const colorClass = isSuccess 
    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400' 
    : isError 
    ? 'bg-red-950/40 border-red-500/40 text-red-400' 
    : 'bg-indigo-950/40 border-indigo-500/40 text-indigo-300 animate-pulse';
  
  return (
    <div className={`p-4 mb-6 rounded-xl border text-xs font-mono flex items-center space-x-3 ${colorClass}`}>
      <span>{!isSuccess && !isError ? '⏳' : isSuccess ? '✅' : '❌'}</span>
      <span>{message}</span>
    </div>
  );
}

export default function App() {
  const {
    account,
    connectWallet,
    state,
    stateLoading,
    stateError,
    txPhase,
    txMessage,
    fund,
    acceptEngagement,
    submitDelivery,
    approveDelivery,
    openDispute,
    rule
  } = useScopeBond();

  const [fundAmount, setFundAmount] = useState('1');
  const [deliveryUrl, setDeliveryUrl] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [feedbackUrl, setFeedbackUrl] = useState('');

  const busy = txPhase === 'awaiting_wallet' || txPhase === 'submitting' || txPhase === 'confirming';
  const contractStatus = stateLoading ? 'LOADING...' : stateError ? 'OFFLINE / ERROR' : (state?.status ?? 'AWAITING_FUNDING');
  const escrowAmount = state ? formatAtto(state.escrow_atto) : '0';
  const outcome = state?.outcome || 'Pending';
  const rulingReason = state?.ruling_reason || '';

  return (
    <div className="min-h-screen text-slate-100 flex flex-col bg-slate-950 font-sans">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md px-8 py-4 flex justify-between items-center max-w-7xl mx-auto w-full sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 animate-pulse"></div>
          <span className="text-xl font-black tracking-wider bg-gradient-to-r from-indigo-400 via-purple-300 to-cyan-400 bg-clip-text text-transparent">
            SCOPEBOND
          </span>
          <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/20 font-semibold uppercase tracking-widest">
            GenLayer Escrow
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <a 
            href={GITHUB_REPO_URL} 
            target="_blank" 
            rel="noreferrer"
            className="text-xs text-slate-400 hover:text-white transition font-medium hidden sm:inline-block"
          >
            GitHub Repo ↗
          </a>
          {account ? (
            <span className="bg-slate-900 text-cyan-400 text-xs px-4 py-2 rounded-xl border border-slate-700 font-mono shadow-inner">
              {account.substring(0, 6)}...{account.substring(38)}
            </span>
          ) : (
            <button 
              onClick={connectWallet}
              className="glow-button text-white text-xs font-bold px-5 py-2.5 rounded-xl transition cursor-pointer bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20"
            >
              Connect MetaMask
            </button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="text-center py-16 px-6 max-w-4xl mx-auto">
        <div className="inline-block mb-4 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-widest">
          Decentralized Trustless Escrow
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
          AI-Powered Smart Contracts That <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">Settle Disputes.</span>
        </h1>
        <p className="text-sm md:text-base text-slate-400 leading-relaxed max-w-2xl mx-auto">
          ScopeBond securely locks project funds, tracks milestones, and leverages GenLayer decentralized consensus validators to rule on deliverables autonomously.
        </p>
      </section>

      {/* Main Dashboard Grid */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Column: Contract Status */}
        <div className="space-y-6">
          <div className="glass-card p-6 bg-slate-900/60 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-md">
            <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-6 flex items-center">
              <span className="w-2 h-2 rounded-full bg-indigo-500 mr-2"></span> Contract State
            </h2>

            <TxBanner phase={txPhase} message={txMessage} />

            {stateError && (
              <div className="p-3 mb-4 rounded-lg bg-red-950/50 border border-red-500/30 text-red-400 text-xs">
                {stateError}
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div className="flex justify-between pb-3 border-b border-slate-800">
                <span className="text-slate-400">Current State:</span>
                <span className="font-mono text-cyan-400 font-bold">{contractStatus}</span>
              </div>
              <div className="flex justify-between pb-3 border-b border-slate-800">
                <span className="text-slate-400">Escrow Balance:</span>
                <span className="font-mono text-emerald-400 font-bold">{escrowAmount} GEN</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">AI Outcome:</span>
                <span className="font-mono text-amber-400 font-bold">{outcome}</span>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Contract Address</label>
              <input 
                type="text" 
                readOnly
                value={CONTRACT_ADDRESS}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 focus:outline-none"
              />
            </div>
          </div>

          {/* AI Verdict Box */}
          {rulingReason && (
            <div className="glass-card p-6 border border-indigo-500/30 bg-indigo-950/20 rounded-2xl shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-2">GenLayer Validator Verdict</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{rulingReason}</p>
            </div>
          )}
        </div>

        {/* Right Column: Actions Dashboard */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Client Dashboard */}
          <div className="glass-card p-6 bg-slate-900/60 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-md">
            <h2 className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-6 flex items-center">
              <span className="w-2 h-2 rounded-full bg-cyan-500 mr-2"></span> Client Controls
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">GEN Amount to Fund</label>
                <input 
                  type="text"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  placeholder="1"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex items-end">
                <button 
                  disabled={busy}
                  onClick={() => fund(fundAmount)}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-3 px-5 rounded-xl text-xs font-bold transition border border-indigo-500/30 cursor-pointer shadow-lg shadow-indigo-600/20"
                >
                  Fund Escrow
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
              <button 
                disabled={busy}
                onClick={approveDelivery}
                className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 py-3 px-5 rounded-xl text-xs font-bold transition border border-emerald-500/30 cursor-pointer"
              >
                Approve Delivery (Client)
              </button>
              <button 
                disabled={busy}
                onClick={() => openDispute(feedbackUrl)}
                className="bg-red-950/20 hover:bg-red-900/30 text-red-400 py-3 px-5 rounded-xl text-xs font-bold transition border border-red-900/40 cursor-pointer"
              >
                Open Dispute
              </button>
            </div>

            <div className="mt-4">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Feedback / Evidence URL</label>
              <input 
                type="text" 
                placeholder="https://raw.githubusercontent.com/.../feedback.json" 
                value={feedbackUrl}
                onChange={(e) => setFeedbackUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Freelancer Dashboard */}
          <div className="glass-card p-6 bg-slate-900/60 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-md">
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-6 flex items-center">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span> Freelancer Controls
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <button 
                  disabled={busy}
                  onClick={acceptEngagement}
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 py-3 px-5 rounded-xl text-xs font-bold transition border border-slate-700 cursor-pointer"
                >
                  Accept Engagement
                </button>
                <button 
                  disabled={busy}
                  onClick={() => submitDelivery(deliveryUrl, deliveryNotes)}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-3 px-5 rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  Submit Delivery
                </button>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Delivery Manifest URL</label>
                <input 
                  type="text" 
                  placeholder="https://raw.githubusercontent.com/.../manifest.json" 
                  value={deliveryUrl}
                  onChange={(e) => setDeliveryUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Delivery Notes</label>
                <textarea 
                  placeholder="Describe your completed work and milestones..." 
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 h-24 resize-none"
                />
              </div>
            </div>
          </div>

          {/* AI Court Action */}
          <div className="glass-card p-6 bg-gradient-to-r from-indigo-950/50 via-purple-950/30 to-slate-900/80 border border-indigo-500/30 rounded-2xl shadow-xl flex flex-col sm:flex-row justify-between items-center gap-6 backdrop-blur-md">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-300">GenLayer AI Adjudication Court</h3>
              <p className="text-xs text-slate-400 mt-1">Summon AI consensus validators to automatically evaluate briefs, work manifests, and settle funds.</p>
            </div>
            <button 
              disabled={busy}
              onClick={rule}
              className="w-full sm:w-auto glow-button bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold px-6 py-3.5 rounded-xl text-xs whitespace-nowrap shadow-xl cursor-pointer transition border border-indigo-500/30"
            >
              Invoke AI Court (Rule)
            </button>
          </div>

        </div>
      </main>

      {/* How It Works Section */}
      <section className="max-w-6xl w-full mx-auto px-6 py-20 mt-12 border-t border-slate-800/80">
        <div className="text-center mb-12">
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Protocol Architecture</span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white mt-2">How ScopeBond Works</h2>
          <p className="text-sm text-slate-400 mt-2 max-w-xl mx-auto">Three automated steps to guarantee complete security and zero trust friction for both clients and creators.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-8 bg-slate-900/40 border border-slate-800 rounded-2xl relative overflow-hidden group hover:border-indigo-500/50 transition">
            <div className="text-indigo-400 font-mono text-3xl font-black mb-4 opacity-40">01</div>
            <h3 className="text-base font-bold text-white mb-2">Fund & Initialize</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              The client deposits project funds into the immutable GenLayer smart contract escrow, locking capital safely until project completion.
            </p>
          </div>

          <div className="glass-card p-8 bg-slate-900/40 border border-slate-800 rounded-2xl relative overflow-hidden group hover:border-purple-500/50 transition">
            <div className="text-purple-400 font-mono text-3xl font-black mb-4 opacity-40">02</div>
            <h3 className="text-base font-bold text-white mb-2">Submit & Verify</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              The freelancer submits GitHub-backed deliverables and proof of work. Both parties review deliverables transparently on-chain.
            </p>
          </div>

          <div className="glass-card p-8 bg-slate-900/40 border border-slate-800 rounded-2xl relative overflow-hidden group hover:border-cyan-500/50 transition">
            <div className="text-cyan-400 font-mono text-3xl font-black mb-4 opacity-40">03</div>
            <h3 className="text-base font-bold text-white mb-2">Autonomous Settlement</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              In case of disputes, AI consensus validators analyze public artifacts and automatically route funds to the rightful party without human bias.
            </p>
          </div>
        </div>
      </section>

      {/* Professional Clean Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 mt-20 pt-16 pb-10 px-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10 pb-12 border-b border-slate-800/60">
          
          <div className="space-y-4">
            <span className="text-sm font-black tracking-wider text-white">SCOPEBOND</span>
            <p className="text-xs text-slate-400 leading-relaxed">
              Escrow that settles service disputes — held on-chain, ruled by GenLayer validators, released without a trusted middleman.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">Resources & Code</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li><a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer" className="hover:text-white transition">GitHub Repository ↗</a></li>
              <li><span className="text-slate-500">GenLayer Bradbury Testnet</span></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">Protocol Status</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Active testnet instance running consensus validation nodes for decentralized dispute resolution.
            </p>
          </div>

        </div>

        <div className="max-w-6xl mx-auto pt-8 flex flex-col sm:flex-row justify-between items-center text-[11px] text-slate-500 gap-4">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Production - live on GenLayer Bradbury testnet</span>
          </div>
          <div>
            Testnet prototype. No real financial assets or monetary value involved.
          </div>
        </div>
      </footer>
    </div>
  );
}
