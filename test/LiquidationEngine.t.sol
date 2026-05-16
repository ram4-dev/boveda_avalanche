// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../contracts/LoanRegistry.sol";
import "../contracts/CollateralVault.sol";
import "../contracts/LiquidationEngine.sol";
import "../contracts/mocks/MockERC20.sol";

interface Vm {
    function prank(address actor) external;
    function addr(uint256 privateKey) external returns (address);
}

contract LiquidationEngineTest {
    Vm constant vm = Vm(address(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D));

    LoanRegistry loanRegistry;
    CollateralVault collateralVault;
    LiquidationEngine liquidationEngine;
    MockERC20 collateralToken;
    MockERC20 usdc;

    address borrower = address(0xBEEF);
    address originator = address(0xCAFE);
    address fundingPartner = address(0xFEED);

    function setUp() public {
        loanRegistry = new LoanRegistry();
        collateralVault = new CollateralVault(address(loanRegistry));
        collateralToken = new MockERC20("Collateral", "COL", 18, 0);
        usdc = new MockERC20("USDC", "USDC", 18, 0);
        liquidationEngine = new LiquidationEngine(
            address(loanRegistry),
            address(collateralVault),
            address(usdc),
            1000
        );

        collateralVault.setLiquidationEngine(address(liquidationEngine));
        usdc.mint(address(liquidationEngine), 200e18);
    }

    function testLiquidateLoanDistributesProceeds() public {
        uint256 dueDate = block.timestamp + 365 days;
        uint256 loanId = loanRegistry.createLoan(
            borrower,
            originator,
            address(collateralToken),
            0,
            50e18,
            5000,
            dueDate
        );

        uint256 collateralAmount = 100e18;
        collateralToken.mint(borrower, collateralAmount);

        vm.prank(borrower);
        collateralToken.approve(address(collateralVault), collateralAmount);

        vm.prank(borrower);
        collateralVault.depositCollateral(loanId, collateralAmount);

        assert(loanRegistry.getLoanStatus(loanId) == uint8(ILoanRegistry.LoanStatus.Active));

        uint256 price = 1e18;
        uint256 priceDecimals = 18;

        vm.prank(originator);
        liquidationEngine.liquidateLoan(loanId, price, priceDecimals, fundingPartner);

        assert(loanRegistry.getLoanStatus(loanId) == uint8(ILoanRegistry.LoanStatus.Liquidated));
        CollateralVault.Vault memory vault = collateralVault.getVault(loanId);
        assert(vault.liquidated == true);
        assert(usdc.balanceOf(fundingPartner) == 50e18);
        assert(usdc.balanceOf(originator) == 5e18);
        assert(usdc.balanceOf(borrower) == 45e18);
    }
}
