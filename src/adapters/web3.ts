import { ethers } from 'ethers';
import { sha256Canonical } from '../domain/hashing.js';
import type { PaymentAttestation } from '../domain/paymentAttestations.js';
import type { Loan, ProceedsDistribution } from '../domain/types.js';
import type { FujiContractsConfig, HexAddress } from '../config/fujiContracts.js';
import {
  COLLATERAL_VAULT_ABI,
  ERC20_USDC_ABI,
  LIQUIDATION_ENGINE_ABI,
  LOAN_REGISTRY_ABI,
  PAYMENT_ATTESTATION_ABI
} from '../abis/index.js';

const DEFAULT_FUJI_RPC_URL = 'https://api.avax-test.network/ext/bc/C/rpc';
const FUJI_EXPLORER_BASE_URL = 'https://testnet.snowtrace.io';
const USDC_DECIMALS = 6;

export type ActivationInput = {
  loan: Loan;
  receiptTokenId?: string;
};

export type ActivationOutcome = {
  ok: true;
  txHash: `0x${string}`;
  blockNumber: number | null;
  receiptTokenId: string;
  ownerWallet: string;
  vaultAddress: string;
};

export type CollateralDepositInput = {
  loan: Loan;
  token: string;
  amount: string;
  txHash: `0x${string}`;
  vaultAddress: string;
};

export type CollateralDepositOutcome = {
  ok: true;
  txHash: `0x${string}`;
  blockNumber: number | null;
  token: string;
  amountBaseUnits: string;
  decimals: number;
  vaultAddress: string;
};

export type CreateLoanInput = {
  loan: Loan;
  loanAmountBaseUnits: string;
  ltvBps: number;
  tenorDays: number;
};

export type CreateLoanOutcome = {
  ok: true;
  onChainLoanId: string;
  txHash: `0x${string}`;
  blockNumber: number | null;
};

export type OriginateCollateralDepositInput = {
  loan: Loan;
  amountBaseUnits: string;
};

export type OriginateCollateralDepositOutcome = {
  ok: true;
  approveTxHash: `0x${string}` | null;
  approveBlockNumber: number | null;
  approveNoop: boolean;
  depositTxHash: `0x${string}`;
  depositBlockNumber: number | null;
  vaultAddress: string;
  token: string;
  amountBaseUnits: string;
  decimals: number;
  onChainEvidence: OnChainEvidenceStep[];
};

export type PaymentRegistrationInput = {
  loan: Loan;
  attestation: PaymentAttestation;
};

export type CollateralTopUpInput = {
  loan: Loan;
  token: string;
  amount: string;
  txHash?: `0x${string}`;
};

export type CollateralTopUpOutcome = {
  ok: true;
  txHash: `0x${string}`;
  blockNumber: number | null;
};

export type CollateralReleaseEvidence = {
  status: 'confirmed' | 'pending' | 'unavailable';
  txHash?: `0x${string}`;
  blockNumber?: number | null;
  token?: string;
  tokenAddress?: string | null;
  amountBaseUnits?: string;
  decimals?: number;
};

export type OnChainEvidenceStepName =
  | 'createLoan'
  | 'approve'
  | 'depositCollateral'
  | 'registerPayment'
  | 'setLoanStatusRepaid'
  | 'setLoanStatusDefaulted'
  | 'releaseCollateral'
  | 'canLiquidate'
  | 'liquidateLoan';

export type OnChainEvidenceStepStatus = 'confirmed' | 'pending' | 'noop' | 'failed';

export type OnChainEvidenceStep = {
  step: OnChainEvidenceStepName;
  txHash: `0x${string}` | null;
  blockNumber: number | null;
  status: OnChainEvidenceStepStatus;
  explorerUrl?: string | null;
  note?: string;
};

export type PaymentRegistrationOutcome = {
  ok: true;
  txHash: `0x${string}`;
  blockNumber: number | null;
  attestationHash: `0x${string}`;
  releaseEvidence?: CollateralReleaseEvidence;
  onChainEvidence?: OnChainEvidenceStep[];
};

export type LiquidationInput = {
  loan: Loan;
  reason: string;
  proceedsAmount: string;
  proceedsCurrency: 'USDC';
  distribution: ProceedsDistribution;
  liquidationTxHash?: `0x${string}`;
};

export type LiquidationOutcome = {
  ok: true;
  txHash: `0x${string}`;
  blockNumber: number | null;
  proceedsAmount: string;
  proceedsCurrency: 'USDC';
  distribution: ProceedsDistribution;
  tokenAddress?: string | null;
  decimals?: number;
  canLiquidate?: { allowed: boolean; reason: string };
  onChainEvidence?: OnChainEvidenceStep[];
};

export type Web3RefreshOutcome = {
  refreshedEvents: number;
};

export type Web3EvidenceSource = 'demo-simulated' | 'fuji-live' | 'fuji-unavailable';

export type Web3ErrorCode =
  | 'WEB3_UNAVAILABLE'
  | 'WEB3_LIQUIDATION_NOT_ALLOWED'
  | 'WEB3_GAS_INSUFFICIENT'
  | 'WEB3_ACTION_FAILED'
  | 'WEB3_PREREQUISITES_MISSING';

export class Web3UnavailableError extends Error {
  readonly code: Web3ErrorCode;
  readonly metadata?: Record<string, unknown>;

