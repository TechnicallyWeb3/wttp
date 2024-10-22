// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import {TypeMap, TypeCategory} from "./TypeMap.sol";
import {StatusMap} from "./StatusMap.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

struct DataPointStructure {
    bytes2 mimeType;
    bytes2 encoding;
    bytes2 location;
}
struct DataPoint {
    DataPointStructure structure;
    bytes data;
}
struct DataPointInfo {
    uint256 size;
    bytes2 mimeType;
    bytes2 encoding;
    bytes2 location;
}

function getDataPointAddress(
    DataPoint memory _dataPoint
) pure returns (bytes32) {
    return
        keccak256(
            abi.encodePacked(
                _dataPoint.structure.mimeType,
                _dataPoint.structure.encoding,
                _dataPoint.structure.location,
                _dataPoint.data
            )
        );
}

contract DataPointStorage {
    // mapping(bytes32 => bytes) public dataPointContents;
    // mapping(bytes32 => DataPointStructure) public dataPointStructures;
    mapping(bytes32 => DataPoint) private dataPoints;

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

        dataPointAddress = getDataPointAddress(_dataPoint);

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
                _dataPoint.structure.encoding,
                _dataPoint.structure.location
            );
    }

    // function getTotalSize(
    //     bytes32[] memory _dataPointAddresses
    // ) public view returns (uint256) {
    //     uint256 totalSize = 0;
    //     for (uint256 i = 0; i < _dataPointAddresses.length; i++) {
    //         totalSize += dataPoints[_dataPointAddresses[i]].data.length;
    //     }
    //     return totalSize;
    // }
}

contract DataPointRegistry {
    struct DataPointRoyalty {
        uint256 gasUsed;
        address publisher;
    }

    mapping(bytes32 => DataPointRoyalty) private dataPointRoyalty;

    DataPointStorage public DPS_;

    constructor(address _dps) {
        _setFileSystem(_dps);
    }

    function _setFileSystem(address _dps) internal virtual {
        DPS_ = DataPointStorage(_dps);
    }

    function _useFileSystem(
        DataPointStorage _dps
    ) internal view virtual returns (DataPointStorage) {
        return _dps;
    }

    function _validateDataPoint(
        DataPoint memory _dataPoint,
        bytes2 expectedLocation
    ) internal pure returns (bool) {
        // universal checks
        require(
            _dataPoint.structure.location == expectedLocation,
            "DPR: Unexpected location"
        );
        require(expectedLocation != 0x0000, "DPR: Location required");
        require(
            _dataPoint.data.length > 0,
            "DPR: Chunk data must be greater than 0"
        );

        return true;
    }

    function _getRoyaltyAddress(
        bytes32 _dataPointAddress
    ) internal view virtual returns (address) {
        return dataPointRoyalty[_dataPointAddress].publisher;
    }

    function _royaltyGasRate() internal pure virtual returns (uint256) {
        return 500000000; // 0.5 gwei
    }

    function getRoyalty(
        bytes32 _dataPointAddress
    ) public view virtual returns (uint256) {
        return dataPointRoyalty[_dataPointAddress].gasUsed * _royaltyGasRate();
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
            }
            royalty.publisher = _publisher;
        } else {
            // the data point already exists, so we need to pay the publisher royalties
            if (
                royalty.publisher != address(0) &&
                royalty.publisher != msg.sender
            ) {
                uint256 gasCost = getRoyalty(dataPointAddress);
                require(
                    msg.value >= gasCost,
                    "Not enough value to pay royalties"
                );
                payable(royalty.publisher).transfer(msg.value);
            }
        }
    }
}

