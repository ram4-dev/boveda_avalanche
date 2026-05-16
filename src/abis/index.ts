// Contract ABIs extracted from build artifacts
// These are used for ethers.js contract interactions

export const LOAN_REGISTRY_ABI = [
  {
    type: 'constructor',
    inputs: [],
    stateMutability: 'nonpayable',
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
] as const;
