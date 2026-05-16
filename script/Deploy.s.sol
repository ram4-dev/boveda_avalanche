// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../contracts/LoanRegistry.sol";
import "../contracts/CollateralVault.sol";
import "../contracts/LoanReceiptNFT.sol";
import "../contracts/PaymentAttestation.sol";
import "../contracts/LiquidationEngine.sol";
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

        address proceedsTokenAddress = vm.envAddress("USDC_ADDRESS");
        MockERC20 proceedsToken;

        if (proceedsTokenAddress == address(0)) {
            proceedsToken = new MockERC20("USDC Mock", "USDC", 18, 1_000_000 ether);
            proceedsTokenAddress = address(proceedsToken);
            console.log("USDC_ADDRESS not set; deploying mock USDC at:", proceedsTokenAddress);
        } else {
            console.log("Using existing USDC token at:", proceedsTokenAddress);
        }

        LiquidationEngine liquidationEngine = new LiquidationEngine(
            address(loanRegistry),
            address(collateralVault),
            proceedsTokenAddress,
            200
        );

        collateralVault.setLiquidationEngine(address(liquidationEngine));

        console.log("Deployer:", deployer);
        console.log("LoanRegistry:", address(loanRegistry));
        console.log("CollateralVault:", address(collateralVault));
        console.log("LoanReceiptNFT:", address(loanReceiptNFT));
        console.log("PaymentAttestation:", address(paymentAttestation));
        console.log("LiquidationEngine:", address(liquidationEngine));
        console.log("ProceedsToken:", proceedsTokenAddress);

        vm.stopBroadcast();
    }
}
