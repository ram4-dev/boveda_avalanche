// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./LoanRegistry.sol";
import "./CollateralVault.sol";

contract LiquidationEngine {
    LoanRegistry public loanRegistry;
    CollateralVault public collateralVault;
    IERC20 public proceedsToken;
    address public admin;
    uint16 public originatorFeeBps;
    uint16 public adminExpenseBps;
    uint16 public constant CRITICAL_COVERAGE_BUFFER_BPS = 1000; // 10%

    event LoanLiquidated(
        uint256 indexed loanId,
        uint256 proceedsAmount,
        address indexed proceedsToken,
        address indexed fundingPartner,
        uint256 fundingPartnerAmount,
        uint256 originatorFeeAmount,
        uint256 borrowerRemainderAmount
    );

    modifier onlyAdmin() {
        require(msg.sender == admin, "LiquidationEngine: caller is not admin");
        _;
    }

    constructor(
        address loanRegistryAddress,
        address collateralVaultAddress,
        address proceedsTokenAddress,
        uint16 feeBps
    ) {
        require(loanRegistryAddress != address(0), "Invalid registry address");
        require(collateralVaultAddress != address(0), "Invalid collateral vault address");
        require(proceedsTokenAddress != address(0), "Invalid proceeds token address");
        require(feeBps <= 10000, "Invalid fee basis points");

        loanRegistry = LoanRegistry(loanRegistryAddress);
        collateralVault = CollateralVault(collateralVaultAddress);
        proceedsToken = IERC20(proceedsTokenAddress);
        originatorFeeBps = feeBps;
        adminExpenseBps = 0;
        admin = msg.sender;
    }

    function setOriginatorFeeBps(uint16 feeBps) external onlyAdmin {
        require(feeBps <= 10000, "Invalid fee basis points");
        originatorFeeBps = feeBps;
    }

    function setAdminExpenseBps(uint16 feeBps) external onlyAdmin {
        require(feeBps <= 10000, "Invalid fee basis points");
        adminExpenseBps = feeBps;
    }

    function setProceedsToken(address token) external onlyAdmin {
        require(token != address(0), "Invalid token address");
        proceedsToken = IERC20(token);
    }

    function canLiquidate(
        uint256 loanId,
        uint256 collateralPrice,
        uint256 priceDecimals
    ) public view returns (bool allowed, string memory reason) {
        if (collateralPrice == 0) {
            return (false, "LiquidationEngine: invalid collateral price");
        }
        if (priceDecimals > 36) {
            return (false, "LiquidationEngine: invalid price decimals");
        }

        ILoanRegistry.Loan memory loan = loanRegistry.getLoan(loanId);
        if (loan.loanId == 0) {
            return (false, "LiquidationEngine: loan not found");
        }

        uint8 active = uint8(ILoanRegistry.LoanStatus.Active);
        uint8 marginCall = uint8(ILoanRegistry.LoanStatus.MarginCall);
        uint8 defaulted = uint8(ILoanRegistry.LoanStatus.Defaulted);
        if (
            loan.status != active &&
            loan.status != marginCall &&
            loan.status != defaulted
        ) {
            return (false, "LiquidationEngine: loan status not liquidatable");
        }

        CollateralVault.Vault memory vault = collateralVault.getVault(loanId);
        if (vault.loanId == 0) {
            return (false, "LiquidationEngine: vault not found");
        }
        if (vault.amount == 0) {
            return (false, "LiquidationEngine: no collateral to liquidate");
        }
        if (vault.liquidated) {
            return (false, "LiquidationEngine: collateral already liquidated");
        }

        uint256 collateralValue = (vault.amount * collateralPrice) / (10 ** priceDecimals);
        if (collateralValue == 0) {
            return (false, "LiquidationEngine: invalid proceeds amount");
        }

        uint256 repaymentObligation = _repaymentObligation(loan.loanAmount);
        uint256 criticalCoverageThreshold = (repaymentObligation * (10000 + CRITICAL_COVERAGE_BUFFER_BPS)) / 10000;

        if (collateralValue <= criticalCoverageThreshold) {
            return (true, "LiquidationEngine: critical coverage threshold reached");
        }

        return (false, "LiquidationEngine: non-critical coverage, margin call first");
    }

    function liquidateLoan(
        uint256 loanId,
        uint256 collateralPrice,
        uint256 priceDecimals,
        address fundingPartner
    ) external {
        require(fundingPartner != address(0), "Invalid funding partner");

        ILoanRegistry.Loan memory loan = loanRegistry.getLoan(loanId);
        require(loan.loanId != 0, "Loan not found");
        require(
            msg.sender == loan.originator,
            "LiquidationEngine: only originator can initiate liquidation"
        );

        (bool allowed, string memory reason) = canLiquidate(loanId, collateralPrice, priceDecimals);
        require(allowed, reason);

        CollateralVault.Vault memory vault = collateralVault.getVault(loanId);
        uint256 proceedsAmount = (vault.amount * collateralPrice) / (10 ** priceDecimals);

        collateralVault.liquidateCollateral(loanId);

        uint256 fundingPartnerAmount = loan.loanAmount <= proceedsAmount ? loan.loanAmount : proceedsAmount;
        uint256 remaining = proceedsAmount > fundingPartnerAmount ? proceedsAmount - fundingPartnerAmount : 0;
        uint256 originatorFeeAmount = (remaining * originatorFeeBps) / 10000;
        uint256 borrowerRemainderAmount = remaining > originatorFeeAmount ? remaining - originatorFeeAmount : 0;

        if (fundingPartnerAmount > 0) {
            require(
                proceedsToken.transfer(fundingPartner, fundingPartnerAmount),
                "LiquidationEngine: funding transfer failed"
            );
        }

        if (originatorFeeAmount > 0) {
            require(
                proceedsToken.transfer(loan.originator, originatorFeeAmount),
                "LiquidationEngine: originator fee transfer failed"
            );
        }

        if (borrowerRemainderAmount > 0) {
            require(
                proceedsToken.transfer(loan.borrower, borrowerRemainderAmount),
                "LiquidationEngine: borrower remainder transfer failed"
            );
        }

        emit LoanLiquidated(
            loanId,
            proceedsAmount,
            address(proceedsToken),
            fundingPartner,
            fundingPartnerAmount,
            originatorFeeAmount,
            borrowerRemainderAmount
        );
    }

    function _repaymentObligation(uint256 loanAmount) internal view returns (uint256) {
        return loanAmount + ((loanAmount * adminExpenseBps) / 10000);
    }
}
