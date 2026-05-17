// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../contracts/LoanRegistry.sol";
import "../contracts/CollateralVault.sol";
import "../contracts/mocks/MockERC20.sol";

contract CollateralVaultTest {
    LoanRegistry loanRegistry;
    CollateralVault vault;
    MockERC20 token;

    address borrower = address(this);
    address originator = address(this);

    function setUp() public {
        loanRegistry = new LoanRegistry();
        vault = new CollateralVault(address(loanRegistry));
        token = new MockERC20("Mock USDC", "mUSDC", 18, 1_000_000e18);
        token.transfer(borrower, 1000e18);
        token.transfer(originator, 1000e18);
    }

    function testDepositCollateral() public {
        uint256 dueDate = block.timestamp + 365 days;
        uint256 loanId = loanRegistry.createLoan(
            borrower,
            originator,
            address(token),
            0,
            50e18,
            5000,
            dueDate
        );

        token.approve(address(vault), 100e18);
        vault.depositCollateral(loanId, 100e18);

        (uint256 storedLoanId, address collateralToken, uint256 amount, address storedBorrower, bool locked, bool liquidated) = vault.vaults(loanId);
        assert(storedLoanId == loanId);
        assert(collateralToken == address(token));
        assert(amount == 100e18);
        assert(storedBorrower == borrower);
        assert(locked == true);
        assert(liquidated == false);

        uint8 status = loanRegistry.getLoanStatus(loanId);
        assert(status == uint8(ILoanRegistry.LoanStatus.Active));
    }

    function testTopUpCollateralWhenLoanIsActive() public {
        uint256 dueDate = block.timestamp + 365 days;
        uint256 loanId = loanRegistry.createLoan(
            borrower,
            originator,
            address(token),
            0,
            50e18,
            5000,
            dueDate
        );

        token.approve(address(vault), 150e18);
        vault.depositCollateral(loanId, 100e18);
        vault.depositCollateral(loanId, 50e18);

        (,, uint256 amount,,, bool liquidated) = vault.vaults(loanId);
        assert(amount == 150e18);
        assert(liquidated == false);

        ILoanRegistry.Loan memory loan = loanRegistry.getLoan(loanId);
        assert(loan.collateralAmount == 150e18);
        assert(loan.status == uint8(ILoanRegistry.LoanStatus.Active));
    }

    function testTopUpCollateralWhenLoanIsMarginCallRecoversToActive() public {
        uint256 dueDate = block.timestamp + 365 days;
        uint256 loanId = loanRegistry.createLoan(
            borrower,
            originator,
            address(token),
            0,
            50e18,
            5000,
            dueDate
        );

        token.approve(address(vault), 150e18);
        vault.depositCollateral(loanId, 100e18);
        loanRegistry.setLoanStatus(loanId, uint8(ILoanRegistry.LoanStatus.MarginCall));

        vault.depositCollateral(loanId, 50e18);

        (,, uint256 amount,,, bool liquidated) = vault.vaults(loanId);
        assert(amount == 150e18);
        assert(liquidated == false);

        ILoanRegistry.Loan memory loan = loanRegistry.getLoan(loanId);
        assert(loan.collateralAmount == 150e18);
        assert(loan.status == uint8(ILoanRegistry.LoanStatus.Active));
    }

    function testReleaseCollateralAfterRepaid() public {
        uint256 dueDate = block.timestamp + 365 days;
        uint256 loanId = loanRegistry.createLoan(
            borrower,
            originator,
            address(token),
            0,
            50e18,
            5000,
            dueDate
        );

        token.approve(address(vault), 100e18);
        vault.depositCollateral(loanId, 100e18);

        loanRegistry.setLoanStatus(loanId, uint8(ILoanRegistry.LoanStatus.Repaid));

        uint256 balanceBefore = token.balanceOf(borrower);
        vault.releaseCollateral(loanId);
        uint256 balanceAfter = token.balanceOf(borrower);

        assert(balanceAfter == balanceBefore + 100e18);
    }

    function testReleaseCollateralAfterRepaidReturnsSixDecimalUsdcToBorrower() public {
        LoanRegistry registry = new LoanRegistry();
        CollateralVault usdcVault = new CollateralVault(address(registry));
        MockERC20 usdc6 = new MockERC20("USDC", "USDC", 6, 0);
        uint256 collateralAmount = 15_000_000;
        uint256 loanId = registry.createLoan(
            borrower,
            originator,
            address(usdc6),
            0,
            10_000_000,
            6667,
            block.timestamp + 365 days
        );

        usdc6.mint(borrower, collateralAmount);
        usdc6.approve(address(usdcVault), collateralAmount);
        usdcVault.depositCollateral(loanId, collateralAmount);

        registry.setLoanStatus(loanId, uint8(ILoanRegistry.LoanStatus.Repaid));

        uint256 balanceBefore = usdc6.balanceOf(borrower);
        usdcVault.releaseCollateral(loanId);
        uint256 balanceAfter = usdc6.balanceOf(borrower);
        CollateralVault.Vault memory releasedVault = usdcVault.getVault(loanId);

        assert(balanceAfter == balanceBefore + collateralAmount);
        assert(releasedVault.amount == 0);
        assert(releasedVault.locked == false);
        assert(releasedVault.liquidated == false);
    }

    function testRejectsDirectLiquidationWhenCallerIsNotEngine() public {
        uint256 dueDate = block.timestamp + 365 days;
        uint256 loanId = loanRegistry.createLoan(
            borrower,
            originator,
            address(token),
            0,
            50e18,
            5000,
            dueDate
        );

        token.approve(address(vault), 100e18);
        vault.depositCollateral(loanId, 100e18);

        (bool ok,) = address(vault).call(abi.encodeWithSelector(vault.liquidateCollateral.selector, loanId));
        assert(ok == false);
    }

    function testLiquidateCollateral() public {
        uint256 dueDate = block.timestamp + 365 days;
        uint256 loanId = loanRegistry.createLoan(
            borrower,
            originator,
            address(token),
            0,
            50e18,
            5000,
            dueDate
        );

        token.approve(address(vault), 100e18);
        vault.depositCollateral(loanId, 100e18);
        vault.setLiquidationEngine(address(this));

        uint256 balanceBefore = token.balanceOf(originator);
        vault.liquidateCollateral(loanId);
        uint256 balanceAfter = token.balanceOf(originator);

        assert(balanceAfter == balanceBefore + 100e18);
        uint8 status = loanRegistry.getLoanStatus(loanId);
        assert(status == uint8(ILoanRegistry.LoanStatus.Liquidated));
    }

    function testCalculateLtv() public {
        uint256 dueDate = block.timestamp + 365 days;
        uint256 loanId = loanRegistry.createLoan(
            borrower,
            originator,
            address(token),
            0,
            50e18,
            5000,
            dueDate
        );

        token.approve(address(vault), 100e18);
        vault.depositCollateral(loanId, 100e18);

        uint256 ltv = vault.calculateLtv(loanId, 1e18, 18);
        assert(ltv == 5000);
    }
}
