// Contract ABIs extracted from build artifacts and the dashboard-driven Fuji lifecycle spec.
// These fragments are the single source of truth for ethers.js interactions in src/adapters/web3.ts.

export const LOAN_REGISTRY_ABI = [
  {
    type: 'constructor',
    inputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'createLoan',
    inputs: [
      { name: 'borrower', type: 'address', internalType: 'address' },
      { name: 'originator', type: 'address', internalType: 'address' },
      { name: 'collateralToken', type: 'address', internalType: 'address' },
      { name: 'collateralAmount', type: 'uint256', internalType: 'uint256' },
      { name: 'loanAmount', type: 'uint256', internalType: 'uint256' },
      { name: 'ltv', type: 'uint256', internalType: 'uint256' },
      { name: 'dueDate', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: 'loanId', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setLoanStatus',
    inputs: [
      { name: 'loanId', type: 'uint256', internalType: 'uint256' },
      { name: 'newStatus', type: 'uint8', internalType: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getLoanStatus',
    inputs: [{ name: 'loanId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'uint8', internalType: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getLoan',
    inputs: [{ name: 'loanId', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct LoanRegistry.Loan',
        components: [
          { name: 'id', type: 'uint256', internalType: 'uint256' },
          { name: 'borrower', type: 'address', internalType: 'address' },
          { name: 'collateralAmount', type: 'uint256', internalType: 'uint256' },
          { name: 'loanAmount', type: 'uint256', internalType: 'uint256' },
          { name: 'originatorFeeAmount', type: 'uint256', internalType: 'uint256' },
          { name: 'fundingPartner', type: 'address', internalType: 'address' },
          { name: 'fundingPartnerAmount', type: 'uint256', internalType: 'uint256' },
          { name: 'status', type: 'uint8', internalType: 'enum LoanRegistry.LoanStatus' },
          { name: 'createdAt', type: 'uint256', internalType: 'uint256' },
          { name: 'updatedAt', type: 'uint256', internalType: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'LoanCreated',
    inputs: [
      { name: 'loanId', type: 'uint256', indexed: true },
      { name: 'borrower', type: 'address', indexed: true },
      { name: 'originator', type: 'address', indexed: true },
      { name: 'collateralToken', type: 'address', indexed: false },
      { name: 'collateralAmount', type: 'uint256', indexed: false },
      { name: 'loanAmount', type: 'uint256', indexed: false },
      { name: 'ltv', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
] as const;

export const COLLATERAL_VAULT_ABI = [
  {
    type: 'function',
    name: 'depositCollateral',
    inputs: [
      { name: 'loanId', type: 'uint256', internalType: 'uint256' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'releaseCollateral',
    inputs: [{ name: 'loanId', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getVault',
    inputs: [{ name: 'loanId', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'borrower', type: 'address' },
          { name: 'collateralToken', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'locked', type: 'bool' },
          { name: 'liquidated', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'CollateralDeposited',
    inputs: [
      { name: 'loanId', type: 'uint256', indexed: true },
      { name: 'borrower', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'CollateralReleased',
    inputs: [
      { name: 'loanId', type: 'uint256', indexed: true },
      { name: 'borrower', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
] as const;

export const ERC20_USDC_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address', internalType: 'address' },
      { name: 'spender', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8', internalType: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
] as const;

export const PAYMENT_ATTESTATION_ABI = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'loanRegistryAddress',
        type: 'address',
        internalType: 'address',
      },
      { name: 'attestorAddress', type: 'address', internalType: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'registerPayment',
    inputs: [
      { name: 'loanId', type: 'uint256', internalType: 'uint256' },
      { name: 'paymentHash', type: 'bytes32', internalType: 'bytes32' },
      { name: 'signature', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getPaymentAttestationCount',
    inputs: [{ name: 'loanId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

export const LIQUIDATION_ENGINE_ABI = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'loanRegistryAddress',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'collateralVaultAddress',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'proceedsTokenAddress',
        type: 'address',
        internalType: 'address',
      },
      { name: 'feeBps', type: 'uint16', internalType: 'uint16' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'liquidateLoan',
    inputs: [
      { name: 'loanId', type: 'uint256', internalType: 'uint256' },
      { name: 'collateralPrice', type: 'uint256', internalType: 'uint256' },
      { name: 'priceDecimals', type: 'uint256', internalType: 'uint256' },
      { name: 'fundingPartner', type: 'address', internalType: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'canLiquidate',
    inputs: [
      { name: 'loanId', type: 'uint256', internalType: 'uint256' },
      { name: 'collateralPrice', type: 'uint256', internalType: 'uint256' },
      { name: 'priceDecimals', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [
      { name: 'allowed', type: 'bool', internalType: 'bool' },
      { name: 'reason', type: 'string', internalType: 'string' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'LoanLiquidated',
    inputs: [
      { name: 'loanId', type: 'uint256', indexed: true },
      { name: 'proceedsAmount', type: 'uint256', indexed: false },
      { name: 'proceedsToken', type: 'address', indexed: true },
      { name: 'fundingPartner', type: 'address', indexed: true },
      { name: 'fundingPartnerAmount', type: 'uint256', indexed: false },
      { name: 'originatorFeeAmount', type: 'uint256', indexed: false },
      { name: 'borrowerRemainderAmount', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
] as const;
