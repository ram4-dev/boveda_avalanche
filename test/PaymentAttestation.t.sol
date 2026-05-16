// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../contracts/LoanRegistry.sol";
import "../contracts/PaymentAttestation.sol";

interface Vm {
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function addr(uint256 privateKey) external returns (address);
}

contract PaymentAttestationTest {
    Vm constant vm = Vm(address(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D));

    LoanRegistry loanRegistry;
    PaymentAttestation paymentAttestation;
    address attestor = 0xe05fcC23807536bEe418f142D19fa0d21BB0cfF7;
    uint256 attestorKey = 0xA11CE;

    address borrower = address(this);
    address originator = address(this);

    function setUp() public {
        loanRegistry = new LoanRegistry();
        paymentAttestation = new PaymentAttestation(address(loanRegistry), attestor);
    }

    function testRegisterPayment() public {
        uint256 dueDate = block.timestamp + 365 days;
        uint256 loanId = loanRegistry.createLoan(
            borrower,
            originator,
            address(0x123),
            0,
            50e18,
            5000,
            dueDate
        );
        loanRegistry.setLoanStatus(loanId, uint8(ILoanRegistry.LoanStatus.Active));

        bytes32 paymentHash = keccak256("payment-1");
        bytes32 message = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(abi.encodePacked(address(paymentAttestation), loanId, paymentHash))));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(attestorKey, message);
        bytes memory signature = abi.encodePacked(r, s, v);

        paymentAttestation.registerPayment(loanId, paymentHash, signature);

        assert(paymentAttestation.paymentRecorded(loanId, paymentHash));
        assert(paymentAttestation.getPaymentAttestationCount(loanId) == 1);
        assert(paymentAttestation.getPaymentHashAt(loanId, 0) == paymentHash);
    }

    function testRejectInvalidSignature() public {
        uint256 dueDate = block.timestamp + 365 days;
        uint256 loanId = loanRegistry.createLoan(
            borrower,
            originator,
            address(0x123),
            0,
            50e18,
            5000,
            dueDate
        );
        loanRegistry.setLoanStatus(loanId, uint8(ILoanRegistry.LoanStatus.Active));

        address invalidSigner = address(0xBEEF);
        bytes32 paymentHash = keccak256("payment-2");
        bytes32 message = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(abi.encodePacked(address(paymentAttestation), loanId, paymentHash))));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(uint256(uint160(invalidSigner)), message);
        bytes memory signature = abi.encodePacked(r, s, v);

        (bool success, ) = address(paymentAttestation).call(abi.encodeWithSignature("registerPayment(uint256,bytes32,bytes)", loanId, paymentHash, signature));
        assert(!success);
    }

    function testRejectDuplicatePayment() public {
        uint256 dueDate = block.timestamp + 365 days;
        uint256 loanId = loanRegistry.createLoan(
            borrower,
            originator,
            address(0x123),
            0,
            50e18,
            5000,
            dueDate
        );
        loanRegistry.setLoanStatus(loanId, uint8(ILoanRegistry.LoanStatus.Active));

        bytes32 paymentHash = keccak256("payment-3");
        bytes32 message = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(abi.encodePacked(address(paymentAttestation), loanId, paymentHash))));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(attestorKey, message);
        bytes memory signature = abi.encodePacked(r, s, v);

        paymentAttestation.registerPayment(loanId, paymentHash, signature);

        (bool success, ) = address(paymentAttestation).call(abi.encodeWithSignature("registerPayment(uint256,bytes32,bytes)", loanId, paymentHash, signature));
        assert(!success);
    }
}
