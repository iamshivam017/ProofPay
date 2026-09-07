import { Badge } from "./ui/badge";
import type { DecisionTicket as DecisionTicketData } from "@/src/lib/ticket/types";

export function DecisionTicket({ ticket }: { ticket: DecisionTicketData }) {
  return (
    <div className="border-y border-line">
      <TicketRow label="Request ID" value={ticket.requestId} />
      <TicketRow label="Timestamp" value={ticket.timestamp} />
      <TicketRow label="Status" value={ticket.status} />
      <TicketRow
        label="Miner"
        value={ticket.verification.minerIdentity ?? "Unavailable in Miner response"}
      />
      <TicketRow label="Intent" value={ticket.verification.intent} />
      <div className="flex items-center justify-between gap-5 border-t border-line py-4">
        <span className="section-label">Policy</span>
        <Badge className={verdictStyle[ticket.policy.verdict]}>{ticket.policy.verdict}</Badge>
      </div>
      <TicketRow label="Reason" value={ticket.policy.reason} mono={false} />
      <TicketRow
        label="Signal conflict"
        value={
          ticket.verification.conflict === null
            ? "Not enough comparable signals"
            : ticket.verification.conflict
              ? "Material conflict detected"
              : "No material conflict"
        }
      />
      <TicketRow label="Execution" value={ticket.execution.status} />
    </div>
  );
}

const verdictStyle = {
  ALLOW: "border-emerald-400/30 text-emerald-300",
  REVIEW: "border-amber-400/30 text-amber-300",
  BLOCK: "border-red-400/30 text-red-300",
};

function TicketRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid gap-2 border-t border-line py-4 first:border-t-0 sm:grid-cols-[140px_1fr]">
      <span className="section-label">{label}</span>
      <span className={`break-all text-sm text-[#c9d2cc] ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}
