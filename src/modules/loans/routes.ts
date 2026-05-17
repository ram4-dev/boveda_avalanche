import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Web3UnavailableError, type Web3Adapter, type OnChainEvidenceStep } from '../../adapters/web3.js';
import { loanScenarioValues, loanStatusValues } from '../../api/schemas.js';
import { hasJsonObjectBody, sendApiError, sendInvalidRequestBody } from '../../api/errors.js';
import { buildLoanEvidenceMetadata } from '../../domain/evidence.js';
import { shortHash } from '../../domain/hashing.js';
import { normalizeDecimalString } from '../../domain/money.js';
import { canTransition } from '../../domain/stateMachine.js';
import type { Borrower, Collateral, CollateralTerms, FundingPartner, Loan, OnChainEvent, Originator, Principal, ProceedsDistribution } from '../../domain/types.js';
import { isLoanScenario, isLoanStatus, type LoanScenario, type LoanStatus } from '../../domain/types.js';
import type { DemoStore } from '../../store/demoStore.js';

type ListLoansQuery = {
  scenario?: string;
  status?: string;
};

type LoanParams = {
  loanId: string;
};

type CreateLoanBody = {
  scenario?: unknown;
  borrower?: Borrower;
  originator?: Originator;
  fundingPartner?: FundingPartner;
  principal?: Principal;
  collateral?: Collateral;
  terms?: CollateralTerms;
  riskAssessmentId?: string;
};

type ApproveBody = {
  approvedBy?: string;
  fiatDisbursementRef?: string;
  loanSnapshot?: unknown;
};

type CancelBody = {
  cancelledBy?: string;
  reason?: string;
  loanSnapshot?: unknown;
};

type DepositBody = {
  token?: string;
  amount?: string;
  txHash?: string;
  vaultAddress?: string;
  loanSnapshot?: unknown;
};

type ActivateBody = {
  receiptTokenId?: string;
  activationTxHash?: `0x${string}`;
  loanSnapshot?: unknown;
};

type CollateralTopUpBody = {
  token?: string;
  amount?: string;
  txHash?: `0x${string}`;
  resultingLtvBps?: number;
  loanSnapshot?: unknown;
};

type MarginCallBody = {
  currentLtvBps?: number;
  reason?: string;
  requiredTopUpAmount?: string;
  requiredTopUpCurrency?: string;
  loanSnapshot?: unknown;
};

type LiquidationBody = {
  reason?: string;
  liquidationTxHash?: `0x${string}`;
  proceedsAmount?: string;
  proceedsCurrency?: string;
  distribution?: ProceedsDistribution;
  loanSnapshot?: unknown;
};

// Canonical USDC equivalent for the Fuji demo principal, regardless of the fiat
// currency that the operator quotes off-chain (MXN, USD, etc.). The Fuji demo
// wallet is funded for the 10 USDC / 15 USDC collateral flow.
const DEMO_PRINCIPAL_USDC_BASE_UNITS = '10000000';

