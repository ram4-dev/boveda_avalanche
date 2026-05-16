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
        admin = msg.sender;
    }

    function setOriginatorFeeBps(uint16 feeBps) external onlyAdmin {
        require(feeBps <= 10000, "Invalid fee basis points");
        originatorFeeBps = feeBps;
    }

    function setProceedsToken(address token) external onlyAdmin {
        require(token != address(0), "Invalid token address");
        proceedsToken = IERC20(token);
    }

    function liquidateLoan(
        uint256 loanId,
        uint256 collateralPrice,
        uint256 priceDecimals,
        address fundingPartner
    ) external {
        require(fundingPartner != address(0), "Invalid funding partner");
        require(collateralPrice > 0, "Invalid collateral price");
        require(priceDecimals <= 36, "Invalid price decimals");

        ILoanRegistry.Loan memory loan = loanRegistry.getLoan(loanId);
        require(loan.loanId != 0, "Loan not found");
        require(
            msg.sender == loan.originator,
            "LiquidationEngine: only originator can initiate liquidation"
        );
        require(
            loan.status == uint8(ILoanRegistry.LoanStatus.Active) ||
            loan.status == uint8(ILoanRegistry.LoanStatus.MarginCall) ||
            loan.status == uint8(ILoanRegistry.LoanStatus.Defaulted),
            "Loan not liquidatable"
        );

        CollateralVault.Vault memory vault = collateralVault.getVault(loanId);
        require(vault.loanId != 0, "Vault not found");
        require(vault.amount > 0, "No collateral to liquidate");
        require(!vault.liquidated, "Collateral already liquidated");

        uint256 proceedsAmount = (vault.amount * collateralPrice) / (10 ** priceDecimals);
        require(proceedsAmount > 0, "Invalid proceeds amount");

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
}
