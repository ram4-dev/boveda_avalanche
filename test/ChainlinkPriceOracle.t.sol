// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../contracts/ChainlinkPriceOracle.sol";
import "../contracts/mocks/MockV3Aggregator.sol";

interface OracleVm {
    function expectRevert(bytes calldata reason) external;
    function warp(uint256 newTimestamp) external;
}

contract ChainlinkPriceOracleTest {
    OracleVm constant vm = OracleVm(address(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D));

    ChainlinkPriceOracle oracle;
    MockV3Aggregator feed;
    address token = address(0xA11CE);

    function setUp() public {
        oracle = new ChainlinkPriceOracle(1 hours);
        feed = new MockV3Aggregator(8, 35e8);
        oracle.setFeed(token, address(feed));
    }

    function testReadsConfiguredChainlinkFeed() public view {
        (uint256 price, uint256 decimals) = oracle.getPrice(token);
        assert(price == 35e8);
        assert(decimals == 8);
    }

    function testRejectsUnsupportedToken() public {
        vm.expectRevert(bytes("ChainlinkPriceOracle: feed not configured"));
        oracle.getPrice(address(0xB0B));
    }

    function testRejectsNonPositiveAnswer() public {
        feed.setRoundData(2, 0, block.timestamp, 2);
        vm.expectRevert(bytes("ChainlinkPriceOracle: non-positive answer"));
        oracle.getPrice(token);
    }

    function testRejectsIncompleteRound() public {
        feed.setRoundData(2, 35e8, 0, 2);
        vm.expectRevert(bytes("ChainlinkPriceOracle: incomplete round"));
        oracle.getPrice(token);
    }

    function testRejectsFutureRound() public {
        feed.setRoundData(2, 35e8, block.timestamp + 1, 2);
        vm.expectRevert(bytes("ChainlinkPriceOracle: future round"));
        oracle.getPrice(token);
    }

    function testRejectsStalePrice() public {
        feed.setRoundData(2, 35e8, block.timestamp, 2);
        vm.warp(block.timestamp + 2 hours);
        vm.expectRevert(bytes("ChainlinkPriceOracle: stale price"));
        oracle.getPrice(token);
    }

    function testRejectsStaleRound() public {
        feed.setRoundData(3, 35e8, block.timestamp, 2);
        vm.expectRevert(bytes("ChainlinkPriceOracle: stale round"));
        oracle.getPrice(token);
    }
}
