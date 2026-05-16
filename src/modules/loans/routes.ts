import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Web3Adapter } from '../../adapters/web3.js';
import { loanScenarioValues, loanStatusValues } from '../../api/schemas.js';
import { hasJsonObjectBody, sendApiError, sendInvalidRequestBody } from '../../api/errors.js';
import { shortHash } from '../../domain/hashing.js';
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
};

type DepositBody = {
  token?: string;
  amount?: string;
  txHash?: string;
  vaultAddress?: string;
};

type ActivateBody = {
  receiptTokenId?: string;
  activationTxHash?: string;
};

type MarginCallBody = {
  currentLtvBps?: number;
  reason?: string;
  requiredTopUpAmount?: string;
  requiredTopUpCurrency?: string;
};

type LiquidationBody = {
  reason?: string;
  liquidationTxHash?: `0x${string}`;
  proceedsAmount?: string;
  proceedsCurrency?: string;
  distribution?: ProceedsDistribution;
};

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

    const loan: Loan = {
      loanId: `loan-${body.scenario.toLowerCase().replaceAll('_', '-')}-${shortHash({ borrower: body.borrower, principal: body.principal, riskAssessmentId: body.riskAssessmentId })}`,
      scenario: body.scenario,
      status: 'Requested',
      borrower: body.borrower,
      originator: body.originator,
      fundingPartner: body.fundingPartner,
      principal: body.principal,
      collateral: body.collateral,
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
    const loan = findLoan(store, request.params.loanId, reply);
    if (!loan) return reply;
    if (!hasJsonObjectBody(request.body)) {
      return sendInvalidRequestBody(reply);
    }
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

  app.post('/loans/:loanId/collateral/deposit', async (request: FastifyRequest<{ Params: LoanParams; Body: DepositBody }>, reply) => {
    const loan = findLoan(store, request.params.loanId, reply);
    if (!loan) return reply;
    if (loan.status !== 'Approved') {
      return invalidTransition(reply, loan.status, 'CollateralDeposited');
    }
    if (!hasJsonObjectBody(request.body)) {
      return sendInvalidRequestBody(reply);
    }
    if (!request.body.token || !request.body.amount || !request.body.txHash || !request.body.vaultAddress) {
      return sendApiError(reply, 400, 'INVALID_REQUEST', 'Collateral deposit request is missing required fields');
    }

    const nextLoan: Loan = {
      ...loan,
      collateral: {
        ...loan.collateral,
        token: request.body.token,
        amount: request.body.amount,
        depositTxHash: request.body.txHash,
        vaultAddress: request.body.vaultAddress
      }
    };
    store.replaceLoan(nextLoan);
    store.appendEvent(baseEvent('CollateralDeposited', nextLoan.loanId, request.body.txHash, {
      eventType: 'CollateralDeposited',
      loanId: nextLoan.loanId,
      vaultAddress: request.body.vaultAddress,
      token: request.body.token,
      amount: request.body.amount,
      txHash: request.body.txHash,
      status: 'Approved'
    }));
    return nextLoan;
  });

  app.post('/loans/:loanId/activate', async (request: FastifyRequest<{ Params: LoanParams; Body: ActivateBody }>, reply) => {
    const loan = findLoan(store, request.params.loanId, reply);
    if (!loan) return reply;
    if (!canTransition(loan.status, 'Active')) {
      return invalidTransition(reply, loan.status, 'Active');
    }
    if (!loan.collateral.depositTxHash || !loan.collateral.vaultAddress) {
      return sendApiError(reply, 409, 'INVALID_TRANSITION', 'Loan activation requires recorded collateral depositTxHash and vaultAddress');
    }

    const activation = await web3.activateLoan({ loan, receiptTokenId: request.body?.receiptTokenId });
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
    store.appendEvent(baseEvent('LoanActivated', nextLoan.loanId, request.body?.activationTxHash ?? activation.txHash, {
      eventType: 'LoanActivated',
      loanId: nextLoan.loanId,
      vaultAddress: activation.vaultAddress,
      receiptTokenId: activation.receiptTokenId,
      status: 'Active'
    }));
    store.appendEvent(baseEvent('ReceiptIssued', nextLoan.loanId, null, {
      eventType: 'ReceiptIssued',
      loanId: nextLoan.loanId,
      receiptTokenId: activation.receiptTokenId,
      owner: activation.ownerWallet,
      soulbound: true
    }));
    return nextLoan;
  });

  app.post('/loans/:loanId/margin-call', async (request: FastifyRequest<{ Params: LoanParams; Body: MarginCallBody }>, reply) => {
    const loan = findLoan(store, request.params.loanId, reply);
    if (!loan) return reply;
    if (!hasJsonObjectBody(request.body)) {
      return sendInvalidRequestBody(reply);
    }
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
    const loan = findLoan(store, request.params.loanId, reply);
    if (!loan) return reply;
    if (!hasJsonObjectBody(request.body)) {
      return sendInvalidRequestBody(reply);
    }
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
      store.replaceLoan(nextLoan);
      store.appendEvent(baseEvent('Liquidated', nextLoan.loanId, liquidation.txHash, {
        eventType: 'Liquidated',
        loanId: nextLoan.loanId,
        liquidationTxHash: liquidation.txHash,
        proceedsAmount: liquidation.proceedsAmount,
        proceedsCurrency: 'USDC',
        distribution: liquidation.distribution,
        status: 'Liquidated'
      }));
      return {
        loanId: nextLoan.loanId,
        status: 'Liquidated',
        liquidationTxHash: liquidation.txHash,
        proceedsAmount: liquidation.proceedsAmount,
        proceedsCurrency: 'USDC',
        distribution: liquidation.distribution
      };
    } catch (error) {
      return sendApiError(reply, 502, 'WEB3_ACTION_FAILED', error instanceof Error ? error.message : 'Web3 liquidation failed');
    }
  });
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

function findLoan(store: DemoStore, loanId: string, reply: FastifyReply): Loan | null {
  const loan = store.getLoan(loanId);
  if (!loan) {
    sendApiError(reply, 404, 'LOAN_NOT_FOUND', `Loan ${loanId} was not found`);
    return null;
  }
  return loan;
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
