"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Fingerprint, LockKeyhole, ShieldCheck, Zap } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { DecisionPanel } from "@/src/components/DecisionPanel";
import { ProofReceipt } from "@/src/components/ProofReceipt";
import { VerificationChamber } from "@/src/components/VerificationChamber";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import type { DecisionTicket, VerifyFailureResponse } from "@/src/lib/ticket/types";

const formSchema = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,18})?$/, "Enter a valid ETH amount")
    .refine(
      (value) => Number(value) > 0 && Number(value) <= 0.001,
      "Use an amount from 0.000000000000000001 to 0.001 ETH",
    ),
  recipient: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Enter a valid EVM wallet address"),
  reason: z.string().trim().min(3, "Give this payment a clear reason").max(280),
  evidence: z.string().trim().min(3, "Provide evidence for Miner verification").max(20_000),
});

type FormValues = z.infer<typeof formSchema>;
type Phase = "request" | "verifying" | "decision" | "receipt";

export default function HomePage() {
  const [phase, setPhase] = useState<Phase>("request");
  const [pending, setPending] = useState<FormValues | null>(null);
  const [ticket, setTicket] = useState<DecisionTicket | null>(null);
  const [failure, setFailure] = useState<VerifyFailureResponse | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { amount: "0.0001", recipient: "", reason: "", evidence: "" },
  });

  async function submit(values: FormValues) {
    setPending(values);
    setTicket(null);
    setFailure(null);
    setPhase("verifying");

    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, intent: "AUTHENTICITY_GATE" }),
      });
      const body: unknown = await response.json();

      if (!response.ok || isFailure(body)) {
        setFailure(
          isFailure(body)
            ? body
            : unavailableFailure("Verification unavailable — action held for safety."),
        );
      } else if (isDecisionTicket(body)) {
        setTicket(body);
      } else {
        setFailure(unavailableFailure("Verification returned an invalid decision ticket."));
      }
    } catch {
      setFailure(unavailableFailure("Verification unavailable — action held for safety."));
    } finally {
      setPhase("decision");
    }
  }

  function reset() {
    setTicket(null);
    setFailure(null);
    setPending(null);
    setPhase("request");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink">
      <div className="proof-grid pointer-events-none absolute inset-0" />
      <Header phase={phase} />
      <div className="relative z-10">
        {phase === "request" && (
          <RequestScreen form={form} onSubmit={form.handleSubmit(submit)} />
        )}
        {phase === "verifying" && pending && (
          <VerificationChamber
            amount={pending.amount}
            recipient={pending.recipient}
            intent="AUTHENTICITY_GATE"
          />
        )}
        {phase === "decision" && (
          <DecisionPanel
            ticket={ticket ?? undefined}
            failure={failure ?? undefined}
            onReset={reset}
            onViewProof={ticket ? () => setPhase("receipt") : undefined}
          />
        )}
        {phase === "receipt" && ticket && (
          <ProofReceipt ticket={ticket} onBack={() => setPhase("decision")} />
        )}
      </div>
    </div>
  );
}

