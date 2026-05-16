// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../contracts/LoanRegistry.sol";
import "../contracts/LoanReceiptNFT.sol";

contract LoanReceiptNFTAttacker {
    function tryMint(address nft, address to, uint256 tokenId, string memory uri) external returns (bool) {
        (bool success, ) = nft.call(abi.encodeWithSignature("mint(address,uint256,string)", to, tokenId, uri));
        return success;
    }

    function tryTransfer(address nft, address from, address to, uint256 tokenId) external returns (bool) {
        (bool success, ) = nft.call(abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, tokenId));
        return success;
    }
}

contract LoanReceiptNFTTest {
    LoanRegistry loanRegistry;
    LoanReceiptNFT receiptNFT;
    LoanReceiptNFTAttacker attacker;

    address borrower = address(this);
    address originator = address(this);

    function setUp() public {
        loanRegistry = new LoanRegistry();
        receiptNFT = new LoanReceiptNFT("Boveda Loan Receipt", "BLR", address(this));
        attacker = new LoanReceiptNFTAttacker();
    }

    function testMintLoanReceipt() public {
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

        receiptNFT.mint(borrower, loanId, "https://example.com/loan/1");

        assert(receiptNFT.ownerOf(loanId) == borrower);
        assert(receiptNFT.balanceOf(borrower) == 1);
        assert(receiptNFT.exists(loanId));
        assert(keccak256(bytes(receiptNFT.tokenURI(loanId))) == keccak256(bytes("https://example.com/loan/1")));
    }

    function testCannotTransferSoulbound() public {
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

        receiptNFT.mint(borrower, loanId, "https://example.com/loan/1");

        bool success = attacker.tryTransfer(address(receiptNFT), borrower, address(0x456), loanId);
        assert(success == false);
    }

    function testOnlyRegistrarCanMint() public {
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

        bool success = attacker.tryMint(address(receiptNFT), borrower, loanId, "https://example.com/loan/1");
        assert(success == false);
        assert(!receiptNFT.exists(loanId));
    }
}
