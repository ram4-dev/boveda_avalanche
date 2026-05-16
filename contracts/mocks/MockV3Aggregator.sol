// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockV3Aggregator {
    uint8 public decimals;
    string public description;
    uint256 public version = 1;

    uint80 public roundId;
    int256 public answer;
    uint256 public startedAt;
    uint256 public updatedAt;
    uint80 public answeredInRound;

    constructor(uint8 decimals_, int256 initialAnswer) {
        decimals = decimals_;
        description = "Mock Chainlink Feed";
        setRoundData(1, initialAnswer, block.timestamp, 1);
    }

    function setRoundData(uint80 newRoundId, int256 newAnswer, uint256 newUpdatedAt, uint80 newAnsweredInRound) public {
        roundId = newRoundId;
        answer = newAnswer;
        startedAt = newUpdatedAt;
        updatedAt = newUpdatedAt;
        answeredInRound = newAnsweredInRound;
    }

    function latestRoundData()
        external
        view
        returns (
            uint80,
            int256,
            uint256,
            uint256,
            uint80
        )
    {
        return (roundId, answer, startedAt, updatedAt, answeredInRound);
    }
}
