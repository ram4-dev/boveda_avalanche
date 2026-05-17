// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../contracts/LoanRegistry.sol";
import "../contracts/CollateralVault.sol";
import "../contracts/LoanReceiptNFT.sol";
import "../contracts/PaymentAttestation.sol";
import "../contracts/LiquidationEngine.sol";
import "../contracts/ChainlinkPriceOracle.sol";
import "../contracts/mocks/MockERC20.sol";

contract DeployBoveda is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        require(deployerKey != 0, "DEPLOYER_PRIVATE_KEY not set");

        address deployer = vm.addr(deployerKey);
        vm.startBroadcast(deployerKey);

        LoanRegistry loanRegistry = new LoanRegistry();
        CollateralVault collateralVault = new CollateralVault(address(loanRegistry));
        LoanReceiptNFT loanReceiptNFT = new LoanReceiptNFT(
            "Boveda Loan Receipt",
            "BLOAN",
            deployer
        );
        PaymentAttestation paymentAttestation = new PaymentAttestation(
            address(loanRegistry),
            deployer
        );

        address proceedsTokenAddress = vm.envOr("USDC_ADDRESS", address(0));
        MockERC20 proceedsToken;

        if (proceedsTokenAddress == address(0)) {
            proceedsToken = new MockERC20("USDC Mock", "USDC", 18, 1_000_000 ether);
            proceedsTokenAddress = address(proceedsToken);
            console.log("USDC_ADDRESS not set; deploying mock USDC at:", proceedsTokenAddress);
        } else {
            console.log("Using existing USDC token at:", proceedsTokenAddress);
        }

        uint16 originatorFeeBps = uint16(vm.envOr("ORIGINATOR_FEE_BPS", uint256(1000)));
        require(originatorFeeBps <= 10000, "Invalid ORIGINATOR_FEE_BPS");

        LiquidationEngine liquidationEngine = new LiquidationEngine(
            address(loanRegistry),
            address(collateralVault),
            proceedsTokenAddress,
            originatorFeeBps
        );

        uint256 maxStalenessSeconds = vm.envOr("CHAINLINK_MAX_STALENESS_SECONDS", uint256(1 days));
        ChainlinkPriceOracle priceOracle = new ChainlinkPriceOracle(maxStalenessSeconds);
        address collateralTokenAddress = vm.envOr("COLLATERAL_TOKEN_ADDRESS", address(0));
        address collateralUsdFeedAddress = vm.envOr("COLLATERAL_USD_FEED_ADDRESS", address(0));

        if (collateralTokenAddress != address(0) && collateralUsdFeedAddress != address(0)) {
            priceOracle.setFeed(collateralTokenAddress, collateralUsdFeedAddress);
            liquidationEngine.setPriceOracle(address(priceOracle));
            console.log("Configured Chainlink collateral token:", collateralTokenAddress);
            console.log("Configured Chainlink USD feed:", collateralUsdFeedAddress);
        } else {
            console.log("Oracle deployed but not connected; set COLLATERAL_TOKEN_ADDRESS and COLLATERAL_USD_FEED_ADDRESS to enable it");
        }

        collateralVault.setLiquidationEngine(address(liquidationEngine));

        console.log("Deployer:", deployer);
        console.log("LoanRegistry:", address(loanRegistry));
        console.log("CollateralVault:", address(collateralVault));
        console.log("LoanReceiptNFT:", address(loanReceiptNFT));
        console.log("PaymentAttestation:", address(paymentAttestation));
        console.log("LiquidationEngine:", address(liquidationEngine));
        console.log("ChainlinkPriceOracle:", address(priceOracle));
        console.log("OracleMaxStalenessSeconds:", maxStalenessSeconds);
        console.log("OriginatorFeeBps:", originatorFeeBps);
        console.log("ProceedsToken:", proceedsTokenAddress);

        vm.stopBroadcast();
    }
}