  constructor(reason: string, code: Web3ErrorCode = 'WEB3_UNAVAILABLE', metadata?: Record<string, unknown>) {
    super(code === 'WEB3_UNAVAILABLE' ? `Fuji web3 adapter is unavailable: ${reason}` : reason);
    this.code = code;
    this.metadata = metadata;
    this.name = 'Web3UnavailableError';
  }
}

export function createUnavailableWeb3Adapter(reason: string): Web3Adapter {
  const unavailable = async (): Promise<never> => {
    throw new Web3UnavailableError(reason);
  };

  return {
    evidenceSource: 'fuji-unavailable',
    verifyCollateralDeposit: unavailable,
    activateLoan: unavailable,
    topUpCollateral: unavailable,
    registerPaymentAttestation: unavailable,
    liquidateLoan: unavailable,
    async refreshPendingEvents() {
      return { refreshedEvents: 0 };
    }
  };
}

export type ReleaseVaultOutcome = { ok: boolean; noop: boolean; txHash: `0x${string}` | null; blockNumber: number | null };

export interface Web3Adapter {
  evidenceSource?: Web3EvidenceSource;
  verifyCollateralDeposit?(input: CollateralDepositInput): Promise<CollateralDepositOutcome>;
  activateLoan(input: ActivationInput): Promise<ActivationOutcome>;
  topUpCollateral(input: CollateralTopUpInput): Promise<CollateralTopUpOutcome>;
  registerPaymentAttestation(input: PaymentRegistrationInput): Promise<PaymentRegistrationOutcome>;
  liquidateLoan(input: LiquidationInput): Promise<LiquidationOutcome>;
  createLoanOnChain?(input: CreateLoanInput): Promise<CreateLoanOutcome>;
  originateCollateralDeposit?(input: OriginateCollateralDepositInput): Promise<OriginateCollateralDepositOutcome>;
  releaseVaultForReset?(loan: Loan): Promise<ReleaseVaultOutcome>;
  refreshPendingEvents?(): Promise<Web3RefreshOutcome>;
}

export type FujiSignerConfig = {
  attestorPrivateKey?: string;
  borrowerPrivateKey?: string;
  originatorPrivateKey?: string;
  fundingPartnerAddress?: HexAddress;
};

export type SetLoanStatusInput = {
  loan: Loan;
  targetStatus: 'Repaid' | 'Defaulted';
};

export type SetLoanStatusOutcome = {
  ok: true;
  txHash: `0x${string}` | null;
  blockNumber: number | null;
  noop: boolean;
};

export type CanLiquidateInput = {
  loan: Loan;
  proceedsAmount: string;
};

export type CanLiquidateOutcome = {
  allowed: boolean;
  reason: string;
};

export type SignerRole = 'attestor' | 'borrower' | 'originator';

export type FujiWeb3Client = {
  verifyCollateralDeposit(input: CollateralDepositInput): Promise<CollateralDepositOutcome>;
  activateLoan(input: ActivationInput): Promise<ActivationOutcome>;
  topUpCollateral(input: CollateralTopUpInput): Promise<CollateralTopUpOutcome>;
  registerPayment(input: PaymentRegistrationInput): Promise<Omit<PaymentRegistrationOutcome, 'releaseEvidence' | 'onChainEvidence'>>;
  releaseCollateral(input: PaymentRegistrationInput): Promise<CollateralReleaseEvidence>;
  liquidateLoan(input: LiquidationInput): Promise<LiquidationOutcome>;
  setLoanStatus?(input: SetLoanStatusInput): Promise<SetLoanStatusOutcome>;
  canLiquidate?(input: CanLiquidateInput): Promise<CanLiquidateOutcome>;
  ensureGas?(role: SignerRole): Promise<void>;
  createLoanOnChain?(input: CreateLoanInput): Promise<CreateLoanOutcome>;
  originateCollateralDeposit?(input: OriginateCollateralDepositInput): Promise<OriginateCollateralDepositOutcome>;
  refreshPendingEvents?(): Promise<Web3RefreshOutcome>;
};

export type FujiWeb3AdapterOptions = {
  runtimeContracts: FujiContractsConfig;
  rpcUrl: string;
  signerConfig: FujiSignerConfig;
  client?: FujiWeb3Client;
};

export type FujiPrerequisiteCheck =
  | { ok: true; signerConfig: Required<FujiSignerConfig> }
  | { ok: false; missing: Array<keyof FujiSignerConfig> };

export function checkFujiSignerPrerequisites(input: FujiSignerConfig): FujiPrerequisiteCheck {
  const missing: Array<keyof FujiSignerConfig> = [];
  if (!input.attestorPrivateKey) missing.push('attestorPrivateKey');
  if (!input.borrowerPrivateKey) missing.push('borrowerPrivateKey');
  if (!input.originatorPrivateKey) missing.push('originatorPrivateKey');
  if (!input.fundingPartnerAddress) missing.push('fundingPartnerAddress');

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  return { ok: true, signerConfig: input as Required<FujiSignerConfig> };
}