export async function registerLoanRoutes(app: FastifyInstance, store: DemoStore, web3: Web3Adapter): Promise<void> {
  app.get('/loans', async (request: FastifyRequest<{ Querystring: ListLoansQuery }>, reply) => {
    const filter = parseLoanFilter(request.query, reply);
    if (!filter) {
      return reply;
    }

    return { loans: store.listLoans(filter) };
  });

  app.post('/loans', async (request: FastifyRequest<{ Body: CreateLoanBody }>, reply) => {
    const body = request.body;
    if (!hasJsonObjectBody(body)) {
      return sendInvalidRequestBody(reply);
    }

    if (!isLoanScenario(body.scenario) || !body.borrower || !body.originator || !body.fundingPartner || !body.principal || !body.collateral || !body.terms || !body.riskAssessmentId) {
      return sendApiError(reply, 400, 'INVALID_REQUEST', 'Create loan request is missing required canonical fields');
    }

    const riskAssessment = store.getRiskAssessment(body.riskAssessmentId);
    if (!riskAssessment) {
      return sendApiError(reply, 422, 'RISK_ASSESSMENT_NOT_FOUND', `Risk assessment ${body.riskAssessmentId} was not found`);
    }

    if (riskAssessment.amlStatus !== 'PASS') {
      return sendApiError(reply, 422, 'INVALID_REQUEST', `Risk assessment ${body.riskAssessmentId} is not approved`);
    }

    if (body.terms.initialLtvBps > riskAssessment.maxLtvBps) {
      return sendApiError(reply, 422, 'INVALID_REQUEST', 'Loan terms exceed risk assessment maxLtvBps');
    }

    const borrower = normalizeRequiredWallet(body.borrower);
    const originator = normalizeOptionalWallet(body.originator);
    const fundingPartner = normalizeOptionalWallet(body.fundingPartner);
    const collateral = normalizeCollateralAddresses(body.collateral);

    const baseLoanId = `loan-${body.scenario.toLowerCase().replaceAll('_', '-')}-${shortHash({ borrower, principal: body.principal, riskAssessmentId: body.riskAssessmentId })}`;
    let uniqueLoanId = baseLoanId;
    let collisionCounter = 2;
    while (store.getLoan(uniqueLoanId)) {
      uniqueLoanId = `${baseLoanId}-r${collisionCounter}`;
      collisionCounter += 1;
    }
    const loan: Loan = {
      loanId: uniqueLoanId,
      onChainLoanId: null,
      scenario: body.scenario,
      status: 'Requested',
      borrower,
      originator,
      fundingPartner,
      principal: body.principal,
      collateral,
      terms: body.terms,
      riskAssessment,
      receipt: null,
      currentMetrics: {
        currentLtvBps: body.terms.initialLtvBps,
        outstandingPrincipal: body.principal.amount,
        outstandingCurrency: body.principal.currency,
        nextPaymentDueAt: null
      },
      liquidationPreview: buildLiquidationPreview(body.principal.amount)
    };

    store.createLoan(loan);
    appendLoanCreated(store, loan);

    if (web3.evidenceSource === 'fuji-live' && web3.createLoanOnChain) {
      try {
        // On-chain LoanRegistry registers principal in USDC base units. When the
        // off-chain principal is a fiat currency (MXN, USD, etc.), translate to the
        // canonical demo USDC amount: 10 USDC = 10_000_000 base units. The fiat
        // value remains the source of truth for the dashboard and SPEI/wire rail.
        const principalUsdcBaseUnits = loan.principal.currency === 'USDC'
          ? loan.principal.amount
          : DEMO_PRINCIPAL_USDC_BASE_UNITS;
        const onChain = await web3.createLoanOnChain({
          loan,
          loanAmountBaseUnits: principalUsdcBaseUnits,
          ltvBps: loan.terms.initialLtvBps,
          tenorDays: loan.terms.tenorDays
        });
        const persisted = { ...loan, onChainLoanId: onChain.onChainLoanId };
        store.replaceLoan(persisted);
        return reply.status(201).send(persisted);
      } catch (error) {
        store.deleteLoan(loan.loanId);
        if (error instanceof Web3UnavailableError) {
          if (error.code === 'WEB3_GAS_INSUFFICIENT') {
            return reply.status(503).send({ error: { code: error.code, message: error.message }, signer: error.metadata?.role ?? 'originator' });
          }
          return sendApiError(reply, 502, error.code === 'WEB3_ACTION_FAILED' ? 'WEB3_ACTION_FAILED' : 'WEB3_UNAVAILABLE', error.message);
        }
        return sendApiError(reply, 502, 'WEB3_ACTION_FAILED', error instanceof Error ? error.message : 'Web3 createLoan failed');
      }
    }

    return reply.status(201).send(loan);
  });

  app.get('/loans/:loanId', async (request: FastifyRequest<{ Params: LoanParams }>, reply) => {
    const loan = store.getLoan(request.params.loanId);
    if (!loan) {
      return sendApiError(reply, 404, 'LOAN_NOT_FOUND', `Loan ${request.params.loanId} was not found`);
    }

    return loan;
  });

  app.post('/loans/:loanId/approve', async (request: FastifyRequest<{ Params: LoanParams; Body: ApproveBody }>, reply) => {
    if (!hasJsonObjectBody(request.body)) {
      return sendInvalidRequestBody(reply);
    }
    const loan = findLoan(store, request.params.loanId, reply, request.body.loanSnapshot);
    if (!loan) return reply;
    if (!request.body.approvedBy) {
      return sendApiError(reply, 400, 'INVALID_REQUEST', 'Approve loan request is missing required fields');
    }
    if (!canTransition(loan.status, 'Approved')) {
      return invalidTransition(reply, loan.status, 'Approved');
    }

    const nextLoan: Loan = {
      ...loan,
      status: 'Approved',
      principal: {
        ...loan.principal,
        disbursementRef: request.body.fiatDisbursementRef ?? loan.principal.disbursementRef ?? null
      }
    };
    store.replaceLoan(nextLoan);
    store.appendEvent(baseEvent('LoanApproved', nextLoan.loanId, null, {
      eventType: 'LoanApproved',
      loanId: nextLoan.loanId,
      approvedBy: request.body.approvedBy ?? nextLoan.originator.originatorId,
      fiatDisbursementRef: nextLoan.principal.disbursementRef ?? null,
      status: 'Approved'
    }));
    return nextLoan;
  });

  app.post('/loans/:loanId/cancel', async (request: FastifyRequest<{ Params: LoanParams; Body: CancelBody }>, reply) => {
    if (!hasJsonObjectBody(request.body)) {
      return sendInvalidRequestBody(reply);
    }
    const loan = findLoan(store, request.params.loanId, reply, request.body.loanSnapshot);
    if (!loan) return reply;
    if (!canTransition(loan.status, 'Cancelled')) {
      return invalidTransition(reply, loan.status, 'Cancelled');
    }

    const nextLoan: Loan = { ...loan, status: 'Cancelled' };
    store.replaceLoan(nextLoan);
    store.appendEvent(baseEvent('LoanCancelled', nextLoan.loanId, null, {
      eventType: 'LoanCancelled',
      loanId: nextLoan.loanId,
      cancelledBy: request.body.cancelledBy ?? nextLoan.originator.originatorId,
      reason: request.body.reason ?? 'operator-rejected',
      status: 'Cancelled'
    }));
    return nextLoan;
  });

  app.post('/loans/:loanId/collateral/deposit', async (request: FastifyRequest<{ Params: LoanParams; Body: DepositBody }>, reply) => {
    const loan = findLoan(store, request.params.loanId, reply, hasJsonObjectBody(request.body) ? request.body.loanSnapshot : undefined);
    if (!loan) return reply;
    if (loan.status !== 'Approved') {
      return invalidTransition(reply, loan.status, 'CollateralDeposited');
    }
    const fujiReady = web3.evidenceSource === 'fuji-live' && typeof web3.originateCollateralDeposit === 'function';
    if (!fujiReady && !hasJsonObjectBody(request.body)) {
      return sendInvalidRequestBody(reply);
    }
    if (fujiReady && request.body !== undefined && request.body !== null && !hasJsonObjectBody(request.body)) {
      return sendInvalidRequestBody(reply);
    }
    const body = request.body;

    let deposit: { ok: true; txHash: `0x${string}`; blockNumber: number | null; token: string; amountBaseUnits: string; decimals: number; vaultAddress: string };
    let originatedEvidence: OnChainEvidenceStep[] = [];

    if (fujiReady) {
      try {
        const amount = body?.amount ?? loan.collateral.amountBaseUnits ?? loan.collateral.amount;
        const originated = await web3.originateCollateralDeposit!({ loan, amountBaseUnits: amount });
        deposit = {
          ok: true,
          txHash: originated.depositTxHash,
          blockNumber: originated.depositBlockNumber,
          token: originated.token,
          amountBaseUnits: originated.amountBaseUnits,
          decimals: originated.decimals,
          vaultAddress: originated.vaultAddress
        };
        originatedEvidence = originated.onChainEvidence;
      } catch (error) {
        if (error instanceof Web3UnavailableError) {
          if (error.code === 'WEB3_GAS_INSUFFICIENT') {
            return reply.status(503).send({ error: { code: error.code, message: error.message }, signer: error.metadata?.role ?? 'borrower' });
          }
          return sendApiError(reply, 503, error.code === 'WEB3_ACTION_FAILED' ? 'WEB3_ACTION_FAILED' : 'WEB3_UNAVAILABLE', error.message);
        }
        return sendApiError(reply, 502, 'WEB3_ACTION_FAILED', error instanceof Error ? error.message : 'Web3 collateral deposit origination failed');
      }
    } else {
      if (!body?.token || !body?.amount || !body?.txHash || !body?.vaultAddress) {
        return sendApiError(reply, 400, 'INVALID_REQUEST', 'Collateral deposit request is missing required fields');
      }
      const tokenSymbol = body.token.toUpperCase();
      deposit = {
        ok: true,
        txHash: body.txHash as `0x${string}`,
        blockNumber: null,
        token: tokenSymbol,
        amountBaseUnits: body.amount,
        decimals: tokenSymbol === 'USDC' ? 6 : 18,
        vaultAddress: body.vaultAddress
      };
      if ((web3.evidenceSource ?? 'demo-simulated') !== 'demo-simulated') {
        try {
          if (!web3.verifyCollateralDeposit) {
            throw new Web3UnavailableError('Fuji collateral deposit verification is not configured');
          }
          deposit = await web3.verifyCollateralDeposit({
            loan,
            token: body.token,
            amount: body.amount,
            txHash: body.txHash as `0x${string}`,
            vaultAddress: body.vaultAddress
          });
        } catch (error) {
          if (error instanceof Web3UnavailableError) {
            return sendApiError(reply, 503, error.code, error.message);
          }
          return sendApiError(reply, 502, 'WEB3_ACTION_FAILED', error instanceof Error ? error.message : 'Web3 collateral deposit verification failed');
        }
      }
    }

    const depositEvidence = buildLoanEvidenceMetadata(web3.evidenceSource ?? 'demo-simulated', {
      txHash: deposit.txHash,
      blockNumber: deposit.blockNumber,
      vaultAddress: deposit.vaultAddress,
      token: {
        symbol: deposit.token,
        address: loan.collateral.tokenAddress,
        decimals: deposit.decimals,
        amountBaseUnits: deposit.amountBaseUnits
      }
    });

    const nextLoan: Loan = {
      ...loan,
      collateral: {
        ...loan.collateral,
        token: deposit.token,
        amount: deposit.amountBaseUnits,
        amountBaseUnits: deposit.amountBaseUnits,
        tokenDecimals: deposit.decimals,
        depositTxHash: deposit.txHash,
        vaultAddress: deposit.vaultAddress
      }
    };
    store.replaceLoan(nextLoan);
    store.appendEvent(baseEvent('CollateralDeposited', nextLoan.loanId, deposit.txHash, {
      eventType: 'CollateralDeposited',
      loanId: nextLoan.loanId,
      vaultAddress: deposit.vaultAddress,
      token: deposit.token,
      amount: deposit.amountBaseUnits,
      txHash: deposit.txHash,
      status: 'Approved',
      evidence: depositEvidence,
      onChainEvidence: originatedEvidence
    }));
    return { ...nextLoan, onChainEvidence: originatedEvidence };
  });

  app.post('/loans/:loanId/collateral/top-up', async (request: FastifyRequest<{ Params: LoanParams; Body: CollateralTopUpBody }>, reply) => {
    if (!hasJsonObjectBody(request.body)) {
      return sendInvalidRequestBody(reply);
    }
    const loan = findLoan(store, request.params.loanId, reply, request.body.loanSnapshot);
    if (!loan) return reply;
    if (loan.status !== 'Active' && loan.status !== 'MarginCall') {
      return invalidTransition(reply, loan.status, 'CollateralToppedUp');
    }
    if (!request.body.token || !request.body.amount) {
      return sendApiError(reply, 400, 'INVALID_REQUEST', 'Collateral top-up request is missing required canonical fields');
    }
    if (request.body.token.toUpperCase() !== loan.collateral.token.toUpperCase()) {
      return sendApiError(reply, 400, 'INVALID_REQUEST', `Top-up token must match loan collateral token ${loan.collateral.token}`);
    }
    if (!loan.collateral.vaultAddress || !loan.collateral.depositTxHash) {
      return sendApiError(reply, 409, 'INVALID_TRANSITION', 'Collateral top-up requires existing vaultAddress and depositTxHash');
    }

    const topUpAmount = parsePositiveAmount(request.body.amount, 'Collateral top-up amount', reply);
    if (topUpAmount === null) {
      return reply;
    }

    const topUp = await web3.topUpCollateral({
      loan,
      token: request.body.token,
      amount: topUpAmount,
      txHash: request.body.txHash
    });

    const updatedCollateralAmount = normalizeDecimalString(Number(loan.collateral.amount) + Number(topUpAmount));
    const nextLoan: Loan = {
      ...loan,
      status: loan.status === 'MarginCall' ? 'Active' : loan.status,
      collateral: {
        ...loan.collateral,
        amount: updatedCollateralAmount
      },
      currentMetrics: {
        ...loan.currentMetrics,
        currentLtvBps: request.body.resultingLtvBps ?? loan.currentMetrics.currentLtvBps
      }
    };

    store.replaceLoan(nextLoan);
    store.appendEvent(baseEvent('CollateralToppedUp', nextLoan.loanId, topUp.txHash, {
      eventType: 'CollateralToppedUp',
      loanId: nextLoan.loanId,
      vaultAddress: nextLoan.collateral.vaultAddress,
      token: request.body.token,
      amount: topUpAmount,
      totalCollateralAmount: updatedCollateralAmount,
      previousStatus: loan.status,
      status: nextLoan.status
    }));

    return nextLoan;
  });

  app.post('/loans/:loanId/activate', async (request: FastifyRequest<{ Params: LoanParams; Body: ActivateBody }>, reply) => {
    const loan = findLoan(store, request.params.loanId, reply, hasJsonObjectBody(request.body) ? request.body.loanSnapshot : undefined);
    if (!loan) return reply;
    if (!canTransition(loan.status, 'Active')) {
      return invalidTransition(reply, loan.status, 'Active');
    }
    if (!loan.collateral.depositTxHash || !loan.collateral.vaultAddress) {
      return sendApiError(reply, 409, 'INVALID_TRANSITION', 'Loan activation requires recorded collateral depositTxHash and vaultAddress');
    }

    let activation;
    try {
      activation = await web3.activateLoan({ loan, receiptTokenId: request.body?.receiptTokenId });
    } catch (error) {
      if (error instanceof Web3UnavailableError) {
        return sendApiError(reply, 503, error.code, error.message);
      }
      return sendApiError(reply, 502, 'WEB3_ACTION_FAILED', error instanceof Error ? error.message : 'Web3 activation failed');
    }

    const activationTxHash = request.body?.activationTxHash ?? activation.txHash;
    const activationEvidence = buildLoanEvidenceMetadata(web3.evidenceSource ?? 'demo-simulated', {
      txHash: activationTxHash,
      blockNumber: activation.blockNumber,
      vaultAddress: activation.vaultAddress
    });

    const nextLoan: Loan = {
      ...loan,
      status: 'Active',
      receipt: {
        receiptTokenId: activation.receiptTokenId,
        soulbound: true,
        ownerWallet: activation.ownerWallet
      }
    };
    store.replaceLoan(nextLoan);
    store.appendEvent(baseEvent('LoanActivated', nextLoan.loanId, activationTxHash, {
      eventType: 'LoanActivated',
      loanId: nextLoan.loanId,
      vaultAddress: activation.vaultAddress,
      receiptTokenId: activation.receiptTokenId,
      status: 'Active',
      evidence: activationEvidence
    }));
    store.appendEvent(baseEvent('ReceiptIssued', nextLoan.loanId, null, {
      eventType: 'ReceiptIssued',
      loanId: nextLoan.loanId,
      receiptTokenId: activation.receiptTokenId,
      owner: activation.ownerWallet,
      soulbound: true
    }));
    return {
      ...nextLoan,
      txHash: activationTxHash,
      blockNumber: activation.blockNumber,
      activationTxHash,
      activationBlockNumber: activation.blockNumber,
      activationEvidence
    };
  });

  app.post('/loans/:loanId/margin-call', async (request: FastifyRequest<{ Params: LoanParams; Body: MarginCallBody }>, reply) => {
    if (!hasJsonObjectBody(request.body)) {
      return sendInvalidRequestBody(reply);
    }
    const loan = findLoan(store, request.params.loanId, reply, request.body.loanSnapshot);
    if (!loan) return reply;
    if (typeof request.body.currentLtvBps !== 'number' || !request.body.reason) {
      return sendApiError(reply, 400, 'INVALID_REQUEST', 'Margin call request is missing required canonical fields');
    }
    if (!canTransition(loan.status, 'MarginCall')) {
      return invalidTransition(reply, loan.status, 'MarginCall');
    }
    if (request.body.currentLtvBps < loan.terms.marginCallLtvBps) {
      return sendApiError(reply, 409, 'INVALID_TRANSITION', 'Current LTV is below the margin-call threshold');
    }

    const nextLoan: Loan = {
      ...loan,
      status: 'MarginCall',
      currentMetrics: {
        ...loan.currentMetrics,
        currentLtvBps: request.body.currentLtvBps
      }
    };
    store.replaceLoan(nextLoan);
    store.appendEvent(baseEvent('MarginCall', nextLoan.loanId, null, {
      eventType: 'MarginCall',
      loanId: nextLoan.loanId,
      currentLtvBps: request.body.currentLtvBps,
      marginCallLtvBps: nextLoan.terms.marginCallLtvBps,
      liquidationLtvBps: nextLoan.terms.liquidationLtvBps,
      requiredTopUpAmount: request.body.requiredTopUpAmount ?? '0',
      requiredTopUpCurrency: request.body.requiredTopUpCurrency ?? 'USDC',
      reason: request.body.reason,
      status: 'MarginCall'
    }));
    return nextLoan;
  });

  app.post('/loans/:loanId/liquidate', async (request: FastifyRequest<{ Params: LoanParams; Body: LiquidationBody }>, reply) => {
    if (!hasJsonObjectBody(request.body)) {
      return sendInvalidRequestBody(reply);
    }
    const loan = findLoan(store, request.params.loanId, reply, request.body.loanSnapshot);
    if (!loan) return reply;
    if (!request.body.reason || !request.body.proceedsAmount || !request.body.proceedsCurrency) {
      return sendApiError(reply, 400, 'INVALID_REQUEST', 'Liquidation request is missing required canonical fields');
    }
    if (request.body.proceedsCurrency !== 'USDC') {
      return sendApiError(reply, 400, 'INVALID_REQUEST', 'Liquidation proceedsCurrency must be USDC');
    }
    if (loan.status !== 'MarginCall' && loan.status !== 'Defaulted') {
      return invalidTransition(reply, loan.status, 'Liquidated');
    }

    const distribution = request.body.distribution ?? loan.liquidationPreview.distribution;
    try {
      const liquidation = await web3.liquidateLoan({
        loan,
        reason: request.body.reason,
        proceedsAmount: request.body.proceedsAmount,
        proceedsCurrency: 'USDC',
        distribution,
        liquidationTxHash: request.body.liquidationTxHash
      });
      const nextLoan: Loan = { ...loan, status: 'Liquidated' };
      const evidence = buildLoanEvidenceMetadata(web3.evidenceSource ?? 'demo-simulated', {
        txHash: liquidation.txHash,
        blockNumber: liquidation.blockNumber,
        vaultAddress: loan.collateral.vaultAddress,
        token: {
          symbol: liquidation.proceedsCurrency,
          address: liquidation.tokenAddress ?? loan.collateral.tokenAddress,
          decimals: liquidation.decimals ?? (liquidation.proceedsCurrency === 'USDC' ? 6 : 18),
          amountBaseUnits: liquidation.proceedsAmount
        }
      });
      store.replaceLoan(nextLoan);
      store.appendEvent(baseEvent('Liquidated', nextLoan.loanId, liquidation.txHash, {
        eventType: 'Liquidated',
        loanId: nextLoan.loanId,
        reason: request.body.reason,
        liquidationTxHash: liquidation.txHash,
        proceedsAmount: liquidation.proceedsAmount,
        proceedsCurrency: 'USDC',
        distribution: liquidation.distribution,
        trigger: {
          fromStatus: loan.status,
          outcome: 'LIQUIDATED'
        },
        status: 'Liquidated',
        evidence
      }));
      return {
        loanId: nextLoan.loanId,
        status: 'Liquidated',
        liquidationTxHash: liquidation.txHash,
        blockNumber: liquidation.blockNumber,
        proceedsAmount: liquidation.proceedsAmount,
        proceedsCurrency: 'USDC',
        distribution: liquidation.distribution,
        canLiquidate: liquidation.canLiquidate ?? { allowed: true, reason: '' },
        onChainEvidence: liquidation.onChainEvidence ?? [],
        trigger: {
          fromStatus: loan.status,
          outcome: 'LIQUIDATED'
        },
        evidence
      };
    } catch (error) {
      if (error instanceof Web3UnavailableError) {
        if (error.code === 'WEB3_LIQUIDATION_NOT_ALLOWED') {
          return reply.status(422).send({ error: { code: error.code, message: error.message }, canLiquidate: (error.metadata?.canLiquidate as { allowed: boolean; reason: string } | undefined) ?? { allowed: false, reason: error.message }, onChainEvidence: (error.metadata?.onChainEvidence as unknown[]) ?? [] });
        }
        if (error.code === 'WEB3_GAS_INSUFFICIENT') {
          return reply.status(503).send({ error: { code: error.code, message: error.message }, signer: error.metadata?.role ?? null });
        }
        return sendApiError(reply, 503, error.code, error.message);
      }
      return sendApiError(reply, 502, 'WEB3_ACTION_FAILED', error instanceof Error ? error.message : 'Web3 liquidation failed');
    }
  });
}

