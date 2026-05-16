// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LoanRegistry
 * @notice Registro central de préstamos. Almacena datos mínimos de cada préstamo
 * y su estado a lo largo del ciclo de vida.
 */

interface ILoanRegistry {
    event LoanCreated(
        uint256 indexed loanId,
        address indexed borrower,
        address indexed originator,
        address collateralToken,
        uint256 collateralAmount,
        uint256 loanAmount,
        uint256 ltv
    );

    event LoanStateChanged(
        uint256 indexed loanId,
        uint8 oldStatus,
        uint8 newStatus
    );

    event LoanCollateralUpdated(
        uint256 indexed loanId,
        uint256 newAmount
    );

    struct Loan {
        uint256 loanId;
        address borrower;
        address originator;
        address collateralToken;
        uint256 collateralAmount;
        uint256 loanAmount;
        uint256 ltv; // percentage in basis points (5000 = 50%)
        uint8 status; // 0=Requested, 1=Approved, 2=Active, 3=MarginCall, 4=Repaid, 5=Defaulted, 6=Liquidated, 7=Cancelled
        uint256 createdAt;
        uint256 dueDate;
        uint256 lastUpdatedAt;
    }

    enum LoanStatus {
        Requested,   // 0
        Approved,    // 1
        Active,      // 2
        MarginCall,  // 3
        Repaid,      // 4
        Defaulted,   // 5
        Liquidated,  // 6
        Cancelled    // 7
    }
}

contract LoanRegistry is ILoanRegistry {
    // Storage
    mapping(uint256 => Loan) public loans;
    mapping(address => uint256[]) public borrowerLoans;
    mapping(address => uint256[]) public originatorLoans;
    uint256 public loanCounter;

    // Constructor
    constructor() {
        loanCounter = 1;
    }

    /**
     * @notice Crear un nuevo préstamo
     * @param borrower Dirección del prestatario
     * @param originator Dirección del originador
     * @param collateralToken Token del colateral
     * @param collateralAmount Cantidad de colateral (en base units)
     * @param loanAmount Monto del préstamo
     * @param ltv LTV en basis points (5000 = 50%)
     * @param dueDate Fecha de vencimiento (timestamp)
     */
    function createLoan(
        address borrower,
        address originator,
        address collateralToken,
        uint256 collateralAmount,
        uint256 loanAmount,
        uint256 ltv,
        uint256 dueDate
    ) external returns (uint256 loanId) {
        require(borrower != address(0), "Invalid borrower");
        require(originator != address(0), "Invalid originator");
        require(collateralToken != address(0), "Invalid collateral token");
        require(loanAmount > 0, "Loan amount must be > 0");
        require(ltv > 0 && ltv <= 10000, "Invalid LTV");
        require(dueDate > block.timestamp, "Invalid due date");

        loanId = loanCounter++;

        loans[loanId] = Loan({
            loanId: loanId,
            borrower: borrower,
            originator: originator,
            collateralToken: collateralToken,
            collateralAmount: collateralAmount,
            loanAmount: loanAmount,
            ltv: ltv,
            status: uint8(LoanStatus.Requested),
            createdAt: block.timestamp,
            dueDate: dueDate,
            lastUpdatedAt: block.timestamp
        });

        borrowerLoans[borrower].push(loanId);
        originatorLoans[originator].push(loanId);

        emit LoanCreated(
            loanId,
            borrower,
            originator,
            collateralToken,
            collateralAmount,
            loanAmount,
            ltv
        );
    }

    /**
     * @notice Obtener datos de un préstamo
     */
    function getLoan(uint256 loanId) external view returns (Loan memory) {
        require(loans[loanId].loanId != 0, "Loan not found");
        return loans[loanId];
    }

    /**
     * @notice Cambiar el estado de un préstamo
     */
    function setLoanStatus(uint256 loanId, uint8 newStatus) external {
        require(loans[loanId].loanId != 0, "Loan not found");
        require(newStatus <= uint8(LoanStatus.Cancelled), "Invalid status");

        uint8 oldStatus = loans[loanId].status;
        loans[loanId].status = newStatus;
        loans[loanId].lastUpdatedAt = block.timestamp;

        emit LoanStateChanged(loanId, oldStatus, newStatus);
    }

    /**
     * @notice Actualizar monto de colateral (cuando se deposita más)
     */
    function updateCollateralAmount(uint256 loanId, uint256 newAmount) external {
        require(loans[loanId].loanId != 0, "Loan not found");
        require(newAmount > 0, "Amount must be > 0");

        loans[loanId].collateralAmount = newAmount;
        loans[loanId].lastUpdatedAt = block.timestamp;

        emit LoanCollateralUpdated(loanId, newAmount);
    }

    /**
     * @notice Obtener todos los préstamos de un prestatario
     */
    function getBorrowerLoans(address borrower) external view returns (uint256[] memory) {
        return borrowerLoans[borrower];
    }

    /**
     * @notice Obtener todos los préstamos de un originador
     */
    function getOriginatorLoans(address originator) external view returns (uint256[] memory) {
        return originatorLoans[originator];
    }

    /**
     * @notice Obtener el estado de un préstamo
     */
    function getLoanStatus(uint256 loanId) external view returns (uint8) {
        require(loans[loanId].loanId != 0, "Loan not found");
        return loans[loanId].status;
    }
}