const SIGNER_ENV_NAME: Record<keyof FujiSignerConfig, string> = {
  attestorPrivateKey: 'BOVEDA_FUJI_ATTESTOR_PRIVATE_KEY',
  borrowerPrivateKey: 'BOVEDA_FUJI_BORROWER_PRIVATE_KEY',
  originatorPrivateKey: 'BOVEDA_FUJI_ORIGINATOR_PRIVATE_KEY',
  fundingPartnerAddress: 'BOVEDA_FUJI_FUNDING_PARTNER_ADDRESS'
};

export function createFujiWeb3Adapter(options: FujiWeb3AdapterOptions): Web3Adapter {
  const prerequisiteCheck = checkFujiSignerPrerequisites(options.signerConfig);
  if (!prerequisiteCheck.ok) {
    const missingNames = prerequisiteCheck.missing.map((key) => SIGNER_ENV_NAME[key]);
    return createUnavailableWeb3Adapter(`missing Fuji signing prerequisites: ${missingNames.join(', ')}`);
  }

  const client = options.client ?? createEthersFujiWeb3Client({
    runtimeContracts: options.runtimeContracts,
    rpcUrl: options.rpcUrl,
    signerConfig: prerequisiteCheck.signerConfig
  });

  const explorer = options.runtimeContracts.explorerBaseUrl ?? FUJI_EXPLORER_BASE_URL;
  const explorerUrl = (hash: `0x${string}` | null): string | null => hash ? buildFujiExplorerTxUrl(hash, explorer) : null;

  return {
    evidenceSource: 'fuji-live',
    verifyCollateralDeposit: (input) => client.verifyCollateralDeposit(input),
    activateLoan: (input) => client.activateLoan(input),
    topUpCollateral: (input) => client.topUpCollateral(input),
    async registerPaymentAttestation(input) {
      await client.ensureGas?.('attestor');
      const payment = await client.registerPayment(input);
      const onChainEvidence: OnChainEvidenceStep[] = [{
        step: 'registerPayment',
        txHash: payment.txHash,
        blockNumber: payment.blockNumber,
        status: 'confirmed',
        explorerUrl: explorerUrl(payment.txHash)
      }];
      if (input.attestation.status !== 'Repaid') {
        return { ...payment, onChainEvidence };
      }
      await client.ensureGas?.('originator');
      const statusResult = client.setLoanStatus
        ? await client.setLoanStatus({ loan: input.loan, targetStatus: 'Repaid' })
        : ({ ok: true, txHash: null, blockNumber: null, noop: true } as SetLoanStatusOutcome);
      onChainEvidence.push({
        step: 'setLoanStatusRepaid',
        txHash: statusResult.txHash,
        blockNumber: statusResult.blockNumber,
        status: statusResult.noop ? 'noop' : 'confirmed',
        explorerUrl: explorerUrl(statusResult.txHash),
        note: statusResult.noop ? 'loan already Repaid on-chain' : undefined
      });
      await client.ensureGas?.('borrower');
      const releaseEvidence = await client.releaseCollateral(input);
      onChainEvidence.push({
        step: 'releaseCollateral',
        txHash: releaseEvidence.txHash ?? null,
        blockNumber: releaseEvidence.blockNumber ?? null,
        status: releaseEvidence.status === 'confirmed' ? 'confirmed' : (releaseEvidence.status === 'pending' ? 'pending' : 'failed'),
        explorerUrl: explorerUrl(releaseEvidence.txHash ?? null)
      });
      return { ...payment, releaseEvidence, onChainEvidence };
    },
    async liquidateLoan(input) {
      const onChainEvidence: OnChainEvidenceStep[] = [];
      await client.ensureGas?.('originator');
      const statusResult = client.setLoanStatus
        ? await client.setLoanStatus({ loan: input.loan, targetStatus: 'Defaulted' })
        : ({ ok: true, txHash: null, blockNumber: null, noop: true } as SetLoanStatusOutcome);
      onChainEvidence.push({
        step: 'setLoanStatusDefaulted',
        txHash: statusResult.txHash,
        blockNumber: statusResult.blockNumber,
        status: statusResult.noop ? 'noop' : 'confirmed',
        explorerUrl: explorerUrl(statusResult.txHash),
        note: statusResult.noop ? 'loan already Defaulted or Liquidated on-chain' : undefined
      });
      const canLiquidate: CanLiquidateOutcome = client.canLiquidate
        ? await client.canLiquidate({ loan: input.loan, proceedsAmount: input.proceedsAmount })
        : { allowed: true, reason: 'demo-bypass' };
      onChainEvidence.push({
        step: 'canLiquidate',
        txHash: null,
        blockNumber: null,
        status: canLiquidate.allowed ? 'confirmed' : 'failed',
        note: canLiquidate.reason
      });
      if (!canLiquidate.allowed) {
        throw new Web3UnavailableError(canLiquidate.reason || 'Liquidation not allowed by LiquidationEngine', 'WEB3_LIQUIDATION_NOT_ALLOWED', { canLiquidate, onChainEvidence });
      }
      const outcome = await client.liquidateLoan(input);
      onChainEvidence.push({
        step: 'liquidateLoan',
        txHash: outcome.txHash,
        blockNumber: outcome.blockNumber,
        status: 'confirmed',
        explorerUrl: explorerUrl(outcome.txHash)
      });
      return { ...outcome, canLiquidate, onChainEvidence };
    },
    async createLoanOnChain(input) {
      if (!client.createLoanOnChain) throw new Web3UnavailableError('Fuji client does not expose createLoanOnChain', 'WEB3_UNAVAILABLE');
      await client.ensureGas?.('originator');
      return client.createLoanOnChain(input);
    },
    async originateCollateralDeposit(input) {
      if (!client.originateCollateralDeposit) throw new Web3UnavailableError('Fuji client does not expose originateCollateralDeposit', 'WEB3_UNAVAILABLE');
      await client.ensureGas?.('borrower');
      return client.originateCollateralDeposit(input);
    },
    refreshPendingEvents: () => client.refreshPendingEvents?.() ?? Promise.resolve({ refreshedEvents: 0 })
  };
}