function normalizeHexAddress(value: string): string;
function normalizeHexAddress(value: string | null | undefined): string | null | undefined;
function normalizeHexAddress(value: string | null | undefined): string | null | undefined {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value) ? value.toLowerCase() : value;
}

function normalizeRequiredWallet<T extends { walletAddress: string }>(entity: T): T {
  return { ...entity, walletAddress: normalizeHexAddress(entity.walletAddress) };
}

function normalizeOptionalWallet<T extends { walletAddress?: string | null }>(entity: T): T {
  return { ...entity, walletAddress: normalizeHexAddress(entity.walletAddress) };
}

function normalizeCollateralAddresses(collateral: Collateral): Collateral {
  return {
    ...collateral,
    tokenAddress: normalizeHexAddress(collateral.tokenAddress),
    vaultAddress: normalizeHexAddress(collateral.vaultAddress)
  };
}

function parsePositiveAmount(value: string, label: string, reply: FastifyReply): string | null {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
    sendApiError(reply, 400, 'INVALID_REQUEST', `${label} must be a positive decimal string`);
    return null;
  }

  return normalizeDecimalString(value);
}

function parseLoanFilter(query: ListLoansQuery, reply: FastifyReply): { scenario?: LoanScenario; status?: LoanStatus } | null {
  if (query.scenario !== undefined && !isLoanScenario(query.scenario)) {
    return invalidFilter(reply, 'scenario', query.scenario, loanScenarioValues);
  }

  if (query.status !== undefined && !isLoanStatus(query.status)) {
    return invalidFilter(reply, 'status', query.status, loanStatusValues);
  }

  return {
    scenario: query.scenario,
    status: query.status
  };
}

