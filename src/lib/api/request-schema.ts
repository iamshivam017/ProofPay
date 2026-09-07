import { parseEther } from "viem";
import { z } from "zod";

export const MAX_REQUEST_AMOUNT_WEI = parseEther("0.001");
export const SUPPORTED_INTENT = "AUTHENTICITY_GATE" as const;

const amountSchema = z.string().trim().refine((value) => {
  try {
    const amount = parseEther(value);
    return amount > 0n && amount <= MAX_REQUEST_AMOUNT_WEI;
  } catch {
    return false;
  }
}, "Amount must be greater than 0 and no more than 0.001 ETH");

export const verificationRequestSchema = z.object({
  amount: amountSchema,
  recipient: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid recipient wallet"),
  reason: z.string().trim().min(3).max(280),
  evidence: z.string().trim().min(3).max(20_000),
  intent: z.literal(SUPPORTED_INTENT).default(SUPPORTED_INTENT),
});

export type VerificationRequest = z.infer<typeof verificationRequestSchema>;

export type RequestFailureCode = "INVALID_INPUT" | "UNSUPPORTED_INTENT";

export class RequestValidationError extends Error {
  constructor(readonly code: RequestFailureCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RequestValidationError";
  }
}

export function parseVerificationRequest(value: unknown): VerificationRequest {
  if (
    value &&
    typeof value === "object" &&
    "intent" in value &&
    typeof value.intent === "string" &&
    value.intent !== SUPPORTED_INTENT
  ) {
    throw new RequestValidationError("UNSUPPORTED_INTENT", "Requested intent is unsupported.");
  }

  const parsed = verificationRequestSchema.safeParse(value);
  if (!parsed.success) {
    throw new RequestValidationError(
      "INVALID_INPUT",
      "Payment request is incomplete or invalid.",
      { cause: parsed.error },
    );
  }
  return parsed.data;
}