function createEthersFujiWeb3Client(input: {
  runtimeContracts: FujiContractsConfig;
  rpcUrl: string;
  signerConfig: Required<FujiSignerConfig>;
}): FujiWeb3Client {
  const provider = new ethers.JsonRpcProvider(input.rpcUrl || DEFAULT_FUJI_RPC_URL);
  const attestor = new ethers.Wallet(input.signerConfig.attestorPrivateKey, provider);
  const borrower = new ethers.Wallet(input.signerConfig.borrowerPrivateKey, provider);
  const originator = new ethers.Wallet(input.signerConfig.originatorPrivateKey, provider);
  const contracts = input.runtimeContracts.contracts;
  const paymentAttestation = new ethers.Contract(contracts.PaymentAttestation.address, PAYMENT_ATTESTATION_ABI, attestor) as ethers.Contract & Record<string, (...args: unknown[]) => Promise<unknown>>;
  const liquidationEngine = new ethers.Contract(contracts.LiquidationEngine.address, LIQUIDATION_ENGINE_ABI, originator) as ethers.Contract & Record<string, (...args: unknown[]) => Promise<unknown>>;
  const collateralVault = new ethers.Contract(contracts.CollateralVault.address, COLLATERAL_VAULT_ABI, borrower) as ethers.Contract & Record<string, (...args: unknown[]) => Promise<unknown>>;
  const loanRegistry = new ethers.Contract(contracts.LoanRegistry.address, LOAN_REGISTRY_ABI, originator) as ethers.Contract & Record<string, (...args: unknown[]) => Promise<unknown>>;

  const FUJI_USDC_ADDRESS = '0x5425890298aed601595a70AB815c96711a31Bc65';
  const usdcAddress = FUJI_USDC_ADDRESS;
  const usdcAsBorrower = new ethers.Contract(usdcAddress, ERC20_USDC_ABI, borrower) as ethers.Contract & Record<string, (...args: unknown[]) => Promise<unknown>>;

  return {
    async createLoanOnChain({ loan, loanAmountBaseUnits, ltvBps, tenorDays }) {
      const dueDate = BigInt(Math.floor(Date.now() / 1000) + Math.max(tenorDays, 1) * 24 * 60 * 60);
      const tokenAddress = loan.collateral.tokenAddress ?? usdcAddress;
      const tx = await loanRegistry.createLoan(
        loan.borrower.walletAddress,
        loan.originator.walletAddress ?? originator.address,
        tokenAddress,
        0n,
        BigInt(loanAmountBaseUnits),
        BigInt(ltvBps),
        dueDate
      ) as EthersTxResponse;
      const receipt = await tx.wait();
      const iface = new ethers.Interface(LOAN_REGISTRY_ABI);
      let parsedLoanId: bigint | null = null;
      for (const log of receipt?.logs ?? []) {
        try {
          const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
          if (parsed?.name === 'LoanCreated') {
            parsedLoanId = parsed.args[0] as bigint;
            break;
          }
        } catch { /* not a registry event */ }
      }
      if (parsedLoanId === null) {
        throw new Web3UnavailableError('LoanCreated event log was not found in createLoan receipt', 'WEB3_ACTION_FAILED', { txHash: tx.hash });
      }
      return {
        ok: true,
        onChainLoanId: parsedLoanId.toString(),
        txHash: tx.hash as `0x${string}`,
        blockNumber: receipt?.blockNumber ?? null
      };
    },
    async originateCollateralDeposit({ loan, amountBaseUnits }) {
      const numericLoanId = onChainIdFor(loan);
      const need = BigInt(amountBaseUnits);
      const vaultState = await collateralVault.getVault(numericLoanId).catch(() => null) as { amount?: bigint; locked?: boolean; liquidated?: boolean } | null;
      const evidence: OnChainEvidenceStep[] = [];
      let approveTxHash: `0x${string}` | null = null;
      let approveBlockNumber: number | null = null;
      let approveNoop = false;
      let depositTxHash: `0x${string}` | null = null;
      let depositBlockNumber: number | null = null;
      if (vaultState && vaultState.locked === true && (vaultState.amount ?? 0n) >= need && vaultState.liquidated === false) {
        approveNoop = true;
        evidence.push({ step: 'approve', txHash: null, blockNumber: null, status: 'noop', note: 'vault already locked with sufficient collateral' });
        evidence.push({ step: 'depositCollateral', txHash: null, blockNumber: null, status: 'noop', note: `vault.amount=${(vaultState.amount ?? 0n).toString()} locked=true` });
        return {
          ok: true,
          approveTxHash: null,
          approveBlockNumber: null,
          approveNoop,
          depositTxHash: ('0x' + '0'.repeat(64)) as `0x${string}`,
          depositBlockNumber: null,
          vaultAddress: contracts.CollateralVault.address,
          token: loan.collateral.token,
          amountBaseUnits: (vaultState.amount ?? need).toString(),
          decimals: USDC_DECIMALS,
          onChainEvidence: evidence
        };
      }
      const allowance = await usdcAsBorrower.allowance(borrower.address, contracts.CollateralVault.address) as bigint;
      if (allowance < need) {
        const approveTx = await usdcAsBorrower.approve(contracts.CollateralVault.address, need) as EthersTxResponse;
        const approveReceipt = await approveTx.wait();
        approveTxHash = approveTx.hash as `0x${string}`;
        approveBlockNumber = approveReceipt?.blockNumber ?? null;
        evidence.push({ step: 'approve', txHash: approveTxHash, blockNumber: approveBlockNumber, status: 'confirmed', explorerUrl: buildFujiExplorerTxUrl(approveTxHash, FUJI_EXPLORER_BASE_URL) });
      } else {
        approveNoop = true;
        evidence.push({ step: 'approve', txHash: null, blockNumber: null, status: 'noop', note: `allowance already at ${allowance.toString()}` });
      }
      const depositTx = await collateralVault.depositCollateral(numericLoanId, need) as EthersTxResponse;
      const depositReceipt = await depositTx.wait();
      depositTxHash = depositTx.hash as `0x${string}`;
      depositBlockNumber = depositReceipt?.blockNumber ?? null;
      evidence.push({ step: 'depositCollateral', txHash: depositTxHash, blockNumber: depositBlockNumber, status: 'confirmed', explorerUrl: buildFujiExplorerTxUrl(depositTxHash, FUJI_EXPLORER_BASE_URL) });
      return {
        ok: true,
        approveTxHash,
        approveBlockNumber,
        approveNoop,
        depositTxHash,
        depositBlockNumber,
        vaultAddress: contracts.CollateralVault.address,
        token: loan.collateral.token,
        amountBaseUnits: need.toString(),
        decimals: USDC_DECIMALS,
        onChainEvidence: evidence
      };
    },
    async verifyCollateralDeposit(deposit) {
      const expectedToken = deposit.loan.collateral.tokenAddress;
      if (!expectedToken) {
        throw new Error('Cannot verify Fuji deposit without expected collateral token address');
      }
      const receipt = await provider.getTransactionReceipt(deposit.txHash);
      if (!receipt || receipt.status !== 1) {
        throw new Error('Fuji collateral deposit transaction is not confirmed');
      }
      if (receipt.to && !sameAddress(receipt.to, contracts.CollateralVault.address)) {
        throw new Error('Fuji collateral deposit transaction did not target CollateralVault');
      }
      if (receipt.from && !sameAddress(receipt.from, deposit.loan.borrower.walletAddress)) {
        throw new Error('Fuji collateral deposit sender does not match borrower');
      }

      const expectedAmount = BigInt(deposit.amount);
      const numericLoanId = onChainIdFor(deposit.loan);
      const vaultEvent = findCollateralDepositedEvent(receipt.logs, {
        loanId: numericLoanId,
        borrower: deposit.loan.borrower.walletAddress,
        minimumAmount: expectedAmount
      });
      if (!vaultEvent) {
        throw new Error('Fuji collateral deposit event was not found or did not match loan evidence');
      }
      const transferEvent = findErc20TransferEvent(receipt.logs, {
        tokenAddress: expectedToken,
        from: deposit.loan.borrower.walletAddress,
        to: contracts.CollateralVault.address,
        minimumAmount: expectedAmount
      });
      if (!transferEvent) {
        throw new Error('Fuji USDC transfer evidence was not found or did not match the vault deposit');
      }

      const vaultState = await collateralVault.getVault(numericLoanId) as { borrower?: string; collateralToken?: string; amount?: bigint; locked?: boolean; liquidated?: boolean };
      if (!vaultState.borrower || !sameAddress(vaultState.borrower, deposit.loan.borrower.walletAddress)) {
        throw new Error('Fuji vault borrower does not match expected borrower');
      }
      if (!vaultState.collateralToken || !sameAddress(vaultState.collateralToken, expectedToken)) {
        throw new Error('Fuji vault collateral token does not match expected token');
      }
      if ((vaultState.amount ?? 0n) < expectedAmount || vaultState.locked !== true || vaultState.liquidated !== false) {
        throw new Error('Fuji vault state does not confirm locked collateral');
      }
      const decimals = await readTokenDecimals(provider, expectedToken);
      return {
        ok: true,
        txHash: deposit.txHash,
        blockNumber: receipt.blockNumber,
        token: deposit.token.toUpperCase(),
        amountBaseUnits: vaultState.amount?.toString() ?? vaultEvent.amount.toString(),
        decimals,
        vaultAddress: contracts.CollateralVault.address
      };
    },
    async activateLoan(input) {
      const registryLoan = await loanRegistry.getLoan?.(onChainIdFor(input.loan)).catch(() => null) as { borrower?: string } | null;
      return {
        ok: true,
        txHash: sha256Canonical({ operation: 'activateLoan', loanId: input.loan.loanId, source: 'fuji-live' }),
        blockNumber: null,
        receiptTokenId: input.receiptTokenId ?? deriveReceiptTokenId(input.loan.loanId),
        ownerWallet: registryLoan?.borrower ?? input.loan.borrower.walletAddress,
        vaultAddress: contracts.CollateralVault.address
      };
    },
    async topUpCollateral(topUp) {
      return {
        ok: true,
        txHash: topUp.txHash ?? sha256Canonical({ operation: 'topUpCollateral', source: 'fuji-live', loanId: topUp.loan.loanId, token: topUp.token, amount: topUp.amount }),
        blockNumber: topUp.txHash ? await lookupReceiptBlock(provider, topUp.txHash) : null
      };
    },
    async registerPayment(payment) {
      const onChainId = onChainIdFor(payment.loan);
      // paymentHash = keccak256(canonical JSON of the attestation payload)
      const paymentHash = ethers.id(JSON.stringify(payment.attestation)) as `0x${string}`;
      // The contract verifies:
      //   message = keccak256(abi.encodePacked(address(this), loanId, paymentHash))
      //   signer  = ecrecover(keccak256("\x19Ethereum Signed Message:\n32" + message), v, r, s)
      // Build the same message on the backend before signing.
      const inner = ethers.solidityPackedKeccak256(
        ['address', 'uint256', 'bytes32'],
        [contracts.PaymentAttestation.address, onChainId, paymentHash]
      );
      // signMessage prepends the Ethereum prefix matching _prefixed() in the contract.
      const signature = await attestor.signMessage(ethers.getBytes(inner));
      const tx = await paymentAttestation.registerPayment(onChainId, paymentHash, signature) as EthersTxResponse;
      const receipt = await tx.wait();
      return {
        ok: true,
        txHash: tx.hash as `0x${string}`,
        blockNumber: receipt?.blockNumber ?? null,
        attestationHash: paymentHash
      };
    },
    async releaseCollateral(payment) {
      const tx = await collateralVault.releaseCollateral(onChainIdFor(payment.loan)) as EthersTxResponse;
      const receipt = await tx.wait();
      return {
        status: 'confirmed',
        txHash: tx.hash as `0x${string}`,
        blockNumber: receipt?.blockNumber ?? null,
        token: payment.loan.collateral.token,
        tokenAddress: payment.loan.collateral.tokenAddress,
        amountBaseUnits: payment.loan.collateral.amountBaseUnits ?? payment.loan.collateral.amount,
        decimals: payment.loan.collateral.tokenDecimals ?? await readTokenDecimals(provider, payment.loan.collateral.tokenAddress)
      };
    },
    async setLoanStatus({ loan, targetStatus }) {
      const onChainLoanId = onChainIdFor(loan);
      const targetCode = targetStatus === 'Repaid' ? 4 : 5;
      const liquidatedCode = 6;
      const currentRaw = await loanRegistry.getLoanStatus?.(onChainLoanId).catch(() => null) as bigint | number | null;
      const current = currentRaw === null ? null : Number(currentRaw);
      if (current === targetCode) return { ok: true, txHash: null, blockNumber: null, noop: true };
      if (targetStatus === 'Defaulted' && current === liquidatedCode) return { ok: true, txHash: null, blockNumber: null, noop: true };
      const tx = await loanRegistry.setLoanStatus(onChainLoanId, targetCode) as EthersTxResponse;
      const receipt = await tx.wait();
      return { ok: true, txHash: tx.hash as `0x${string}`, blockNumber: receipt?.blockNumber ?? null, noop: false };
    },
    async canLiquidate({ loan, proceedsAmount }) {
      const result = await liquidationEngine.canLiquidate(onChainIdFor(loan), BigInt(proceedsAmount), USDC_DECIMALS) as { allowed: boolean; reason: string } | [boolean, string];
      if (Array.isArray(result)) return { allowed: result[0], reason: result[1] };
      return { allowed: result.allowed, reason: result.reason };
    },
    async ensureGas(role) {
      const wallet = role === 'attestor' ? attestor : role === 'borrower' ? borrower : originator;
      const min = readGasMinWei(role);
      const balance = await provider.getBalance(wallet.address);
      if (balance < min) {
        throw new Web3UnavailableError(`signer ${role} (${wallet.address}) AVAX balance is below ${min.toString()} wei`, 'WEB3_GAS_INSUFFICIENT', { role, address: wallet.address, balance: balance.toString(), min: min.toString() });
      }
    },
    async liquidateLoan(liquidation) {
      const canLiquidate = await liquidationEngine.canLiquidate(onChainIdFor(liquidation.loan), BigInt(liquidation.proceedsAmount), USDC_DECIMALS) as { allowed: boolean; reason: string };
      if (!canLiquidate.allowed) {
        throw new Web3UnavailableError(canLiquidate.reason || 'Liquidation not allowed', 'WEB3_LIQUIDATION_NOT_ALLOWED', { canLiquidate });
      }
      const liquidationOnChainId = onChainIdFor(liquidation.loan);
      const tx = await liquidationEngine.liquidateLoan(
        liquidationOnChainId,
        BigInt(liquidation.proceedsAmount),
        USDC_DECIMALS,
        input.signerConfig.fundingPartnerAddress
      ) as EthersTxResponse;
      const receipt = await tx.wait();
      const liquidated = parseLoanLiquidatedEvent(receipt, liquidationOnChainId);
      if (!liquidated) {
        throw new Error('Fuji liquidation event was not found in transaction receipt');
      }
      return {
        ok: true,
        txHash: tx.hash as `0x${string}`,
        blockNumber: receipt?.blockNumber ?? null,
        proceedsAmount: liquidated.proceedsAmount,
        proceedsCurrency: 'USDC',
        distribution: liquidated.distribution,
        tokenAddress: liquidated.proceedsToken,
        decimals: liquidation.loan.collateral.tokenDecimals ?? USDC_DECIMALS
      };
    },
    async refreshPendingEvents() {
      return { refreshedEvents: 0 };
    }
  };
}

