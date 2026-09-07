import type { PolicyDecision } from "../policy/types";
import type { PaymentGateResult } from "../web3/gate";

export interface DecisionTicket {
  requestId: string;
  timestamp: string;
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
  };
  policy: PolicyDecision;
  x402: {
    network: string;
    asset: string;
    amountAtomic: string;
    transactionHash: string;
  };
  execution: PaymentGateResult;
}

export interface VerifyFailureResponse {
  requestId: string;
  timestamp: string;
  error: {
    code: string;
    message: string;
  };
}
