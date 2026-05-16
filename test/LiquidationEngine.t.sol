// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../contracts/LoanRegistry.sol";
import "../contracts/CollateralVault.sol";
import "../contracts/LiquidationEngine.sol";
import "../contracts/ChainlinkPriceOracle.sol";
import "../contracts/mocks/MockERC20.sol";
import "../contracts/mocks/MockV3Aggregator.sol";

interface Vm {
    function prank(address actor) external;
    function expectRevert(bytes calldata reason) external;
    function warp(uint256 newTimestamp) external;
}

contract LiquidationEngineTest {
    Vm constant vm = Vm(address(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D));

    LoanRegistry loanRegistry;
    CollateralVault collateralVault;
    LiquidationEngine liquidationEngine;
    MockERC20 collateralToken;
    MockERC20 usdc;
    ChainlinkPriceOracle priceOracle;
    MockV3Aggregator collateralFeed;

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
        priceOracle = new ChainlinkPriceOracle(1 hours);
        collateralFeed = new MockV3Aggregator(18, 1e18);
        priceOracle.setFeed(address(collateralToken), address(collateralFeed));

        collateralVault.setLiquidationEngine(address(liquidationEngine));
        usdc.mint(address(liquidationEngine), 200e18);
    }

    function testRejectsNonCriticalLiquidationForActiveLoan() public {
        uint256 loanId = _createActiveLoanWithCollateral(100e18, 50e18);

        // Collateral value = 100; repayment obligation = 50; critical threshold = 55.
        (bool allowed, string memory reason) = liquidationEngine.canLiquidate(loanId, 1e18, 18);
        assert(allowed == false);
        assertEq(reason, "LiquidationEngine: non-critical coverage, margin call first");

        vm.prank(originator);
        vm.expectRevert(bytes("LiquidationEngine: non-critical coverage, margin call first"));
        liquidationEngine.liquidateLoan(loanId, 1e18, 18, fundingPartner);
    }

    function testCanLiquidateRejectsInvalidStatusAndPrice() public {
        uint256 loanId = _createActiveLoanWithCollateral(100e18, 50e18);

        loanRegistry.setLoanStatus(loanId, uint8(ILoanRegistry.LoanStatus.Repaid));
        (bool repaidAllowed, string memory repaidReason) = liquidationEngine.canLiquidate(loanId, 1e18, 18);
        assert(repaidAllowed == false);
        assertEq(repaidReason, "LiquidationEngine: loan status not liquidatable");

        (bool priceAllowed, string memory priceReason) = liquidationEngine.canLiquidate(loanId, 0, 18);
        assert(priceAllowed == false);
        assertEq(priceReason, "LiquidationEngine: invalid collateral price");
    }

    function testOracleBackedGuardIgnoresCallerSuppliedCriticalPrice() public {
        uint256 loanId = _createActiveLoanWithCollateral(100e18, 50e18);
        liquidationEngine.setPriceOracle(address(priceOracle));
        collateralFeed.setRoundData(2, 1e18, block.timestamp, 2);

        (bool allowed, string memory reason) = liquidationEngine.canLiquidateFromOracle(loanId);
        assert(allowed == false);
        assertEq(reason, "LiquidationEngine: non-critical coverage, margin call first");

        vm.prank(originator);
        vm.expectRevert(bytes("LiquidationEngine: non-critical coverage, margin call first"));
        liquidationEngine.liquidateLoan(loanId, 0.5e18, 18, fundingPartner);
    }

    function testRejectsNonContractPriceOracle() public {
        vm.expectRevert(bytes("LiquidationEngine: oracle must be contract"));
        liquidationEngine.setPriceOracle(originator);
    }

    function testOracleBackedPreflightReturnsStalePriceReason() public {
        uint256 loanId = _createActiveLoanWithCollateral(100e18, 50e18);
        liquidationEngine.setPriceOracle(address(priceOracle));
        vm.warp(block.timestamp + 10 hours);
        collateralFeed.setRoundData(3, 1e18, block.timestamp - 2 hours, 3);

        (bool allowed, string memory reason) = liquidationEngine.canLiquidateFromOracle(loanId);
        assert(allowed == false);
        assertEq(reason, "ChainlinkPriceOracle: stale price");
    }

    function testOracleBackedGuardAllowsCriticalFeedPrice() public {
        uint256 loanId = _createActiveLoanWithCollateral(100e18, 50e18);
        liquidationEngine.setPriceOracle(address(priceOracle));
        collateralFeed.setRoundData(2, 0.5e18, block.timestamp, 2);

        (bool allowed, string memory reason) = liquidationEngine.canLiquidateFromOracle(loanId);
        assert(allowed == true);
        assertEq(reason, "LiquidationEngine: critical coverage threshold reached");

        vm.prank(originator);
        liquidationEngine.liquidateLoan(loanId, 999e18, 18, fundingPartner);

        assert(loanRegistry.getLoanStatus(loanId) == uint8(ILoanRegistry.LoanStatus.Liquidated));
    }

    function testLiquidatesDefaultedLoanWhenCriticalCoverage() public {
        uint256 loanId = _createActiveLoanWithCollateral(100e18, 50e18);
        loanRegistry.setLoanStatus(loanId, uint8(ILoanRegistry.LoanStatus.Defaulted));

        (bool allowed, string memory reason) = liquidationEngine.canLiquidate(loanId, 0.5e18, 18);
        assert(allowed == true);
        assertEq(reason, "LiquidationEngine: critical coverage threshold reached");

        vm.prank(originator);
        liquidationEngine.liquidateLoan(loanId, 0.5e18, 18, fundingPartner);

        assert(loanRegistry.getLoanStatus(loanId) == uint8(ILoanRegistry.LoanStatus.Liquidated));
    }

    function testAdminExpenseBpsCanMakeCoverageCritical() public {
        uint256 loanId = _createActiveLoanWithCollateral(100e18, 50e18);

        (bool beforeAllowed, string memory beforeReason) = liquidationEngine.canLiquidate(loanId, 0.56e18, 18);
        assert(beforeAllowed == false);
        assertEq(beforeReason, "LiquidationEngine: non-critical coverage, margin call first");

        liquidationEngine.setAdminExpenseBps(2000);
        (bool afterAllowed, string memory afterReason) = liquidationEngine.canLiquidate(loanId, 0.56e18, 18);
        assert(afterAllowed == true);
        assertEq(afterReason, "LiquidationEngine: critical coverage threshold reached");
    }

    function testLiquidateLoanDistributesProceedsWhenCriticalCoverage() public {
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

        // Critical path: collateral value = 50 and threshold = 55.
        uint256 price = 0.5e18;
        uint256 priceDecimals = 18;

        (bool allowed, string memory reason) = liquidationEngine.canLiquidate(loanId, price, priceDecimals);
        assert(allowed == true);
        assertEq(reason, "LiquidationEngine: critical coverage threshold reached");

        vm.prank(originator);
        liquidationEngine.liquidateLoan(loanId, price, priceDecimals, fundingPartner);

        assert(loanRegistry.getLoanStatus(loanId) == uint8(ILoanRegistry.LoanStatus.Liquidated));
        CollateralVault.Vault memory vault = collateralVault.getVault(loanId);
        assert(vault.liquidated == true);
        assert(usdc.balanceOf(fundingPartner) == 50e18);
        assert(usdc.balanceOf(originator) == 0);
        assert(usdc.balanceOf(borrower) == 0);
    }

    function _createActiveLoanWithCollateral(uint256 collateralAmount, uint256 loanAmount) internal returns (uint256 loanId) {
        uint256 dueDate = block.timestamp + 365 days;
        loanId = loanRegistry.createLoan(
            borrower,
            originator,
            address(collateralToken),
            0,
            loanAmount,
            5000,
            dueDate
        );

        collateralToken.mint(borrower, collateralAmount);
        vm.prank(borrower);
        collateralToken.approve(address(collateralVault), collateralAmount);
        vm.prank(borrower);
        collateralVault.depositCollateral(loanId, collateralAmount);
    }

    function assertEq(string memory a, string memory b) internal pure {
        require(keccak256(bytes(a)) == keccak256(bytes(b)), "strings not equal");
    }
}