type EthersLog = {
  address: string;
  topics: readonly string[];
  data: string;
};

type EthersReceipt = {
  blockNumber?: number | null;
  status?: number | null;
  to?: string | null;
  from?: string | null;
  logs?: readonly EthersLog[];
};

type EthersTxResponse = {
  hash: string;
  wait(): Promise<EthersReceipt | null>;
};

async function lookupReceiptBlock(provider: ethers.JsonRpcProvider, txHash: `0x${string}`): Promise<number | null> {
  const receipt = await provider.getTransactionReceipt(txHash);
  return receipt?.blockNumber ?? null;
}

async function readTokenDecimals(provider: ethers.JsonRpcProvider, tokenAddress?: string | null): Promise<number> {
  if (!tokenAddress) {
    return USDC_DECIMALS;
  }
  const token = new ethers.Contract(tokenAddress, ERC20_USDC_ABI, provider) as ethers.Contract & { decimals?: () => Promise<number | bigint> };
  const decimals = await token.decimals?.();
  return typeof decimals === 'bigint' ? Number(decimals) : decimals ?? USDC_DECIMALS;
}

function findCollateralDepositedEvent(
  logs: readonly EthersLog[] | undefined,
  expected: { loanId: bigint; borrower: string; minimumAmount: bigint }
): { amount: bigint } | null {
  const iface = new ethers.Interface(COLLATERAL_VAULT_ABI);
  for (const log of logs ?? []) {
    try {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name !== 'CollateralDeposited') continue;
      const [loanId, borrower, amount] = parsed.args as unknown as [bigint, string, bigint];
      if (loanId === expected.loanId && sameAddress(borrower, expected.borrower) && amount >= expected.minimumAmount) {
        return { amount };
      }
    } catch {
      // Not a CollateralVault event.
    }
  }
  return null;
}

