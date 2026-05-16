// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./LoanRegistry.sol";

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

contract CollateralVault {
    LoanRegistry public loanRegistry;

    struct Vault {
        uint256 loanId;
        address collateralToken;
        uint256 amount;
        address borrower;
        bool locked;
        bool liquidated;
    }

    mapping(uint256 => Vault) public vaults;

    event CollateralDeposited(uint256 indexed loanId, address indexed borrower, uint256 amount);
    event CollateralReleased(uint256 indexed loanId, uint256 amount);
    event CollateralLiquidated(uint256 indexed loanId, uint256 amount);

    constructor(address loanRegistryAddress) {
        require(loanRegistryAddress != address(0), "Invalid registry address");
        loanRegistry = LoanRegistry(loanRegistryAddress);
    }

    function depositCollateral(uint256 loanId, uint256 amount) external {
        require(amount > 0, "Amount must be > 0");

        ILoanRegistry.Loan memory loan = loanRegistry.getLoan(loanId);
        require(loan.loanId != 0, "Loan not found");
        require(msg.sender == loan.borrower, "Only borrower can deposit");
        require(loan.status == uint8(ILoanRegistry.LoanStatus.Requested) || loan.status == uint8(ILoanRegistry.LoanStatus.Approved), "Loan not depositable");

        Vault storage vault = vaults[loanId];
        require(vault.collateralToken == address(0) || vault.collateralToken == loan.collateralToken, "Collateral token mismatch");

        vault.loanId = loanId;
        vault.collateralToken = loan.collateralToken;
        vault.borrower = loan.borrower;
        vault.amount += amount;
        vault.locked = true;

        require(IERC20(loan.collateralToken).transferFrom(msg.sender, address(this), amount), "Transfer failed");

        loanRegistry.updateCollateralAmount(loanId, loan.collateralAmount + amount);
        loanRegistry.setLoanStatus(loanId, uint8(ILoanRegistry.LoanStatus.Active));

        emit CollateralDeposited(loanId, msg.sender, amount);
    }

    function releaseCollateral(uint256 loanId) external {
        Vault storage vault = vaults[loanId];
        require(vault.loanId != 0, "Vault not found");
        require(!vault.liquidated, "Collateral already liquidated");
        require(vault.amount > 0, "No collateral to release");

        ILoanRegistry.Loan memory loan = loanRegistry.getLoan(loanId);
        require(loan.loanId != 0, "Loan not found");
        require(msg.sender == vault.borrower, "Only borrower can release");
        require(loan.status == uint8(ILoanRegistry.LoanStatus.Repaid) || loan.status == uint8(ILoanRegistry.LoanStatus.Cancelled), "Loan not releasable");

        uint256 amount = vault.amount;
        vault.amount = 0;
        vault.locked = false;

        require(IERC20(vault.collateralToken).transfer(vault.borrower, amount), "Transfer failed");

        emit CollateralReleased(loanId, amount);
    }

    function liquidateCollateral(uint256 loanId) external {
        Vault storage vault = vaults[loanId];
        require(vault.loanId != 0, "Vault not found");
        require(!vault.liquidated, "Collateral already liquidated");
        require(vault.amount > 0, "No collateral to liquidate");

        ILoanRegistry.Loan memory loan = loanRegistry.getLoan(loanId);
        require(loan.loanId != 0, "Loan not found");
        require(msg.sender == loan.originator, "Only originator can liquidate");
        require(loan.status == uint8(ILoanRegistry.LoanStatus.Active) || loan.status == uint8(ILoanRegistry.LoanStatus.MarginCall), "Loan not liquidatable");

        uint256 amount = vault.amount;
        vault.amount = 0;
        vault.locked = false;
        vault.liquidated = true;

        require(IERC20(vault.collateralToken).transfer(loan.originator, amount), "Transfer failed");
        loanRegistry.setLoanStatus(loanId, uint8(ILoanRegistry.LoanStatus.Liquidated));

        emit CollateralLiquidated(loanId, amount);
    }

    function calculateLtv(uint256 loanId, uint256 collateralPrice, uint256 priceDecimals) external view returns (uint256) {
        ILoanRegistry.Loan memory loan = loanRegistry.getLoan(loanId);
        require(loan.loanId != 0, "Loan not found");
        Vault memory vault = vaults[loanId];
        require(vault.amount > 0, "No collateral");
        require(collateralPrice > 0, "Invalid price");

        uint256 collateralValue = (vault.amount * collateralPrice) / (10 ** priceDecimals);
        require(collateralValue > 0, "Collateral value is zero");
        return (loan.loanAmount * 10000) / collateralValue;
    }
}
