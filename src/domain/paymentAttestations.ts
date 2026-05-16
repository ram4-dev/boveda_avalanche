import { canonicalJson } from './canonicalJson.js';
import type { EvidenceMetadata } from './evidence.js';
import { sha256Hex } from './hashing.js';
import { normalizeDecimalString } from './money.js';
import type { PaymentRail } from './types.js';
export type PaymentAttestationRequest = {
  installmentId: string;
  amount: string;
  currency: string;
  paymentRail: PaymentRail;
  paidAt: string;
  externalPaymentRef?: string | null;
};

export type CanonicalPaymentPayload = {
  schemaVersion: 'boveda.payment-attestation.v1';
  loanId: string;
  installmentId: string;
  amount: string;
  currency: string;
  paymentRail: PaymentRail;
  paidAt: string;
  externalPaymentRef: string | null;
};

export type PaymentAttestation = {
  loanId: string;
  installmentId: string;
  amount: string;
  currency: string;
  attestationHash: `0x${string}`;
  remainingPrincipal: string;
  status: 'Active' | 'MarginCall' | 'Repaid';
  txHash?: `0x${string}`;
  blockNumber?: number | null;
  evidence?: EvidenceMetadata;
};

export function buildCanonicalPaymentPayload(loanId: string, request: PaymentAttestationRequest): CanonicalPaymentPayload {
  return {
    schemaVersion: 'boveda.payment-attestation.v1',
    loanId,
    installmentId: request.installmentId,
    amount: normalizeDecimalString(request.amount),
    currency: request.currency.toUpperCase(),
    paymentRail: request.paymentRail,
    paidAt: new Date(request.paidAt).toISOString(),
    externalPaymentRef: request.externalPaymentRef ?? null
  };
}

export function hashPaymentPayload(payload: CanonicalPaymentPayload): `0x${string}` {
  return sha256Hex(canonicalJson(payload));
}