function findErc20TransferEvent(
  logs: readonly EthersLog[] | undefined,
  expected: { tokenAddress: string; from: string; to: string; minimumAmount: bigint }
): { amount: bigint } | null {
  const iface = new ethers.Interface(ERC20_USDC_ABI);
  for (const log of logs ?? []) {
    if (!sameAddress(log.address, expected.tokenAddress)) continue;
    try {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name !== 'Transfer') continue;
      const [from, to, amount] = parsed.args as unknown as [string, string, bigint];
      if (sameAddress(from, expected.from) && sameAddress(to, expected.to) && amount >= expected.minimumAmount) {
        return { amount };
      }
    } catch {
      // Not an ERC-20 Transfer event.
    }
  }
  return null;
}

function parseLoanLiquidatedEvent(receipt: EthersReceipt | null, loanId: bigint): { proceedsAmount: string; proceedsToken: string; distribution: ProceedsDistribution } | null {
  const iface = new ethers.Interface(LIQUIDATION_ENGINE_ABI);
  for (const log of receipt?.logs ?? []) {
    try {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name !== 'LoanLiquidated') continue;
      const [eventLoanId, proceedsAmount, proceedsToken, _fundingPartner, fundingPartnerAmount, originatorFeeAmount, borrowerRemainderAmount] = parsed.args as unknown as [bigint, bigint, string, string, bigint, bigint, bigint];
      if (eventLoanId !== loanId) continue;
      return {
        proceedsAmount: proceedsAmount.toString(),
        proceedsToken,
        distribution: {
          fundingPartnerAmount: fundingPartnerAmount.toString(),
          originatorFeeAmount: originatorFeeAmount.toString(),
          borrowerRemainderAmount: borrowerRemainderAmount.toString()
        }
      };
    } catch {
      // Not a LiquidationEngine event.
    }
  }
  return null;
}

