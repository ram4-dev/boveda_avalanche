// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./LoanRegistry.sol";

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

contract CollateralVault {
    LoanRegistry public loanRegistry;
    address public admin;
    address public liquidationEngine;

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
    event CollateralToppedUp(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 newTotalAmount);
    event CollateralReleased(uint256 indexed loanId, uint256 amount);
    event CollateralLiquidated(uint256 indexed loanId, uint256 amount);
    event LiquidationEngineSet(address indexed oldEngine, address indexed newEngine);

    modifier onlyAdmin() {
        require(msg.sender == admin, "CollateralVault: caller is not admin");
        _;
    }

    constructor(address loanRegistryAddress) {
        require(loanRegistryAddress != address(0), "Invalid registry address");
        loanRegistry = LoanRegistry(loanRegistryAddress);
        admin = msg.sender;
    }

    function setLiquidationEngine(address engine) external onlyAdmin {
        require(engine != address(0), "Invalid liquidation engine");
        emit LiquidationEngineSet(liquidationEngine, engine);
        liquidationEngine = engine;
    }

    function depositCollateral(uint256 loanId, uint256 amount) external {
        require(amount > 0, "Amount must be > 0");

        ILoanRegistry.Loan memory loan = loanRegistry.getLoan(loanId);
        require(loan.loanId != 0, "Loan not found");
        require(msg.sender == loan.borrower, "Only borrower can deposit");

        bool isInitialDeposit = loan.status == uint8(ILoanRegistry.LoanStatus.Requested) ||
            loan.status == uint8(ILoanRegistry.LoanStatus.Approved);
        bool isTopUp = loan.status == uint8(ILoanRegistry.LoanStatus.Active) ||
            loan.status == uint8(ILoanRegistry.LoanStatus.MarginCall);
        require(isInitialDeposit || isTopUp, "Loan not depositable");

        Vault storage vault = vaults[loanId];
        require(vault.collateralToken == address(0) || vault.collateralToken == loan.collateralToken, "Collateral token mismatch");
        require(!vault.liquidated, "Collateral already liquidated");
        if (isTopUp) {
            require(vault.loanId != 0, "Vault not found");
            require(vault.locked, "Vault not locked");
        }

        vault.loanId = loanId;
        vault.collateralToken = loan.collateralToken;
        vault.borrower = loan.borrower;
        vault.amount += amount;
        vault.locked = true;

        require(IERC20(loan.collateralToken).transferFrom(msg.sender, address(this), amount), "Transfer failed");

        uint256 newCollateralAmount = loan.collateralAmount + amount;
        loanRegistry.updateCollateralAmount(loanId, newCollateralAmount);
        if (isInitialDeposit || loan.status == uint8(ILoanRegistry.LoanStatus.MarginCall)) {
            loanRegistry.setLoanStatus(loanId, uint8(ILoanRegistry.LoanStatus.Active));
        }

        if (isTopUp) {
            emit CollateralToppedUp(loanId, msg.sender, amount, newCollateralAmount);
        } else {
            emit CollateralDeposited(loanId, msg.sender, amount);
        }
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

    function getVault(uint256 loanId) external view returns (Vault memory) {
        return vaults[loanId];
    }

    function liquidateCollateral(uint256 loanId) external {
        Vault storage vault = vaults[loanId];
        require(vault.loanId != 0, "Vault not found");
        require(!vault.liquidated, "Collateral already liquidated");
        require(vault.amount > 0, "No collateral to liquidate");

        ILoanRegistry.Loan memory loan = loanRegistry.getLoan(loanId);
        require(loan.loanId != 0, "Loan not found");
        require(msg.sender == liquidationEngine, "Only liquidation engine can liquidate");
        require(
            loan.status == uint8(ILoanRegistry.LoanStatus.Active) ||
            loan.status == uint8(ILoanRegistry.LoanStatus.MarginCall) ||
            loan.status == uint8(ILoanRegistry.LoanStatus.Defaulted),
            "Loan not liquidatable"
        );

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
