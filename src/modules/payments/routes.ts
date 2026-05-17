import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Web3UnavailableError, type Web3Adapter } from '../../adapters/web3.js';
import { hasJsonObjectBody, sendApiError, sendInvalidRequestBody } from '../../api/errors.js';
import { buildLoanEvidenceMetadata } from '../../domain/evidence.js';
import { buildCanonicalPaymentPayload, hashPaymentPayload, type PaymentAttestation, type PaymentAttestationRequest } from '../../domain/paymentAttestations.js';
import { compareDecimalStrings, subtractDecimalStrings } from '../../domain/money.js';
import type { Loan, PaymentRail } from '../../domain/types.js';
import type { DemoStore } from '../../store/demoStore.js';

type PaymentParams = {
  loanId: string;
};

type PaymentBody = Partial<PaymentAttestationRequest> & { loanSnapshot?: unknown };

const paymentRails = ['WIRE_SIMULATED', 'SPEI_SIMULATED', 'ACH_SIMULATED', 'MANUAL_SIMULATED'] as const satisfies readonly PaymentRail[];

export async function registerPaymentRoutes(app: FastifyInstance, store: DemoStore, web3: Web3Adapter): Promise<void> {
  app.post('/loans/:loanId/payments/attest', async (request: FastifyRequest<{ Params: PaymentParams; Body: PaymentBody }>, reply) => {
    const loan = store.getLoan(request.params.loanId) ?? (isLoanSnapshotFor(request.body?.loanSnapshot, request.params.loanId) ? store.createLoan(request.body.loanSnapshot) : undefined);
    if (!loan) {
      return sendApiError(reply, 404, 'LOAN_NOT_FOUND', `Loan ${request.params.loanId} was not found`);
    }

    const paymentRequest = parsePaymentRequest(request.body, reply);
    if (!paymentRequest) {
      return reply;
    }

    if (loan.status !== 'Active' && loan.status !== 'MarginCall') {
      return sendApiError(reply, 409, 'INVALID_TRANSITION', `Cannot attest payment for loan in ${loan.status} status`);
    }

    if (paymentRequest.currency.toUpperCase() !== loan.currentMetrics.outstandingCurrency.toUpperCase()) {
      return sendApiError(reply, 400, 'INVALID_REQUEST', `Payment currency must match outstanding currency ${loan.currentMetrics.outstandingCurrency}`);
    }

    const canonicalPayload = buildCanonicalPaymentPayload(loan.loanId, paymentRequest);
    const attestationHash = hashPaymentPayload(canonicalPayload);
    const existing = store.findPaymentAttestation(loan.loanId, canonicalPayload.installmentId, attestationHash);
    if (existing) {
      return existing;
    }

    const remainingPrincipal = subtractDecimalStrings(loan.currentMetrics.outstandingPrincipal, canonicalPayload.amount);
    const status: PaymentAttestation['status'] = compareDecimalStrings(remainingPrincipal, '0') === 0 ? 'Repaid' : loan.status;
    const attestation: PaymentAttestation = {
      loanId: loan.loanId,
      installmentId: canonicalPayload.installmentId,
      amount: canonicalPayload.amount,
      currency: canonicalPayload.currency,
      attestationHash,
      remainingPrincipal,
      status
    };

    let registration;
    try {
      registration = await web3.registerPaymentAttestation({ loan, attestation });
    } catch (error) {
      if (error instanceof Web3UnavailableError) {
        if (error.code === 'WEB3_GAS_INSUFFICIENT') {
          return reply.status(503).send({ error: { code: error.code, message: error.message }, signer: error.metadata?.role ?? 'unknown' });
        }
        return sendApiError(reply, 503, error.code, error.message);
      }
      return sendApiError(reply, 502, 'WEB3_ACTION_FAILED', error instanceof Error ? error.message : 'Web3 payment attestation failed');
    }

    const nextLoan: Loan = {
      ...loan,
      status,
      currentMetrics: {
        ...loan.currentMetrics,
        outstandingPrincipal: remainingPrincipal
      }
    };

    const evidence = buildLoanEvidenceMetadata(web3.evidenceSource ?? 'demo-simulated', {
      txHash: registration.txHash,
      blockNumber: registration.blockNumber,
      vaultAddress: loan.collateral.vaultAddress
    });

    const persistedAttestation: PaymentAttestation = {
      ...attestation,
      txHash: registration.txHash,
      blockNumber: registration.blockNumber,
      evidence,
      releaseEvidence: registration.releaseEvidence,
      onChainEvidence: registration.onChainEvidence ?? []
    };

    store.replaceLoan(nextLoan);
    store.savePaymentAttestation(persistedAttestation);
    store.appendEvent({
      eventType: 'InstallmentPaid',
      loanId: nextLoan.loanId,
      txHash: registration.txHash,
      blockNumber: registration.blockNumber,
      payload: {
        eventType: 'InstallmentPaid',
        loanId: nextLoan.loanId,
        installmentId: canonicalPayload.installmentId,
        amount: canonicalPayload.amount,
        currency: canonicalPayload.currency,
        paymentRail: canonicalPayload.paymentRail,
        attestationHash,
        remainingPrincipal,
        status,
        evidence
      }
    });

    if (registration.releaseEvidence?.status === 'confirmed') {
      store.appendEvent({
        eventType: 'CollateralReleased',
        loanId: nextLoan.loanId,
        txHash: registration.releaseEvidence.txHash ?? null,
        blockNumber: registration.releaseEvidence.blockNumber ?? null,
        payload: {
          eventType: 'CollateralReleased',
          loanId: nextLoan.loanId,
          status,
          releaseEvidence: registration.releaseEvidence
        }
      });
    }

    return persistedAttestation;
  });
}

