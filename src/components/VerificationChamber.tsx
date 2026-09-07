"use client";

import { useEffect, useState } from "react";
import { Activity, LockKeyhole, Radio } from "lucide-react";

import { Badge } from "./ui/badge";
import { Card } from "./ui/card";

interface VerificationChamberProps {
  amount: string;
  recipient: string;
  intent: string;
}

const truthfulStages = [
  "Payment instruction sealed locally",
  "Connecting to ProofPay verification endpoint",
  "Telegraph x402 handshake in progress",
  "Awaiting paid Miner response",
];

export function VerificationChamber({
  amount,
  recipient,
  intent,
}: VerificationChamberProps) {
  const [elapsed, setElapsed] = useState(0);
  const [visibleStages, setVisibleStages] = useState(1);

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
      setVisibleStages((current) => Math.min(current + 1, truthfulStages.length));
    }, 750);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-6xl items-center px-5 py-12 sm:px-8">
      <Card className="w-full overflow-hidden rounded-xl">
        <div className="grid lg:grid-cols-[.78fr_1.22fr]">
          <section className="border-b border-line p-7 lg:border-b-0 lg:border-r lg:p-10">
            <Badge className="border-signal/30 text-signal">
              <Radio className="mr-1.5 h-3 w-3 animate-pulse" /> Live verification
            </Badge>
            <h1 className="mt-7 max-w-md text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">
              Verification chamber
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
              Funds remain stationary while Telegraph intelligence evaluates the instruction.
            </p>

            <dl className="mt-10 space-y-5 border-t border-line pt-6 font-mono text-xs">
              <Meta label="Intent" value={intent} />
              <Meta label="Requested" value={`${amount} ETH`} />
              <Meta label="Recipient" value={shorten(recipient)} />
              <Meta label="Elapsed" value={`${elapsed}s`} />
            </dl>
          </section>

          <section className="relative min-h-[430px] bg-[#090c0a] p-5 sm:p-8 lg:p-10">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal/50 to-transparent" />
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2 font-mono text-xs text-muted">
                <span className="h-2 w-2 rounded-full bg-signal shadow-[0_0_12px_#b8ff65]" />
                PROOFPAY / TRACE
              </div>
              <Activity className="h-4 w-4 text-signal" />
            </div>

            <div className="mt-7 space-y-5 font-mono text-sm" aria-live="polite">
              {truthfulStages.slice(0, visibleStages).map((stage, index) => (
                <div key={stage} className="flex gap-3 text-[#c4cec7] animate-in">
                  <span className="select-none text-signal">&gt;</span>
                  <span>{stage}{index === visibleStages - 1 ? "…" : " ✓"}</span>
                </div>
              ))}
            </div>

            <div className="absolute inset-x-5 bottom-6 sm:inset-x-8 lg:inset-x-10">
              <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[.18em] text-muted">
                <span>Fail-closed channel</span>
                <span>Awaiting ground truth</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/5">
                <div className="verification-scan h-full w-1/3 rounded-full bg-signal" />
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted">
                <LockKeyhole className="h-3.5 w-3.5" /> No transfer can execute before ALLOW.
              </div>
            </div>
          </section>
        </div>
      </Card>
    </main>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="mb-1.5 uppercase tracking-[.16em] text-[#647068]">{label}</dt>
      <dd className="break-all text-[#dce5df]">{value}</dd>
    </div>
  );
}

function shorten(value: string): string {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;
}
