"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";

import type { DecisionTicket, VerifyFailureResponse } from "@/src/lib/ticket/types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

interface DecisionPanelProps {
  ticket?: DecisionTicket;
  failure?: VerifyFailureResponse;
  onReset: () => void;
  onViewProof?: () => void;
}

export function DecisionPanel({
  ticket,
  failure,
  onReset,
  onViewProof,
}: DecisionPanelProps) {
  const state = getDisplayState(ticket, failure);
  const style = stateStyles[state];
  const reason = failure?.error.message ?? executionReason(ticket) ?? ticket?.policy.reason;
  const amountMoved = ticket?.execution.status === "EXECUTED";

  return (
    <main className="mx-auto min-h-[calc(100vh-88px)] w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="mb-6 flex items-center justify-between">
        <Badge className={style.badge}>Decision / {state}</Badge>
        <span className="font-mono text-[10px] uppercase tracking-[.16em] text-muted">
          {ticket?.requestId ?? failure?.requestId}
        </span>
      </div>

      <Card className={`overflow-hidden rounded-xl border ${style.border}`}>
        <section className={`relative border-b border-line px-6 py-12 text-center sm:px-10 sm:py-16 ${style.glow}`}>
          <div className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border ${style.iconWrap}`}>
            {state === "ALLOW" ? (
              <CheckCircle2 className="h-7 w-7" />
            ) : state === "REVIEW" ? (
              <AlertTriangle className="h-7 w-7" />
            ) : (
              <ShieldAlert className="h-7 w-7" />
            )}
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[.28em] text-muted">
            Deterministic policy outcome
          </p>
          <h1 className={`mt-3 text-6xl font-black tracking-[-0.07em] sm:text-8xl ${style.title}`}>
            {state}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-[#aeb8b1]">
            {reason ?? "Verification unavailable — action held for safety."}
          </p>
          {!amountMoved && (
            <div className="mt-7 font-mono text-sm font-bold uppercase tracking-[.18em] text-red-400">
              $0 moved
            </div>
          )}
        </section>

        {ticket && (
          <div className="grid lg:grid-cols-[.9fr_1.1fr]">
            <section className="border-b border-line p-6 sm:p-8 lg:border-b-0 lg:border-r">
              <p className="section-label">Evidence summary</p>
              <p className="mt-4 text-sm leading-7 text-[#c8d0cb]">
                {ticket.request.evidenceSummary}
              </p>
              <dl className="mt-7 space-y-4 border-t border-line pt-6">
                <Detail label="Requested" value={`${ticket.request.amountEth} ETH`} />
                <Detail label="Recipient" value={ticket.request.recipient} mono />
                <Detail label="Intent" value={ticket.verification.intent} mono />
                <Detail label="Latency" value={`${ticket.verification.latencyMs} ms`} mono />
              </dl>
            </section>

            <section className="p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <p className="section-label">Miner signals</p>
                <span className="font-mono text-xs text-muted">
                  policy confidence {(ticket.policy.confidence * 100).toFixed(1)}%
                </span>
              </div>
              <div className="mt-5 divide-y divide-line border-y border-line">
                {ticket.policy.signals.map((signal) => (
                  <div key={signal.id} className="grid grid-cols-[1fr_auto] gap-4 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{signal.kind}</p>
                      <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[.12em] text-muted">
                        {signal.minerId === "unavailable" ? "Miner unavailable" : signal.minerId} · {signal.status}
                      </p>
                    </div>
                    <div className="text-right font-mono text-xs">
                      <p className="text-white">conf {formatScore(signal.confidence)}</p>
                      <p className="mt-1 text-muted">risk {formatScore(signal.risk)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </Card>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button variant="ghost" onClick={onReset}>
          <RotateCcw className="h-4 w-4" /> New request
        </Button>
        {ticket && onViewProof && (
          <Button variant="outline" onClick={onViewProof}>
            View proof receipt <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </main>
  );
}

type DisplayState = "ALLOW" | "REVIEW" | "BLOCK" | "ERROR";

const stateStyles: Record<DisplayState, Record<string, string>> = {
  ALLOW: {
    badge: "border-emerald-400/30 text-emerald-300",
    border: "border-emerald-400/25",
    glow: "bg-[radial-gradient(circle_at_50%_0%,rgba(52,211,153,.13),transparent_55%)]",
    iconWrap: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    title: "text-emerald-300",
  },
  REVIEW: {
    badge: "border-amber-400/30 text-amber-300",
    border: "border-amber-400/25",
    glow: "bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,.12),transparent_55%)]",
    iconWrap: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    title: "text-amber-300",
  },
  BLOCK: {
    badge: "border-red-400/30 text-red-300",
    border: "border-red-500/35",
    glow: "bg-[radial-gradient(circle_at_50%_0%,rgba(239,68,68,.18),transparent_58%)]",
    iconWrap: "border-red-400/40 bg-red-500/10 text-red-300",
    title: "text-red-400",
  },
  ERROR: {
    badge: "border-red-400/30 text-red-300",
    border: "border-red-500/30",
    glow: "bg-[radial-gradient(circle_at_50%_0%,rgba(239,68,68,.13),transparent_58%)]",
    iconWrap: "border-red-400/30 bg-red-500/10 text-red-300",
    title: "text-red-300",
  },
};

function getDisplayState(
  ticket?: DecisionTicket,
  failure?: VerifyFailureResponse,
): DisplayState {
  if (failure || ticket?.execution.status === "ERROR") return "ERROR";
  return ticket?.policy.verdict ?? "ERROR";
}

function executionReason(ticket?: DecisionTicket): string | undefined {
  return ticket?.execution.status === "ERROR"
    ? `Transfer failed safely: ${ticket.execution.reason.replaceAll("_", " ")}.`
    : undefined;
}

function formatScore(score: number | null): string {
  return score === null ? "unavailable" : `${(score * 100).toFixed(1)}%`;
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="section-label">{label}</dt>
      <dd className={`mt-1.5 break-all text-sm text-[#cbd4ce] ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