function isLoanSnapshotFor(value: unknown, loanId: string): value is Loan {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<Loan>;
  return candidate.loanId === loanId &&
    typeof candidate.status === 'string' &&
    Boolean(candidate.borrower?.walletAddress) &&
    Boolean(candidate.originator?.originatorId) &&
    Boolean(candidate.fundingPartner?.fundingPartnerId) &&
    Boolean(candidate.principal?.amount) &&
    Boolean(candidate.collateral?.token) &&
    typeof candidate.terms?.initialLtvBps === 'number' &&
    Boolean(candidate.riskAssessment?.riskAssessmentId) &&
    candidate.receipt !== undefined &&
    Boolean(candidate.currentMetrics?.outstandingPrincipal) &&
    Boolean(candidate.liquidationPreview?.proceedsCurrency);
}

function parsePaymentRequest(body: PaymentBody | undefined, reply: FastifyReply): PaymentAttestationRequest | null {
  if (!hasJsonObjectBody(body)) {
    sendInvalidRequestBody(reply);
    return null;
  }

  if (!body.installmentId || !body.amount || !body.currency || !body.paidAt || !isPaymentRail(body.paymentRail)) {
    sendApiError(reply, 400, 'INVALID_REQUEST', 'Payment attestation request is missing required canonical fields');
    return null;
  }

  if (!Number.isFinite(Number(body.amount)) || Number(body.amount) <= 0) {
    sendApiError(reply, 400, 'INVALID_REQUEST', 'Payment amount must be a positive decimal string');
    return null;
  }

  if (Number.isNaN(Date.parse(body.paidAt))) {
    sendApiError(reply, 400, 'INVALID_REQUEST', 'paidAt must be a valid ISO date-time');
    return null;
  }

  return {
    installmentId: body.installmentId,
    amount: body.amount,
    currency: body.currency,
    paymentRail: body.paymentRail,
    paidAt: body.paidAt,
    externalPaymentRef: body.externalPaymentRef ?? null
  };
}

function isPaymentRail(value: unknown): value is PaymentRail {
  return typeof value === 'string' && paymentRails.includes(value as PaymentRail);
}
