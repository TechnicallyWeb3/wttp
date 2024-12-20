// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

/// @title Data Point Structure Components
/// @notice Defines the basic structure elements of a data point
/// @dev Uses bytes2 for efficient storage of type information
struct DataPointStructure {
    /// @notice MIME type identifier for the data
    /// @dev Stored as bytes2 for gas efficiency
    bytes2 mimeType;
    /// @notice Character encoding of the data
    bytes2 charset;
    /// @notice Storage location identifier
    bytes2 location;
}

/// @title Data Point Container
/// @notice Main structure for storing data with its metadata
struct DataPoint {
    /// @notice Structural metadata about the data point
    DataPointStructure structure;
    /// @notice The actual data content
    bytes data;
}

/// @title Data Point Information
/// @notice Read-only information about a stored data point
struct DataPointInfo {
    /// @notice Size of the data in bytes
    uint256 size;
    /// @notice Structural metadata about the data point
    DataPointStructure structure;
}


/// @notice Calculates a unique address for a data point
/// @dev Uses keccak256 hash of concatenated structural information and data
/// @param _dataPoint The data point to calculate the address for
/// @return bytes32 The calculated address
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

/// @title Data Point Storage Contract
/// @notice Provides core storage functionality for data points
/// @dev Implements collision handling and basic CRUD operations
contract DataPointStorage {

    mapping(bytes32 => DataPoint) private dataPoints;

    /// @notice Calculates the storage address for a data point with collision handling
    /// @dev Iteratively generates new addresses if collisions are detected
    /// @param _dataPoint The data point to calculate address for
    /// @return bytes32 The final calculated storage address
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

    /// @notice Stores a new data point
    /// @dev Validates input and handles storage with collision avoidance
    /// @param _dataPoint The data point to store
    /// @return dataPointAddress The address where the data point is stored
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

        emit DataPointWritten(dataPointAddress, _dataPoint);
    }

    /// @notice Retrieves a data point by its address
    /// @param _dataPointAddress The address of the data point to retrieve
    /// @return The requested data point
    function readDataPoint(
        bytes32 _dataPointAddress
    ) public view returns (DataPoint memory) {
        return dataPoints[_dataPointAddress];
    }

    /// @notice Gets metadata information about a stored data point
    /// @param _dataPointAddress The address of the data point
    /// @return DataPointInfo structure containing size and metadata
    function dataPointInfo(
        bytes32 _dataPointAddress
    ) public view returns (DataPointInfo memory) {
        DataPoint memory _dataPoint = dataPoints[_dataPointAddress];
        return
            DataPointInfo(
                _dataPoint.data.length,
                _dataPoint.structure
            );
    }
    event DataPointWritten(bytes32 indexed dataPointAddress, DataPoint dataPoint);

}

/// @title Data Point Registry Contract
/// @notice Manages data point publishing and royalty payments
/// @dev Extends storage functionality with economic incentives
contract DataPointRegistry {

    /// @notice Structure for tracking royalty information
    /// @dev Stores gas usage and publisher address for royalty calculations
    struct DataPointRoyalty {
        uint256 gasUsed;
        address publisher;
    }

    uint256 public royaltyRate;
    mapping(bytes32 => DataPointRoyalty) private dataPointRoyalty;
    mapping(address => uint256) private publisherBalance;

    DataPointStorage public DPS_;
    address internal tw3;

    /// @notice Contract constructor
    /// @param _dps Address of the DataPointStorage contract
    /// @param _tw3 Address for platform fee collection 
    /// @param _royaltyRate Royalty rate in wei (should be 0.1-1% of chain's average gas fees)
    constructor(address _dps, address _tw3, uint256 _royaltyRate) {
        DPS_ = DataPointStorage(_dps);
        tw3 = _tw3;
        royaltyRate = _royaltyRate;
    }

    /// @notice Gets the royalty recipient for a data point
    /// @param _dataPointAddress The address of the data point
    /// @return The address of the royalty recipient
    function _getRoyaltyAddress(
        bytes32 _dataPointAddress
    ) internal view virtual returns (address) {
        return dataPointRoyalty[_dataPointAddress].publisher;
    }

    /// @notice Defines the gas rate for royalty calculations
    /// @return The gas rate in wei (0.01 gwei)
    function _royaltyGasRate() internal view virtual returns (uint256) {
        return royaltyRate;
    }

    /// @notice Calculates the royalty amount for a data point
    /// @param _dataPointAddress The address of the data point
    /// @return The calculated royalty amount in wei
    function getRoyalty(
        bytes32 _dataPointAddress
    ) public view virtual returns (uint256) {
        return dataPointRoyalty[_dataPointAddress].gasUsed * _royaltyGasRate();
    }

    /// @notice Allows publishers to withdraw their earned royalties
    /// @param _amount The amount to withdraw
    /// @param _withdrawTo The address to send the royalties to
    function collectRoyalties(uint256 _amount, address _withdrawTo) public {
        require(_amount <= publisherBalance[msg.sender], "DPR: Insufficient balance");
        publisherBalance[msg.sender] -= _amount;
        payable(_withdrawTo).transfer(_amount);
        emit RoyaltiesCollected(msg.sender, _amount, _withdrawTo);
    }

    /// @notice Checks the royalty balance of a publisher
    /// @param _publisher The address of the publisher
    /// @return The current balance in wei
    function royaltyBalance(address _publisher) public view returns (uint256) {
        return publisherBalance[_publisher];
    }

    /// @notice Writes a new data point and handles royalty logic
    /// @dev Use address(0) as publisher to waive royalties
    /// @param _dataPoint The data point to write
    /// @param _publisher The address of the publisher (or address(0) to waive royalties)
    /// @return dataPointAddress The address where the data point is stored
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
                DPS_.writeDataPoint(_dataPoint);
            } else {
                // if the publisher is not waiving royalties, calculate the gas used to write the data point
                uint256 startGas = gasleft();
                DPS_.writeDataPoint(_dataPoint);
                uint256 gasUsed = startGas - gasleft();
                // is this good logic? gasRate is in wei, gasUsed is in gas
                royalty.gasUsed = gasUsed; // < royaltyRate ? gasUsed : royaltyRate;
                royalty.publisher = _publisher;
            }
            emit DataPointRegistered(dataPointAddress, _publisher);
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
                emit RoyaltiesPaid(dataPointAddress, royalty.publisher, msg.value);
            }
        }
    }

    event RoyaltiesCollected(address indexed publisher, uint256 amount, address indexed withdrawTo);
    event RoyaltiesPaid(bytes32 indexed dataPointAddress, address indexed publisher, uint256 amount);
    event DataPointRegistered(bytes32 indexed dataPointAddress, address indexed publisher);
}