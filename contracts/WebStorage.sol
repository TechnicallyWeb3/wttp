// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

struct DataPointStructure {
    bytes2 mimeType;
    bytes2 charset;
    bytes2 location;
}
struct DataPoint {
    DataPointStructure structure;
    bytes data;
}
struct DataPointInfo {
    uint256 size;
    bytes2 mimeType;
    bytes2 charset;
    bytes2 location;
}

function getDataPointAddress(
    DataPoint memory _dataPoint
) pure returns (bytes32) {
    return
        keccak256(
            abi.encodePacked(
                _dataPoint.structure.mimeType,
                _dataPoint.structure.charset,
                _dataPoint.structure.location,
                _dataPoint.data
            )
        );
}

contract DataPointStorage {

    mapping(bytes32 => DataPoint) private dataPoints;

    function calculateAddress(
        DataPoint memory _dataPoint
    ) public view returns (bytes32) {
        bytes32 dataPointAddress = getDataPointAddress(_dataPoint);
        DataPoint memory dataPoint = dataPoints[dataPointAddress];
        // iterates for new address in case of hash collision
        for (uint256 i; dataPoint.data.length > 0 && keccak256(dataPoint.data) != keccak256(_dataPoint.data); i++) {
            dataPointAddress = keccak256(abi.encodePacked(dataPointAddress, uint256(i)));
            dataPoint = dataPoints[dataPointAddress];
        }
        return dataPointAddress;
    }

    function writeDataPoint(
        DataPoint memory _dataPoint
    ) public returns (bytes32 dataPointAddress) {
        require(
            _dataPoint.structure.mimeType != 0x0000,
            "DPS: Invalid MIME Type"
        );
        require(
            _dataPoint.structure.location != 0x0000,
            "DPS: Invalid Location"
        );
        require(_dataPoint.data.length > 0, "DPS: Empty data");

        dataPointAddress = calculateAddress(_dataPoint);

        if (dataPoints[dataPointAddress].data.length == 0) {
            dataPoints[dataPointAddress] = _dataPoint;
        }
    }

    function readDataPoint(
        bytes32 _dataPointAddress
    ) public view returns (DataPoint memory) {
        return dataPoints[_dataPointAddress];
    }

    function dataPointInfo(
        bytes32 _dataPointAddress
    ) public view returns (DataPointInfo memory) {
        DataPoint memory _dataPoint = dataPoints[_dataPointAddress];
        return
            DataPointInfo(
                _dataPoint.data.length,
                _dataPoint.structure.mimeType,
                _dataPoint.structure.charset,
                _dataPoint.structure.location
            );
    }

}

contract DataPointRegistry {
    
    struct DataPointRoyalty {
        uint256 gasUsed;
        address publisher;
    }

    mapping(bytes32 => DataPointRoyalty) private dataPointRoyalty;
    mapping(address => uint256) private publisherBalance;

    DataPointStorage public DPS_;
    address internal tw3;

    constructor(address _dps, address _tw3) {
        _setFileSystem(_dps);
        tw3 = _tw3;
    }

    function _setFileSystem(address _dps) internal virtual {
        DPS_ = DataPointStorage(_dps);
    }

    function _useFileSystem(
        DataPointStorage _dps
    ) internal view virtual returns (DataPointStorage) {
        return _dps;
    }

    function _getRoyaltyAddress(
        bytes32 _dataPointAddress
    ) internal view virtual returns (address) {
        return dataPointRoyalty[_dataPointAddress].publisher;
    }

    function _royaltyGasRate() internal pure virtual returns (uint256) {
        return 10000000; // 0.01 gwei
    }

    function getRoyalty(
        bytes32 _dataPointAddress
    ) public view virtual returns (uint256) {
        return dataPointRoyalty[_dataPointAddress].gasUsed * _royaltyGasRate();
    }

    function collectRoyalties(uint256 _amount, address _withdrawTo) public {
        require(_amount <= publisherBalance[msg.sender], "DPR: Insufficient balance");
        publisherBalance[msg.sender] -= _amount;
        payable(_withdrawTo).transfer(_amount);
    }

    function royaltyBalance(address _publisher) public view returns (uint256) {
        return publisherBalance[_publisher];
    }

    // using publisher address(0) to waive royalties
    function writeDataPoint(
        DataPoint memory _dataPoint,
        address _publisher
    ) public payable returns (bytes32 dataPointAddress) {
        dataPointAddress = getDataPointAddress(_dataPoint);
        DataPointInfo memory dataPointInfo = DPS_.dataPointInfo(
            dataPointAddress
        );
        DataPointRoyalty storage royalty = dataPointRoyalty[dataPointAddress];

        // if the data point is new, we need to write it to the file system
        if (dataPointInfo.size == 0) {
            // if the publisher is waiving royalties, only write the data point
            if (_publisher == address(0)) {
                _useFileSystem(DPS_).writeDataPoint(_dataPoint);
            } else {
                // if the publisher is not waiving royalties, calculate the gas used to write the data point
                uint256 startGas = gasleft();
                _useFileSystem(DPS_).writeDataPoint(_dataPoint);
                royalty.gasUsed = startGas - gasleft();
                royalty.publisher = _publisher;
            }
        } else {
            // the data point already exists, so we need to pay the publisher royalties
            if (
                royalty.publisher != address(0)
            ) {
                uint256 gasCost = getRoyalty(dataPointAddress);
                require(
                    msg.value >= gasCost,
                    "Not enough value to pay royalties"
                );
                publisherBalance[royalty.publisher] += msg.value - (gasCost / 10);
                publisherBalance[tw3] += gasCost / 10;
            }
        }
    }
}