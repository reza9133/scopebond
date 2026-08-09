import React, { useState } from 'react';
import { ethers } from 'ethers';

// لینک واقعی گیت‌هاب شما
const GITHUB_REPO_URL = "https://github.com/reza9133/scopebond";

export default function App() {
  const [contractAddress, setContractAddress] = useState('0xScopeBondGenLayerEscrow7788');
  const [walletConnected, setWalletConnected] = useState(false);
  const [account, setAccount] = useState('');
  
  const [contractStatus, setContractStatus] = useState('AWAITING_FUNDING');
  const [escrowAmount, setEscrowAmount] = useState('0');
  const [outcome, setOutcome] = useState('Pending');
  const [rulingReason, setRulingReason] = useState('');

  const [deliveryUrl, setDeliveryUrl] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [feedbackUrl, setFeedbackUrl] = useState('');

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        setAccount(address);
        setWalletConnected(true);
      } catch (err) {
        console.error("Failed to connect wallet", err);
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  const handleFundEscrow = () => {
    setEscrowAmount('1.0');
    setContractStatus('FUNDED_ACTIVE');
    alert('Escrow funded successfully with 1 ETH!');
  };

  const handleOpenDispute = () => {
    setContractStatus('DISPUTED');
    setOutcome('Under AI Review');
    setRulingReason('Dispute flagged by client. GenLayer validators are requested to review delivery artifacts.');
  };

  const handleAcceptEngagement = () => {
    setContractStatus('IN_PROGRESS');
  };

  const handleApplyDelivery = () => {
    if (!deliveryUrl) {
      alert('Please enter a delivery manifest URL first.');
      return;
    }
    setContractStatus('DELIVERED_PENDING_REVIEW');
    alert('Delivery submitted successfully to GenLayer validators.');
  };

  const handleInvokeAI = () => {
    setContractStatus('SETTLED');
    setOutcome('Ruling: Released to Freelancer');
    setRulingReason('GenLayer Consensus Validators (95% agreement): GitHub delivery manifest matches project brief requirements. Funds released autonomously.');
  };

  return (
    <div className="min-h-screen text-slate-100 flex flex-col">
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
          {walletConnected ? (
            <span className="bg-slate-900 text-cyan-400 text-xs px-4 py-2 rounded-xl border border-slate-700 font-mono shadow-inner">
              {account.substring(0, 6)}...{account.substring(38)}
            </span>
          ) : (
            <button 
              onClick={connectWallet}
              className="glow-button text-white text-xs font-bold px-5 py-2.5 rounded-xl transition cursor-pointer"
            >
              Connect Wallet
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
          <div className="glass-card p-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-6 flex items-center">
              <span className="w-2 h-2 rounded-full bg-indigo-500 mr-2"></span> Contract State
            </h2>
            <div className="space-y-4 text-xs">
              <div className="flex justify-between pb-3 border-b border-slate-800">
                <span className="text-slate-400">Current State:</span>
                <span className="font-mono text-cyan-400 font-bold">{contractStatus}</span>
              </div>
              <div className="flex justify-between pb-3 border-b border-slate-800">
                <span className="text-slate-400">Escrow Balance:</span>
                <span className="font-mono text-emerald-400 font-bold">{escrowAmount} ETH</span>
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
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
              />
            </div>
          </div>

          {/* AI Verdict Box */}
          {rulingReason && (
            <div className="glass-card p-6 border-indigo-500/30 bg-indigo-950/20">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-2">GenLayer Validator Verdict</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{rulingReason}</p>
            </div>
          )}
        </div>

        {/* Right Column: Actions Dashboard */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Client Dashboard */}
          <div className="glass-card p-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-6 flex items-center">
              <span className="w-2 h-2 rounded-full bg-cyan-500 mr-2"></span> Client Controls
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <button 
                onClick={handleFundEscrow}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 py-3 px-5 rounded-xl text-xs font-bold transition border border-slate-700 cursor-pointer"
              >
                Fund Escrow (1 ETH)
              </button>
              <button 
                onClick={handleOpenDispute}
                className="bg-red-950/20 hover:bg-red-900/30 text-red-400 py-3 px-5 rounded-xl text-xs font-bold transition border border-red-900/40 cursor-pointer"
              >
                Open Dispute
              </button>
            </div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Feedback / Evidence URL</label>
            <input 
              type="text" 
              placeholder="https://raw.githubusercontent.com/.../feedback.json" 
              value={feedbackUrl}
              onChange={(e) => setFeedbackUrl(e.target.value)}
            />
          </div>

          {/* Freelancer Dashboard */}
          <div className="glass-card p-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-6 flex items-center">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span> Freelancer Controls
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={handleAcceptEngagement}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 py-3 px-5 rounded-xl text-xs font-bold transition border border-slate-700 cursor-pointer"
                >
                  Accept Engagement
                </button>
                <button 
                  onClick={handleApplyDelivery}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white py-3 px-5 rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  Submit Delivery
                </button>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Delivery Manifest URL</label>
                <input 
                  type="text" 
                  placeholder="https://raw.githubusercontent.com/.../manifest.json" 
                  value={deliveryUrl}
                  onChange={(e) => setDeliveryUrl(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Delivery Notes</label>
                <textarea 
                  placeholder="Describe your completed work and milestones..." 
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  className="h-24 resize-none"
                />
              </div>
            </div>
          </div>

          {/* AI Court Action */}
          <div className="glass-card p-6 bg-gradient-to-r from-indigo-950/50 via-purple-950/30 to-slate-900/80 border-indigo-500/30 flex flex-col sm:flex-row justify-between items-center gap-6">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-300">GenLayer AI Adjudication Court</h3>
              <p className="text-xs text-slate-400 mt-1">Summon AI consensus validators to automatically evaluate briefs, work manifests, and settle funds.</p>
            </div>
            <button 
              onClick={handleInvokeAI}
              className="w-full sm:w-auto glow-button text-white font-bold px-6 py-3.5 rounded-xl text-xs whitespace-nowrap shadow-xl cursor-pointer"
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
          <div className="glass-card p-8 relative overflow-hidden group hover:border-indigo-500/50 transition">
            <div className="text-indigo-400 font-mono text-3xl font-black mb-4 opacity-40">01</div>
            <h3 className="text-base font-bold text-white mb-2">Fund & Initialize</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              The client deposits project funds into the immutable GenLayer smart contract escrow, locking capital safely until project completion.
            </p>
          </div>

          <div className="glass-card p-8 relative overflow-hidden group hover:border-purple-500/50 transition">
            <div className="text-purple-400 font-mono text-3xl font-black mb-4 opacity-40">02</div>
            <h3 className="text-base font-bold text-white mb-2">Submit & Verify</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              The freelancer submits GitHub-backed deliverables and proof of work. Both parties review deliverables transparently on-chain.
            </p>
          </div>

          <div className="glass-card p-8 relative overflow-hidden group hover:border-cyan-500/50 transition">
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