function RequestScreen({
  form,
  onSubmit,
}: {
  form: ReturnType<typeof useForm<FormValues>>;
  onSubmit: () => void;
}) {
  const { register, formState } = form;

  return (
    <main className="mx-auto min-h-[calc(100vh-88px)] w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="grid items-start gap-9 lg:grid-cols-[.82fr_1.18fr] lg:gap-14">
        <section className="pt-3 lg:sticky lg:top-28">
          <Badge className="border-signal/30 text-signal">
            <ShieldCheck className="mr-1.5 h-3 w-3" /> Telegraph intelligence × Base
          </Badge>
          <h1 className="mt-7 max-w-xl text-5xl font-semibold leading-[.98] tracking-[-0.06em] text-white sm:text-6xl">
            Verify intent.
            <br />Then move value.
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-muted">
            ProofPay puts live Miner intelligence between a payment instruction and the wallet that executes it.
          </p>

          <div className="mt-10 grid max-w-md grid-cols-3 border-y border-line py-5">
            <TrustStat icon={<Fingerprint />} label="Authenticity" value="Miner-gated" />
            <TrustStat icon={<LockKeyhole />} label="Default" value="Fail-closed" />
            <TrustStat icon={<Zap />} label="Settlement" value="Base Sepolia" />
          </div>
        </section>

        <Card className="rounded-xl p-5 sm:p-8">
          <div className="mb-7 flex items-start justify-between gap-5">
            <div>
              <p className="section-label">New payment request</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-white">
                Instruction envelope
              </h2>
            </div>
            <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.14em] text-muted">
              Testnet
            </span>
          </div>

          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <div className="grid gap-5 sm:grid-cols-[.42fr_.58fr]">
              <Field label="Amount" error={formState.errors.amount?.message} suffix="ETH">
                <Input inputMode="decimal" autoComplete="off" {...register("amount")} />
              </Field>
              <Field label="Recipient wallet" error={formState.errors.recipient?.message}>
                <Input
                  className="font-mono text-xs"
                  placeholder="0x…"
                  autoComplete="off"
                  spellCheck={false}
                  {...register("recipient")}
                />
              </Field>
            </div>

            <Field label="Payment reason" error={formState.errors.reason?.message}>
              <Input placeholder="Invoice, delivery, reimbursement…" {...register("reason")} />
            </Field>

            <Field
              label="Evidence message"
              hint="Sent to a live Telegraph Miner"
              error={formState.errors.evidence?.message}
            >
              <Textarea
                rows={6}
                placeholder="Paste the instruction, invoice context, or claim the Miner should verify…"
                {...register("evidence")}
              />
            </Field>

            <div className="border-t border-line pt-6">
              <Button type="submit" className="h-12 w-full text-[15px]">
                Verify &amp; execute <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-[.13em] text-muted">
                Only an ALLOW decision can reach the executor
              </p>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}

function Header({ phase }: { phase: Phase }) {
  const active = phase === "receipt" ? 4 : phase === "decision" ? 3 : phase === "verifying" ? 2 : 1;
  return (
    <header className="relative z-20 border-b border-line/80 bg-ink/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[88px] max-w-6xl items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-signal/40 bg-signal/10 font-mono text-sm font-black text-signal">P</span>
          <div>
            <p className="text-sm font-bold tracking-[-0.02em] text-white">ProofPay</p>
            <p className="font-mono text-[8px] uppercase tracking-[.17em] text-muted">Verification gateway</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          {["Request", "Verify", "Decision", "Proof"].map((label, index) => (
            <div key={label} className="flex items-center gap-2">
              <span className={`font-mono text-[9px] uppercase tracking-[.13em] ${index + 1 <= active ? "text-signal" : "text-[#4f5852]"}`}>
                {String(index + 1).padStart(2, "0")} {label}
              </span>
              {index < 3 && <span className="h-px w-4 bg-line" />}
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}

function Field({
  label,
  hint,
  suffix,
  error,
  children,
}: {
  label: string;
  hint?: string;
  suffix?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-3">
        <span className="section-label">{label}</span>
        <span className="font-mono text-[9px] uppercase tracking-[.12em] text-muted">{error ?? hint ?? suffix}</span>
      </span>
      {children}
    </label>
  );
}

function TrustStat({ icon, label, value }: { icon: React.ReactElement; label: string; value: string }) {
  return (
    <div className="border-l border-line px-3 first:border-l-0 first:pl-0">
      <span className="block h-4 w-4 text-signal [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <span className="mt-3 block font-mono text-[8px] uppercase tracking-[.14em] text-muted">{label}</span>
      <span className="mt-1 block text-xs font-medium text-[#d5ddd8]">{value}</span>
    </div>
  );
}

function isFailure(value: unknown): value is VerifyFailureResponse {
  return Boolean(
    value &&
      typeof value === "object" &&
      "error" in value &&
      typeof (value as VerifyFailureResponse).error?.message === "string",
  );
}

function isDecisionTicket(value: unknown): value is DecisionTicket {
  return Boolean(
    value &&
      typeof value === "object" &&
      "policy" in value &&
      "execution" in value &&
      "x402" in value,
  );
}

function unavailableFailure(message: string): VerifyFailureResponse {
  return {
    requestId: "unavailable",
    timestamp: new Date().toISOString(),
    error: { code: "VERIFICATION_UNAVAILABLE", message },
  };
}
