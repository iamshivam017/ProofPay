"use client";

import { useState } from "react";
import { ArrowLeft, Check, Copy, ExternalLink, FileCheck2 } from "lucide-react";

import type { DecisionTicket as DecisionTicketData } from "@/src/lib/ticket/types";
import { DecisionTicket } from "./DecisionTicket";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

interface ProofReceiptProps {
  ticket: DecisionTicketData;
  onBack: () => void;
}

export function ProofReceipt({ ticket, onBack }: ProofReceiptProps) {
  const [copied, setCopied] = useState(false);
  const baseTxHash = ticket.execution.status === "EXECUTED" ? ticket.execution.txHash : null;

  async function shareReceipt() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: `ProofPay ${ticket.policy.verdict}`, url });
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-88px)] w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          <Badge className="border-signal/30 text-signal">
            <FileCheck2 className="mr-1.5 h-3 w-3" /> Verifiable receipt
          </Badge>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">
            Decision proof
          </h1>
        </div>
        <Button variant="outline" onClick={shareReceipt} aria-label="Share receipt URL">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Share"}
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <Card className="rounded-xl p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <p className="section-label">Decision ticket</p>
            <span className="font-mono text-xs text-muted">
              {(ticket.policy.confidence * 100).toFixed(1)}% confidence
            </span>
          </div>
          <DecisionTicket ticket={ticket} />
        </Card>

        <div className="space-y-5">
          <Card className="rounded-xl p-6">
            <div className="flex items-center justify-between gap-4">
              <p className="section-label">Settlement proof</p>
              <span className="font-mono text-[10px] uppercase tracking-[.14em] text-signal">
                x402 settled · {ticket.x402.amountAtomic} atomic
              </span>
            </div>
            <HashProof
              label="x402 payment"
              hash={ticket.x402.transactionHash}
              href={`https://sepolia.basescan.org/tx/${ticket.x402.transactionHash}`}
            />
            <HashProof
              label="Base transfer"
              hash={baseTxHash}
              href={baseTxHash ? `https://sepolia.basescan.org/tx/${baseTxHash}` : undefined}
            />
            {!baseTxHash && (
              <div className="mt-5 border-l-2 border-red-400/60 bg-red-400/[.05] px-4 py-3 font-mono text-xs text-red-300">
                $0 moved — no downstream transaction was produced.
              </div>
            )}
            {ticket.errors.length > 0 && (
              <div className="mt-5 space-y-2 border-t border-line pt-5">
                {ticket.errors.map((error) => (
                  <p key={`${error.code}-${error.message}`} className="font-mono text-xs text-red-300">
                    {error.code}: {error.message}
                  </p>
                ))}
              </div>
            )}
          </Card>

          <Card className="rounded-xl p-6">
            <div className="flex items-center justify-between">
              <p className="section-label">Miner attestations</p>
              <span className="font-mono text-[10px] uppercase tracking-[.14em] text-muted">
                {ticket.verification.latencyMs} ms
              </span>
            </div>
            <div className="mt-4 divide-y divide-line">
              {ticket.verification.signals.map((signal) => (
                <div key={signal.id} className="flex items-center justify-between gap-4 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">{signal.kind}</p>
                    <p className="mt-1 truncate font-mono text-[10px] text-muted">{signal.minerId}</p>
                  </div>
                  <span className="font-mono text-xs text-[#d7e0da]">
                    {signal.confidence === null
                      ? "unavailable"
                      : `${(signal.confidence * 100).toFixed(1)}%`}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Button variant="ghost" className="mt-6" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Back to decision
      </Button>
    </main>
  );
}

function HashProof({ label, hash, href }: { label: string; hash: string | null; href?: string }) {
  return (
    <div className="mt-5 border-t border-line pt-5 first-of-type:border-t-0 first-of-type:pt-0">
      <p className="section-label">{label}</p>
      {hash && href ? (
        <a
          className="mt-2 flex items-start gap-2 break-all font-mono text-xs leading-5 text-signal transition hover:text-white"
          href={href}
          target="_blank"
          rel="noreferrer"
        >
          <span>{hash}</span>
          <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        </a>
      ) : (
        <p className="mt-2 font-mono text-xs text-muted">Not produced</p>
      )}
    </div>
  );
}
