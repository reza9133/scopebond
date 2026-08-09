export interface ScopeBondState {
  client: string;
  freelancer: string;
  status:
    | 'AWAITING_FUNDING'
    | 'AWAITING_FREELANCER_ACCEPTANCE'
    | 'ACTIVE'
    | 'DELIVERED'
    | 'DISPUTED'
    | 'RULED'
    | 'RESOLVED';
  resolution_mode: string;
  escrow_atto: string;
  delivery_url: string;
  delivery_notes: string;
  delivered_at: string;
  client_feedback_url: string;
  dispute_opened_at: string;
  outcome: string;
  refund_bps: string;
  unmet_criteria_ids: string[];
  ruling_reason: string;
  insufficient_evidence_ruled_at: string;
  settlement_pending: boolean;
  settlement_proposer: string;
  settlement_refund_bps: string;
}

export type TxPhase = 'idle' | 'awaiting_wallet' | 'submitting' | 'confirming' | 'success' | 'error';
