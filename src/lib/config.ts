import "server-only";

import { getAddress, isAddress, type Address, type Hex } from "viem";
import { z } from "zod";

import { DEFAULT_BASE_SEPOLIA_USDC } from "@/lib/telegraph/x402-client";

const REQUIRED_KEYS = [
  "BASE_SEPOLIA_RPC_URL",
  "EXECUTOR_PRIVATE_KEY",
  "TELEGRAPH_ENGINE_URL",
  "X402_MAX_PAYMENT_ATOMIC",
] as const;

const configSchema = z.object({
  BASE_SEPOLIA_RPC_URL: z.string().url(),
  EXECUTOR_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  TELEGRAPH_ENGINE_URL: z.string().url(),
  BASE_SEPOLIA_USDC_ADDRESS: z
    .string()
    .refine(isAddress, "must be an EVM address")
    .default(DEFAULT_BASE_SEPOLIA_USDC),
  X402_MAX_PAYMENT_ATOMIC: z.coerce.bigint().positive(),
  TELEGRAPH_REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(120_000)
    .default(30_000),
});

export interface ServerConfig {
  baseSepoliaRpcUrl: string;
  executorPrivateKey: Hex;
  telegraphEngineUrl: string;
  baseSepoliaUsdcAddress: Address;
  x402MaxPaymentAtomic: bigint;
  telegraphRequestTimeoutMs: number;
}

export interface ConfigStatus {
  configured: boolean;
  missing: string[];
  warnings: string[];
}

type Environment = Readonly<Record<string, string | undefined>>;

export type ConfigFailureKind =
  | "MISSING_CONFIG"
  | "INVALID_CONFIG"
  | "UNSAFE_CONFIG";

export class ConfigValidationError extends Error {
  readonly code: ConfigFailureKind;

  constructor(code: ConfigFailureKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ConfigValidationError";
    this.code = code;
  }
}

/** Returns metadata only; secret values are never included. */
export function getConfigStatus(env: Environment = process.env): ConfigStatus {
  const missing = REQUIRED_KEYS.filter((key) => !env[key]?.trim());
  const warnings: string[] = [];

  if (missing.length === 0) {
    const parsed = configSchema.safeParse(env);
    if (!parsed.success) warnings.push("One or more environment values are invalid.");
    if (parsed.success) warnings.push(...unsafeWarnings(parsed.data));
  }

  return {
    configured: missing.length === 0 && warnings.length === 0,
    missing: [...missing],
    warnings,
  };
}

export function getServerConfig(env: Environment = process.env): ServerConfig {
  const status = getConfigStatus(env);
  if (status.missing.length > 0) {
    throw new ConfigValidationError(
      "MISSING_CONFIG",
      `Missing required server configuration: ${status.missing.join(", ")}`,
    );
  }

  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigValidationError(
      "INVALID_CONFIG",
      "One or more server configuration values are invalid.",
      { cause: parsed.error },
    );
  }

  const unsafe = unsafeWarnings(parsed.data);
  if (unsafe.length > 0) {
    throw new ConfigValidationError("UNSAFE_CONFIG", unsafe.join(" "));
  }

  return {
    baseSepoliaRpcUrl: parsed.data.BASE_SEPOLIA_RPC_URL,
    executorPrivateKey: parsed.data.EXECUTOR_PRIVATE_KEY as Hex,
    telegraphEngineUrl: parsed.data.TELEGRAPH_ENGINE_URL,
    baseSepoliaUsdcAddress: getAddress(parsed.data.BASE_SEPOLIA_USDC_ADDRESS),
    x402MaxPaymentAtomic: parsed.data.X402_MAX_PAYMENT_ATOMIC,
    telegraphRequestTimeoutMs: parsed.data.TELEGRAPH_REQUEST_TIMEOUT_MS,
  };
}

function unsafeWarnings(data: z.infer<typeof configSchema>): string[] {
  const warnings: string[] = [];
  const rpc = new URL(data.BASE_SEPOLIA_RPC_URL);
  const telegraph = new URL(data.TELEGRAPH_ENGINE_URL);

  if (rpc.protocol !== "https:" && !isLocalhost(rpc.hostname)) {
    warnings.push("Base Sepolia RPC must use HTTPS outside localhost.");
  }
  if (telegraph.protocol !== "https:" && !isLocalhost(telegraph.hostname)) {
    warnings.push("Telegraph endpoint must use HTTPS outside localhost.");
  }
  if (telegraph.hostname.endsWith(".example")) {
    warnings.push("Telegraph endpoint is still a placeholder.");
  }
  if (/^0x0{64}$/i.test(data.EXECUTOR_PRIVATE_KEY)) {
    warnings.push("Executor private key is unsafe.");
  }
  return warnings;
}

function isLocalhost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}
