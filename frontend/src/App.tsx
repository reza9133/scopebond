import { useState } from 'react';
import { useScopeBond, formatAtto } from './hooks/useScopeBond';
import { CONTRACT_ADDRESS as DEFAULT_CONTRACT } from './genlayer/config';

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

// Validator for Immutable URLs
function isImmutableUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('ipfs://') || url.startsWith('ar://')) return true;
  const githubCommitRegex = /^https:\/\/raw\.githubusercontent\.com\/[^\/]+\/[^\/]+\/[a-f0-9]{40}\//i;
  return githubCommitRegex.test(url);
}

export default function App() {
  // State for Dynamic Contract Loading
  const [activeAddress, setActiveAddress] = useState(DEFAULT_CONTRACT || '');
  const [inputAddress, setInputAddress] = useState(DEFAULT_CONTRACT || '');

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
    rule,
    release
  } = useScopeBond(activeAddress);

  const [fundAmount, setFundAmount] = useState('1');
  const [deliveryUrl, setDeliveryUrl] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [feedbackUrl, setFeedbackUrl] = useState('');

  const busy = txPhase === 'awaiting_wallet' || txPhase === 'submitting' || txPhase === 'confirming';
  const contractStatus = stateLoading ? 'LOADING...' : stateError ? 'OFFLINE / ERROR' : (state?.status ?? 'AWAITING_FUNDING');
  const escrowAmount = state ? formatAtto(state.escrow_atto) : '0';
  const outcome = state?.outcome || 'Pending';
  const rulingReason = state?.ruling_reason || '';

  const handleLoadContract = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputAddress.trim().length === 42 && inputAddress.trim().startsWith('0x')) {
      setActiveAddress(inputAddress.trim());
    } else {
      alert("Please enter a valid 42-character GenLayer contract address starting with '0x'.");
    }
  };

  const handleSecureSubmitDelivery = () => {
    if (!isImmutableUrl(deliveryUrl)) {
      alert("Security Requirement: Delivery URL must be immutable to prevent tampering.\n\nPlease use an 'ipfs://' link, or a GitHub raw URL containing a strict 40-character commit hash.");
      return;
    }
    submitDelivery(deliveryUrl, deliveryNotes);
  };

  const handleSecureOpenDispute = () => {
    if (feedbackUrl && !isImmutableUrl(feedbackUrl)) {
      alert("Security Requirement: Feedback Evidence URL must be immutable to prevent tampering.\n\nPlease use an 'ipfs://' link, or a GitHub raw URL containing a strict 40-character commit hash.");
      return;
    }
    openDispute(feedbackUrl);
  };

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
      <section className="text-center py-12 px-6 max-w-4xl mx-auto">
        <div className="inline-block mb-4 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-widest">
          Decentralized Trustless Escrow
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
          AI-Powered Smart Contracts That <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">Settle Disputes.</span>
        </h1>
      </section>

      {/* Dynamic Contract Loader Bar */}
      <div className="max-w-6xl mx-auto px-6 mb-8 w-full">
        <form onSubmit={handleLoadContract} className="glass-card p-2 pl-6 bg-slate-900/80 border border-slate-700/50 rounded-2xl shadow-xl flex flex-col sm:flex-row gap-4 items-center backdrop-blur-md">
          <label className="text-xs font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Target Contract:</label>
          <input 
            type="text" 
            placeholder="Enter ScopeBond Contract Address (0x...)" 
            value={inputAddress}
            onChange={(e) => setInputAddress(e.target.value)}
            className="w-full bg-transparent border-none text-sm font-mono text-cyan-400 focus:outline-none placeholder-slate-600"
          />
          <button 
            type="submit"
            className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white font-bold px-6 py-3 rounded-xl text-xs whitespace-nowrap transition cursor-pointer border border-slate-600"
          >
            Load Dashboard
          </button>
        </form>
      </div>

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
              <div className="p-3 mb-4 rounded-lg bg-red-950/50 border border-red-500/30 text-red-400 text-xs leading-relaxed">
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
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Active Address</label>
              <div className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[10px] font-mono text-slate-500 truncate">
                {activeAddress || "No contract loaded"}
              </div>
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
        <div className="md:col-span-2 space-y-6 opacity-100 transition-opacity duration-300" style={{ opacity: activeAddress && !stateError ? 1 : 0.4, pointerEvents: activeAddress && !stateError ? 'auto' : 'none' }}>
          
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
                onClick={handleSecureOpenDispute}
                className="bg-red-950/20 hover:bg-red-900/30 text-red-400 py-3 px-5 rounded-xl text-xs font-bold transition border border-red-900/40 cursor-pointer"
              >
                Open Dispute
              </button>
            </div>

            <div className="mt-4">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Feedback / Evidence URL</label>
              <input 
                type="text" 
                placeholder="ipfs://Qm... or https://raw.githubusercontent.com/.../HASH/..." 
                value={feedbackUrl}
                onChange={(e) => setFeedbackUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">Must be an immutable IPFS or fixed-commit GitHub link.</p>
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
                  onClick={handleSecureSubmitDelivery}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-3 px-5 rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  Submit Delivery
                </button>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Delivery Manifest URL</label>
                <input 
                  type="text" 
                  placeholder="ipfs://Qm... or https://raw.githubusercontent.com/.../HASH/..." 
                  value={deliveryUrl}
                  onChange={(e) => setDeliveryUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">Must be an immutable IPFS or fixed-commit GitHub link.</p>
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

          {/* Release Funds Action */}
          {(contractStatus === 'RULED' || contractStatus === 'RESOLVED') && (
            <div className="glass-card p-6 mt-4 bg-gradient-to-r from-emerald-950/50 via-teal-950/30 to-slate-900/80 border border-emerald-500/30 rounded-2xl shadow-xl flex flex-col sm:flex-row justify-between items-center gap-6 backdrop-blur-md">
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-emerald-400">Release Funds</h3>
                <p className="text-xs text-slate-400 mt-1">Execute the final on-chain settlement based on the AI validator's ruling.</p>
              </div>
              <button 
                disabled={busy}
                onClick={release}
                className="w-full sm:w-auto glow-button bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-6 py-3.5 rounded-xl text-xs whitespace-nowrap shadow-xl cursor-pointer transition border border-emerald-500/30"
              >
                Execute Release
              </button>
            </div>
          )}

        </div>
      </main>

      {/* How It Works Section & Footer (unchanged from your original) */}
      <section className="max-w-6xl w-full mx-auto px-6 py-20 mt-12 border-t border-slate-800/80">
        <div className="text-center mb-12">
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Protocol Architecture</span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white mt-2">How ScopeBond Works</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-8 bg-slate-900/40 border border-slate-800 rounded-2xl relative overflow-hidden group hover:border-indigo-500/50 transition">
            <div className="text-indigo-400 font-mono text-3xl font-black mb-4 opacity-40">01</div>
            <h3 className="text-base font-bold text-white mb-2">Fund & Initialize</h3>
            <p className="text-xs text-slate-400 leading-relaxed">The client deposits project funds into the immutable GenLayer smart contract escrow.</p>
          </div>
          <div className="glass-card p-8 bg-slate-900/40 border border-slate-800 rounded-2xl relative overflow-hidden group hover:border-purple-500/50 transition">
            <div className="text-purple-400 font-mono text-3xl font-black mb-4 opacity-40">02</div>
            <h3 className="text-base font-bold text-white mb-2">Submit & Verify</h3>
            <p className="text-xs text-slate-400 leading-relaxed">The freelancer submits immutable deliverables for transparent on-chain review.</p>
          </div>
          <div className="glass-card p-8 bg-slate-900/40 border border-slate-800 rounded-2xl relative overflow-hidden group hover:border-cyan-500/50 transition">
            <div className="text-cyan-400 font-mono text-3xl font-black mb-4 opacity-40">03</div>
            <h3 className="text-base font-bold text-white mb-2">Autonomous Settlement</h3>
            <p className="text-xs text-slate-400 leading-relaxed">AI consensus validators analyze public artifacts and route funds to the rightful party.</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800/80 bg-slate-950 mt-10 pt-10 pb-10 px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center text-[11px] text-slate-500 gap-4">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Production - live on GenLayer Bradbury testnet</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
