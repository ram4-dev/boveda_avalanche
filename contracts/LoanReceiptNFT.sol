// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract LoanReceiptNFT {
    string public name;
    string public symbol;
    address public registrar;

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    mapping(uint256 => string) private _tokenURIs;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    modifier onlyRegistrar() {
        require(msg.sender == registrar, "LoanReceiptNFT: caller is not registrar");
        _;
    }

    constructor(string memory _name, string memory _symbol, address _registrar) {
        require(_registrar != address(0), "LoanReceiptNFT: invalid registrar");
        name = _name;
        symbol = _symbol;
        registrar = _registrar;
    }

    function balanceOf(address owner) public view returns (uint256) {
        require(owner != address(0), "LoanReceiptNFT: zero address");
        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "LoanReceiptNFT: token does not exist");
        return owner;
    }

    function approve(address, uint256) public pure {
        revert("LoanReceiptNFT: approvals disabled");
    }

    function setApprovalForAll(address, bool) public pure {
        revert("LoanReceiptNFT: approvals disabled");
    }

    function getApproved(uint256) public pure returns (address) {
        revert("LoanReceiptNFT: approvals disabled");
    }

    function isApprovedForAll(address, address) public pure returns (bool) {
        return false;
    }

    function transferFrom(address, address, uint256) public pure {
        revert("LoanReceiptNFT: soulbound token");
    }

    function safeTransferFrom(address, address, uint256) public pure {
        revert("LoanReceiptNFT: soulbound token");
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public pure {
        revert("LoanReceiptNFT: soulbound token");
    }

    function mint(address to, uint256 tokenId, string calldata tokenURI) external onlyRegistrar {
        require(to != address(0), "LoanReceiptNFT: mint to zero address");
        require(_owners[tokenId] == address(0), "LoanReceiptNFT: token already minted");

        _owners[tokenId] = to;
        _balances[to] += 1;
        _tokenURIs[tokenId] = tokenURI;

        emit Transfer(address(0), to, tokenId);
    }

    function burn(uint256 tokenId) external onlyRegistrar {
        address owner = _owners[tokenId];
        require(owner != address(0), "LoanReceiptNFT: token does not exist");

        _balances[owner] -= 1;
        delete _owners[tokenId];
        delete _tokenURIs[tokenId];

        emit Transfer(owner, address(0), tokenId);
    }

    function tokenURI(uint256 tokenId) public view returns (string memory) {
        require(_owners[tokenId] != address(0), "LoanReceiptNFT: token does not exist");
        return _tokenURIs[tokenId];
    }

    function exists(uint256 tokenId) public view returns (bool) {
        return _owners[tokenId] != address(0);
    }
}
