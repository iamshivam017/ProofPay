import type { PolicyDecision } from "../policy/types";
import type { PaymentGateResult } from "../web3/gate";

export interface PublicError {
  code: string;
  message: string;
}

export interface DecisionTicket {
  requestId: string;
  timestamp: string;
  status: "SUCCESS" | "HELD" | "ERROR";
  decision: PolicyDecision["verdict"];
  reason: string;
  signals: PolicyDecision["signals"];
  errors: PublicError[];
  request: {
    recipient: string;
    amountEth: string;
    reason: string;
    evidenceSummary: string;
  };
  verification: {
    minerIdentity: string | null;
    intent: string;
    latencyMs: number;
    signals: PolicyDecision["signals"];
    conflict: boolean | null;
  };
  policy: PolicyDecision;
  x402: {
    network: string;
    asset: string;
    amountAtomic: string;
    transactionHash: string;
  };
  execution: PaymentGateResult;
  telegraph: {
    miner: string | null;
    intent: string;
    latencyMs: number;
    x402: {
      status: "SETTLED";
      network: string;
      asset: string;
      amountAtomic: string;
      transactionHash: string;
    };
  };
  payment: {
    executed: boolean;
    txHash: string | null;
    explorerUrl: string | null;
  };
}

export interface VerifyFailureResponse {
  requestId: string;
  timestamp: string;
  status: "HELD" | "ERROR";
  decision: "REVIEW" | "BLOCK";
  reason: string;
  signals: [];
  telegraph: {
    miner: null;
    intent: string | null;
    latencyMs: number;
    x402: null;
  };
  payment: { executed: false; txHash: null; explorerUrl: null };
  errors: PublicError[];
  error: PublicError;
}
