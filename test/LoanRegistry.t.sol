// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../contracts/LoanRegistry.sol";

contract LoanRegistryTest {
    LoanRegistry loanRegistry;

    address borrower = address(0x1);
    address originator = address(0x2);
    address collateralToken = address(0x3);

    function setUp() public {
        loanRegistry = new LoanRegistry();
    }

    function testCreateLoan() public {
        uint256 dueDate = block.timestamp + 365 days;

        uint256 loanId = loanRegistry.createLoan(
            borrower,
            originator,
            collateralToken,
            1000e18,
            500e18,
            5000,
            dueDate
        );

        assert(loanId == 1);

        ILoanRegistry.Loan memory loan = loanRegistry.getLoan(loanId);
        assert(loan.borrower == borrower);
        assert(loan.originator == originator);
        assert(loan.status == uint8(ILoanRegistry.LoanStatus.Requested));
    }

    function testSetLoanStatus() public {
        uint256 dueDate = block.timestamp + 365 days;

        uint256 loanId = loanRegistry.createLoan(
            borrower,
            originator,
            collateralToken,
            1000e18,
            500e18,
            5000,
            dueDate
        );

        loanRegistry.setLoanStatus(loanId, uint8(ILoanRegistry.LoanStatus.Active));

        uint8 status = loanRegistry.getLoanStatus(loanId);
        assert(status == uint8(ILoanRegistry.LoanStatus.Active));
    }

    function testGetBorrowerLoans() public {
        uint256 dueDate = block.timestamp + 365 days;

        loanRegistry.createLoan(
            borrower,
            originator,
            collateralToken,
            1000e18,
            500e18,
            5000,
            dueDate
        );

        uint256[] memory loans = loanRegistry.getBorrowerLoans(borrower);
        assert(loans.length == 1);
        assert(loans[0] == 1);
    }

    function testCreateMultipleLoans() public {
        uint256 dueDate = block.timestamp + 365 days;

        uint256 loan1 = loanRegistry.createLoan(
            borrower,
            originator,
            collateralToken,
            1000e18,
            500e18,
            5000,
            dueDate
        );

        uint256 loan2 = loanRegistry.createLoan(
            borrower,
            originator,
            collateralToken,
            2000e18,
            1000e18,
            5000,
            dueDate
        );

        assert(loan1 == 1);
        assert(loan2 == 2);

        uint256[] memory borrowerLoans = loanRegistry.getBorrowerLoans(borrower);
        assert(borrowerLoans.length == 2);
    }

    function testInvalidBorrower() public {
        uint256 dueDate = block.timestamp + 365 days;
        (bool success, ) = address(loanRegistry).call(
            abi.encodeWithSelector(
                loanRegistry.createLoan.selector,
                address(0),
                originator,
                collateralToken,
                1000e18,
                500e18,
                5000,
                dueDate
            )
        );
        assert(!success);
    }

    function testInvalidDueDate() public {
        (bool success, ) = address(loanRegistry).call(
            abi.encodeWithSelector(
                loanRegistry.createLoan.selector,
                borrower,
                originator,
                collateralToken,
                1000e18,
                500e18,
                5000,
                0
            )
        );
        assert(!success);
    }
}