function invalidFilter(reply: FastifyReply, name: string, value: string, allowed: readonly string[]): null {
  sendApiError(
    reply,
    400,
    'INVALID_FILTER',
    `Invalid ${name} filter '${value}'. Allowed values: ${allowed.join(', ')}`
  );
  return null;
}

function findLoan(store: DemoStore, loanId: string, reply: FastifyReply, snapshot?: unknown): Loan | null {
  const loan = store.getLoan(loanId);
  if (loan) return loan;

  if (isLoanSnapshotFor(snapshot, loanId)) {
    return store.createLoan(snapshot);
  }

  sendApiError(reply, 404, 'LOAN_NOT_FOUND', `Loan ${loanId} was not found`);
  return null;
}

function invalidTransition(reply: FastifyReply, from: LoanStatus, to: string): FastifyReply {
  return sendApiError(reply, 409, 'INVALID_TRANSITION', `Cannot transition loan from ${from} to ${to}`);
}

function baseEvent(
  eventType: OnChainEvent['eventType'],
  loanId: string,
  txHash: string | null,
  payload: Record<string, unknown>
): Omit<OnChainEvent, 'eventId' | 'occurredAt'> {
  return { eventType, loanId, txHash, blockNumber: null, payload };
}

function appendLoanCreated(store: DemoStore, loan: Loan): void {
  store.appendEvent(baseEvent('LoanCreated', loan.loanId, null, {
    eventType: 'LoanCreated',
    loanId: loan.loanId,
    borrowerWallet: loan.borrower.walletAddress,
    originatorId: loan.originator.originatorId,
    scenario: loan.scenario,
    principalAmount: loan.principal.amount,
    principalCurrency: loan.principal.currency,
    collateralToken: loan.collateral.token,
    initialLtvBps: loan.terms.initialLtvBps,
    status: 'Requested'
  }));
}

function isLoanSnapshotFor(value: unknown, loanId: string): value is Loan {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<Loan>;
  return candidate.loanId === loanId &&
    isLoanScenario(candidate.scenario) &&
    isLoanStatus(candidate.status) &&
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

function buildLiquidationPreview(principalAmount: string): Loan['liquidationPreview'] {
  return {
    proceedsAmount: principalAmount,
    proceedsCurrency: 'USDC',
    distribution: {
      fundingPartnerAmount: principalAmount,
      originatorFeeAmount: '0',
      borrowerRemainderAmount: '0'
    }
  };
}