function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function toNumericLoanId(loanId: string): string {
  const direct = /^\d+$/.test(loanId) ? loanId : loanId.match(/(\d+)$/)?.[1];
  return direct ?? '0';
}

function onChainIdFor(loan: Loan): bigint {
  if (loan.onChainLoanId && /^\d+$/.test(loan.onChainLoanId)) return BigInt(loan.onChainLoanId);
  return BigInt(toNumericLoanId(loan.loanId));
}

const DEFAULT_GAS_MIN_WEI: Record<SignerRole, bigint> = {
  originator: 50_000_000_000_000_000n,
  borrower: 20_000_000_000_000_000n,
  attestor: 10_000_000_000_000_000n
};

function readGasMinWei(role: SignerRole): bigint {
  const envName = role === 'originator' ? 'BOVEDA_FUJI_GAS_MIN_ORIGINATOR_WEI'
    : role === 'borrower' ? 'BOVEDA_FUJI_GAS_MIN_BORROWER_WEI'
    : 'BOVEDA_FUJI_GAS_MIN_ATTESTOR_WEI';
  const raw = process.env[envName];
  if (!raw) return DEFAULT_GAS_MIN_WEI[role];
  try { return BigInt(raw); } catch { return DEFAULT_GAS_MIN_WEI[role]; }
}

