// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./LoanRegistry.sol";

contract PaymentAttestation {
    LoanRegistry public loanRegistry;
    address public attestor;
    address public admin;

    mapping(uint256 => bytes32[]) private _paymentHashesList;
    mapping(uint256 => mapping(bytes32 => bool)) public paymentRecorded;

    event InstallmentPaid(uint256 indexed loanId, bytes32 indexed paymentHash, address indexed attestor);
    event AttestorUpdated(address indexed oldAttestor, address indexed newAttestor);

    modifier onlyAdmin() {
        require(msg.sender == admin, "PaymentAttestation: caller is not admin");
        _;
    }

    constructor(address loanRegistryAddress, address attestorAddress) {
        require(loanRegistryAddress != address(0), "PaymentAttestation: invalid registry");
        require(attestorAddress != address(0), "PaymentAttestation: invalid attestor");
        loanRegistry = LoanRegistry(loanRegistryAddress);
        attestor = attestorAddress;
        admin = msg.sender;
    }

    function setAttestor(address newAttestor) external onlyAdmin {
        require(newAttestor != address(0), "PaymentAttestation: invalid attestor");
        emit AttestorUpdated(attestor, newAttestor);
        attestor = newAttestor;
    }

    function registerPayment(uint256 loanId, bytes32 paymentHash, bytes calldata signature) external {
        require(paymentHash != bytes32(0), "PaymentAttestation: invalid payment hash");
        require(!paymentRecorded[loanId][paymentHash], "PaymentAttestation: payment already recorded");

        ILoanRegistry.Loan memory loan = loanRegistry.getLoan(loanId);
        require(loan.loanId != 0, "PaymentAttestation: loan not found");
        require(
            loan.status == uint8(ILoanRegistry.LoanStatus.Active) ||
            loan.status == uint8(ILoanRegistry.LoanStatus.MarginCall) ||
            loan.status == uint8(ILoanRegistry.LoanStatus.Repaid),
            "PaymentAttestation: loan not payable"
        );

        bytes32 message = _getPrefixedMessage(loanId, paymentHash);
        address signer = _recoverSigner(message, signature);
        require(signer == attestor, "PaymentAttestation: invalid attestor");

        paymentRecorded[loanId][paymentHash] = true;
        _paymentHashesList[loanId].push(paymentHash);

        emit InstallmentPaid(loanId, paymentHash, attestor);
    }

    function getPaymentHashAt(uint256 loanId, uint256 index) external view returns (bytes32) {
        return _paymentHashesList[loanId][index];
    }

    function getPaymentAttestationCount(uint256 loanId) external view returns (uint256) {
        return _paymentHashesList[loanId].length;
    }

    function _getPrefixedMessage(uint256 loanId, bytes32 paymentHash) internal view returns (bytes32) {
        bytes32 hash = keccak256(abi.encodePacked(address(this), loanId, paymentHash));
        return _prefixed(hash);
    }

    function _prefixed(bytes32 hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }

    function _recoverSigner(bytes32 message, bytes calldata signature) internal pure returns (address) {
        require(signature.length == 65, "PaymentAttestation: invalid signature length");
        (bytes32 r, bytes32 s) = abi.decode(signature[:64], (bytes32, bytes32));
        uint8 v = uint8(signature[64]);
        if (v < 27) {
            v += 27;
        }
        require(v == 27 || v == 28, "PaymentAttestation: invalid signature v");
        return ecrecover(message, v, r, s);
    }
}