abstract contract WebRegistry is Ownable {
    TypeMap private TYPE_MAP_;
    DataPointRegistry private DPR_;
    DataPointStorage private DPS_;

    constructor(address _typeMap, address _dpr) {
        TYPE_MAP_ = TypeMap(_typeMap);
        DPR_ = DataPointRegistry(_dpr);
        DPS_ = DPR_.DPS_();
    }

    mapping(address => bool) private admins;

    /// @notice Modifier to restrict function access to admins or the owner
    modifier onlyAdmin() {
        require(_isAdmin(msg.sender), "Not an admin");
        _;
    }

    /// @notice Adds a new admin
    /// @param _admin Address of the new admin
    /// @dev Can only be called by the owner
    /// @dev SECURITY WARNING: Overriding this function may break access control.
    ///      Ensure any override maintains the intended admin addition logic.
    function addAdmin(address _admin) public virtual onlyOwner {
        admins[_admin] = true;
        emit AdminAdded(_admin);
    }

    /// @notice Removes an admin
    /// @param _admin Address of the admin to remove
    /// @dev Can only be called by the owner
    /// @dev SECURITY WARNING: Overriding this function may break access control.
    ///      Ensure any override maintains the intended admin removal logic.
    function removeAdmin(address _admin) public virtual onlyOwner {
        admins[_admin] = false;
        emit AdminRemoved(_admin);
    }

    /// @notice Checks if an address is an admin
    /// @param _admin Address to check
    /// @return bool indicating whether the address is an admin
    /// @dev SECURITY WARNING: Overriding this function may break access control.
    ///      Ensure any override maintains the intended admin verification logic.
    function _isAdmin(address _admin) internal view virtual returns (bool) {
        return _admin == owner() || admins[_admin];
    }

    struct WebFileMetadata {
        uint256 size;
        uint256 version;
        bool isImmutable;
    }

    mapping(string => WebFileMetadata) private webFileMetadata;
    mapping(string => bytes32[]) private webFiles;

    function _writeWebFile(
        string memory _path,
        uint256 _chunk,
        DataPoint memory _dataPoint,
        address _publisher
    ) internal virtual returns (bytes32 dataPointAddress) {
        require(
            !webFileMetadata[_path].isImmutable,
            "WS: Web file is immutable"
        );
        require(
            _chunk <= webFiles[_path].length,
            "WS: Chunk index out of bounds"
        );

        // initialize to the original file size
        uint256 newFileSize = webFileMetadata[_path].size;

        dataPointAddress = DPR_.writeDataPoint(_dataPoint, _publisher);

        if (_chunk == webFiles[_path].length) {
            webFiles[_path].push(dataPointAddress);
            newFileSize += _dataPoint.data.length;
        } else {
            uint256 originalChunkSize = DPS_
                .dataPointInfo(webFiles[_path][_chunk])
                .size;
            newFileSize =
                newFileSize -
                originalChunkSize +
                _dataPoint.data.length;
            webFiles[_path][_chunk] = dataPointAddress;
        }

        webFileMetadata[_path].size = newFileSize;
        webFileMetadata[_path].version++;
    }

    function createWebFile(
        string memory _path,
        string memory _mimeType,
        string memory _encoding,
        string memory _location,
        address _publisher,
        bytes memory _data
    ) public payable virtual onlyOwner {
        require(bytes(_path).length > 0, "WS: Invalid path");
        require(webFiles[_path].length == 0, "WS: Web file already exists");

        bytes2 mimeType = TYPE_MAP_.getTypeBytes(
            TypeCategory.MIME_TYPE,
            _mimeType
        );
        bytes2 encoding = TYPE_MAP_.getTypeBytes(
            TypeCategory.ENCODING_TYPE,
            _encoding
        );
        bytes2 location = TYPE_MAP_.getTypeBytes(
            TypeCategory.LOCATION_TYPE,
            _location
        );

        DataPoint memory _dataPoint = DataPoint({
            structure: DataPointStructure({
                mimeType: mimeType,
                encoding: encoding,
                location: location
            }),
            data: _data
        });

        _writeWebFile(_path, 0, _dataPoint, _publisher);
    }

    function deletePath(string memory _path) public virtual onlyOwner {
        require(webFiles[_path].length > 0, "WS: Web file does not exist");
        require(
            !webFileMetadata[_path].isImmutable,
            "WS: Web file is immutable"
        );
        webFileMetadata[_path].version++;
        webFileMetadata[_path].size = 0;
        delete webFiles[_path];
    }

    function updateWebFile(
        string memory _path,
        bytes memory _data,
        uint256 _chunk,
        address _publisher
    ) public payable virtual onlyOwner {
        require(bytes(_path).length > 0, "WS: Invalid path");
        bytes32[] storage fileData = webFiles[_path];
        require(fileData.length > 0, "WS: Web file does not exist");

        bytes32 firstAddress = webFiles[_path][0];
        DataPointStructure memory firstStructure = DPS_
            .readDataPoint(firstAddress)
            .structure;
        if (_chunk > 0) {
            require(firstStructure.location == 0x0101, "WS: Invalid chunk");
        }

        DataPoint memory _dataPoint = DataPoint({
            structure: firstStructure,
            data: _data
        });

        _writeWebFile(_path, _chunk, _dataPoint, _publisher);
    }

    function makeFileImmutable(string memory _path) public virtual onlyOwner {
        require(webFiles[_path].length > 0, "WS: Web file does not exist");
        webFileMetadata[_path].isImmutable = true;
    }

    function readWebFile(
        string memory _path
    ) public view returns (bytes32[] memory) {
        return webFiles[_path];
    }

    function getFileInfo(
        string memory _path
    ) public view returns (WebFileMetadata memory) {
        return webFileMetadata[_path];
    }

    /// @dev Emitted when an admin is added
    event AdminAdded(address admin);

    /// @dev Emitted when an admin is removed
    event AdminRemoved(address admin);
}

contract WebServer is WebRegistry {
    StatusMap private STATUS_MAP_;

    enum WTTPMethod {
        GET,
        POST,
        PUT,
        DELETE
    }

    constructor(
        address _statusMap,
        address _typeMap,
        address _dpr,
        address _owner
    ) WebRegistry(_typeMap, _dpr) Ownable(_owner) {
        STATUS_MAP_ = StatusMap(_statusMap);
    }

    struct WTTPRequestLine {
        WTTPMethod method;
        string path;
        uint256 version;
    }

    struct WTTPHeader {
        string mimeType;
        string encoding;
        string location;
        uint256 chunk;
        address publisher;
        string httpHeader;
    }

    struct WTTPBody {
        bytes data;
    }

    function WTTPRequest(
        WTTPRequestLine memory _requestLine,
        WTTPHeader memory _header,
        bytes memory _data
    ) public payable returns (bytes32[] memory) {
        if (_requestLine.method == WTTPMethod.GET) {
            return readWebFile(_requestLine.path);
        } else if (_requestLine.method == WTTPMethod.POST) {
            createWebFile(
                _requestLine.path,
                _header.mimeType,
                _header.encoding,
                _header.location,
                _header.publisher,
                _data
            );
            return readWebFile(_requestLine.path);
        } else if (_requestLine.method == WTTPMethod.PUT) {
            updateWebFile(
                _requestLine.path,
                _data,
                _header.chunk,
                _header.publisher
            );
            return readWebFile(_requestLine.path);
        } else if (_requestLine.method == WTTPMethod.DELETE) {
            deletePath(_requestLine.path);
            return new bytes32[](0);
        }
        revert("Invalid WTTP method");
    }
}