function deriveReceiptTokenId(loanId: string): string {
  return String(parseInt(sha256Canonical({ loanId }).slice(2, 10), 16));
}

// Backward-compatible ethers adapter entrypoint. New runtime code should prefer createFujiWeb3Adapter.
export function createEthersWeb3Adapter(): Web3Adapter {
  return createUnavailableWeb3Adapter('legacy ethers adapter requires explicit runtime Fuji signer configuration');
}

// Mock adapter for testing and /demo mode.
export function createMockWeb3Adapter(): Web3Adapter {
  return {
    evidenceSource: 'demo-simulated',
    async verifyCollateralDeposit(input) {
      const tokenSymbol = input.token.toUpperCase();
      return {
        ok: true,
        txHash: input.txHash,
        blockNumber: null,
        token: tokenSymbol,
        amountBaseUnits: input.amount,
        decimals: tokenSymbol === 'USDC' ? USDC_DECIMALS : 18,
        vaultAddress: input.vaultAddress
      };
    },
    async activateLoan(input) {
      return {
        ok: true,
        txHash: sha256Canonical({ operation: 'activateLoan', loanId: input.loan.loanId, receiptTokenId: input.receiptTokenId ?? null }),
        blockNumber: null,
        receiptTokenId: input.receiptTokenId ?? deriveReceiptTokenId(input.loan.loanId),
        ownerWallet: input.loan.borrower.walletAddress,
        vaultAddress: input.loan.collateral.vaultAddress ?? ''
      };
    },
    async topUpCollateral(input) {
      return {
        ok: true,
        txHash: input.txHash ?? sha256Canonical({ operation: 'topUpCollateral', loanId: input.loan.loanId, token: input.token, amount: input.amount }),
        blockNumber: null
      };
    },
    async registerPaymentAttestation(input) {
      return {
        ok: true,
        txHash: sha256Canonical({ operation: 'registerPaymentAttestation', loanId: input.loan.loanId, attestationHash: input.attestation.attestationHash }),
        blockNumber: null,
        attestationHash: input.attestation.attestationHash,
        releaseEvidence: input.attestation.status === 'Repaid'
          ? {
            status: 'pending',
            token: input.loan.collateral.token,
            tokenAddress: input.loan.collateral.tokenAddress,
            amountBaseUnits: input.loan.collateral.amountBaseUnits ?? input.loan.collateral.amount,
            decimals: input.loan.collateral.tokenDecimals ?? (input.loan.collateral.token.toUpperCase() === 'USDC' ? USDC_DECIMALS : 18)
          }
          : undefined,
        onChainEvidence: []
      };
    },
    async liquidateLoan(input) {
      return {
        ok: true,
        txHash: input.liquidationTxHash ?? sha256Canonical({ operation: 'liquidateLoan', loanId: input.loan.loanId, reason: input.reason, proceedsAmount: input.proceedsAmount }),
        blockNumber: null,
        proceedsAmount: input.proceedsAmount,
        proceedsCurrency: 'USDC',
        distribution: input.distribution,
        tokenAddress: input.loan.collateral.tokenAddress,
        decimals: input.loan.collateral.tokenDecimals ?? USDC_DECIMALS,
        canLiquidate: { allowed: true, reason: 'demo-simulated' },
        onChainEvidence: []
      };
    },
    async releaseVaultForReset(_loan) {
      return { ok: true, noop: true, txHash: null, blockNumber: null };
    },
    async createLoanOnChain({ loan }) {
      const onChainLoanId = String(parseInt(sha256Canonical({ operation: 'createLoanOnChain', loanId: loan.loanId }).slice(2, 10), 16));
      return {
        ok: true,
        onChainLoanId,
        txHash: sha256Canonical({ operation: 'createLoanOnChain.tx', loanId: loan.loanId }),
        blockNumber: null
      };
    },
    async originateCollateralDeposit({ loan, amountBaseUnits }) {
      const depositTxHash = sha256Canonical({ operation: 'originateCollateralDeposit', loanId: loan.loanId, amount: amountBaseUnits });
      return {
        ok: true,
        approveTxHash: null,
        approveBlockNumber: null,
        approveNoop: true,
        depositTxHash,
        depositBlockNumber: null,
        vaultAddress: loan.collateral.vaultAddress ?? '',
        token: loan.collateral.token,
        amountBaseUnits,
        decimals: USDC_DECIMALS,
        onChainEvidence: []
      };
    },
    async refreshPendingEvents() {
      return { refreshedEvents: 0 };
    }
  };
}

// Factory function to create the appropriate adapter.
export function createWeb3Adapter(useMock = false): Web3Adapter {
  if (useMock) {
    return createMockWeb3Adapter();
  }
  return createEthersWeb3Adapter();
}

export function buildFujiExplorerTxUrl(txHash: `0x${string}`, explorerBaseUrl = FUJI_EXPLORER_BASE_URL): string {
  return `${explorerBaseUrl.replace(/\/$/, '')}/tx/${txHash}`;
}
