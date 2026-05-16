// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

interface IPriceOracle {
    function getPrice(address token) external view returns (uint256 price, uint256 decimals);
}

contract ChainlinkPriceOracle is IPriceOracle {
    address public admin;
    uint256 public maxStalenessSeconds;
    mapping(address => address) public feedsByToken;

    event FeedSet(address indexed token, address indexed feed);
    event MaxStalenessSet(uint256 oldMaxStalenessSeconds, uint256 newMaxStalenessSeconds);

    modifier onlyAdmin() {
        require(msg.sender == admin, "ChainlinkPriceOracle: caller is not admin");
        _;
    }

    constructor(uint256 initialMaxStalenessSeconds) {
        require(initialMaxStalenessSeconds > 0, "Invalid max staleness");
        admin = msg.sender;
        maxStalenessSeconds = initialMaxStalenessSeconds;
    }

    function setFeed(address token, address feed) external onlyAdmin {
        require(token != address(0), "Invalid token");
        require(feed != address(0), "Invalid feed");
        feedsByToken[token] = feed;
        emit FeedSet(token, feed);
    }

    function setMaxStalenessSeconds(uint256 newMaxStalenessSeconds) external onlyAdmin {
        require(newMaxStalenessSeconds > 0, "Invalid max staleness");
        emit MaxStalenessSet(maxStalenessSeconds, newMaxStalenessSeconds);
        maxStalenessSeconds = newMaxStalenessSeconds;
    }

    function getPrice(address token) external view returns (uint256 price, uint256 decimals) {
        address feed = feedsByToken[token];
        require(feed != address(0), "ChainlinkPriceOracle: feed not configured");

        AggregatorV3Interface aggregator = AggregatorV3Interface(feed);
        (
            uint80 roundId,
            int256 answer,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = aggregator.latestRoundData();

        require(answer > 0, "ChainlinkPriceOracle: non-positive answer");
        require(updatedAt != 0, "ChainlinkPriceOracle: incomplete round");
        require(answeredInRound >= roundId, "ChainlinkPriceOracle: stale round");
        require(block.timestamp >= updatedAt, "ChainlinkPriceOracle: future round");
        require(block.timestamp - updatedAt <= maxStalenessSeconds, "ChainlinkPriceOracle: stale price");

        return (uint256(answer), aggregator.decimals());
    }
}
