// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import {TypeMap, TypeCategory} from "./TypeMap.sol";
import {StatusMap} from "./StatusMap.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

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

    function calculateAddress(
        DataPoint memory _dataPoint
    ) public pure returns (bytes32) {
        return getDataPointAddress(_dataPoint);
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
                royalty.publisher = _publisher;
            }
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
    TypeMap internal TYPE_MAP_;
    DataPointRegistry internal DPR_;
    DataPointStorage internal DPS_;

    constructor(
        address _typeMap,
        address _dpr,
        address _owner
    ) Ownable(_owner) {
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

    struct ResourceMetadata {
        uint256 size;
        uint256 version;
        uint256 modifiedDate;
        bool isImmutable;
    }

    mapping(string => ResourceMetadata) private resourceMetadata;
    mapping(string => bytes32[]) private resources;

    function _MAX_RESOURCE_SIZE() internal view virtual returns (uint256) {
        return 128000; // 128KB
    }

    function _writeResource(
        string memory _path,
        uint256 _chunk,
        DataPoint memory _dataPoint,
        address _publisher
    ) internal virtual returns (bytes32 dataPointAddress) {
        require(
            !resourceMetadata[_path].isImmutable,
            "WS: Web file is immutable"
        );
        require(
            _chunk <= resources[_path].length,
            "WS: Chunk index out of bounds"
        );
        require(
            _dataPoint.data.length <= _MAX_RESOURCE_SIZE(),
            "WS: Data point too large"
        );

        // initialize to the original file size
        uint256 newResourceSize = resourceMetadata[_path].size;

        dataPointAddress = DPR_.writeDataPoint{value: msg.value}(
            _dataPoint,
            _publisher
        );

        if (_chunk == resources[_path].length) {
            resources[_path].push(dataPointAddress);
            newResourceSize += _dataPoint.data.length;
        } else {
            uint256 originalChunkSize = DPS_
                .dataPointInfo(resources[_path][_chunk])
                .size;
            newResourceSize =
                newResourceSize -
                originalChunkSize +
                _dataPoint.data.length;
            resources[_path][_chunk] = dataPointAddress;
        }

        resourceMetadata[_path].size = newResourceSize;
        resourceMetadata[_path].version++;
        resourceMetadata[_path].modifiedDate = block.timestamp;
    }

    function _createResource(
        string memory _path,
        string memory _mimeType,
        string memory _encoding,
        string memory _location,
        address _publisher,
        bytes memory _data
    ) internal virtual onlyOwner returns (bytes32) {
        require(bytes(_path).length > 0, "WS: Invalid path");
        require(resources[_path].length == 0, "WS: Web file already exists");

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

        return _writeResource(_path, 0, _dataPoint, _publisher);
    }

    function _deleteResource(string memory _path) internal virtual onlyOwner {
        require(resources[_path].length > 0, "WS: Web file does not exist");
        require(
            !resourceMetadata[_path].isImmutable,
            "WS: Web file is immutable"
        );
        resourceMetadata[_path].version++;
        resourceMetadata[_path].size = 0;
        resourceMetadata[_path].modifiedDate = block.timestamp;
        delete resources[_path];
    }

    function _updateResource(
        string memory _path,
        bytes memory _data,
        uint256 _chunk,
        address _publisher
    ) internal virtual onlyAdmin returns (bytes32) {
        require(bytes(_path).length > 0, "WS: Invalid path");
        bytes32[] storage fileData = resources[_path];
        require(fileData.length > 0, "WS: Web file does not exist");

        bytes32 firstAddress = resources[_path][0];
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

        return _writeResource(_path, _chunk, _dataPoint, _publisher);
    }

    function makeResourceImmutable(
        string memory _path
    ) public virtual onlyOwner {
        require(resources[_path].length > 0, "WS: Web file does not exist");
        resourceMetadata[_path].isImmutable = true;
    }

    function getResourceData(
        string memory _path
    ) public view returns (bytes32[] memory) {
        return resources[_path];
    }

    function getResourceInfo(
        string memory _path
    ) public view returns (ResourceMetadata memory) {
        return resourceMetadata[_path];
    }

    /// @dev Emitted when an admin is added
    event AdminAdded(address admin);

    /// @dev Emitted when an admin is removed
    event AdminRemoved(address admin);
}

struct RequestLine {
    string protocol;
    string path;
    uint16 code;
    string reason;
}

contract WebServer is WebRegistry {
    StatusMap private STATUS_MAP_;

    // Struct to hold Cache-Control settings
    struct CacheControl {
        uint256 maxAge; // max-age directive in seconds (0 if not set)
        uint256 sMaxage; // s-maxage directive in seconds (0 if not set)
        bool noStore; // no-store directive
        bool noCache; // no-cache directive
        bool immutableFlag; // immutable directive
        bool mustRevalidate; // must-revalidate directive
        bool proxyRevalidate; // proxy-revalidate directive
        uint256 staleWhileRevalidate; // stale-while-revalidate directive in seconds (0 if not set)
        uint256 staleIfError; // stale-if-error directive in seconds (0 if not set)
        bool publicFlag; // public directive
        bool privateFlag; // private directive
    }

    struct AllowedMethods {
        bool GET;
        bool HEAD;
        bool PUT;
        bool PATCH;
        bool DELETE;
    }

    struct HeaderInfo {
        CacheControl cache;
        AllowedMethods allowed;
    }

    mapping(string => HeaderInfo) private headers;

    function setHeader(
        string memory _path,
        HeaderInfo memory _header
    ) public virtual onlyAdmin {
        headers[_path] = _header;
    }

    constructor(
        address _statusMap,
        address _typeMap,
        address _dpr,
        address _owner
    ) WebRegistry(_typeMap, _dpr, _owner) {
        STATUS_MAP_ = StatusMap(_statusMap);
    }

    function _assembleCacheControl(
        CacheControl memory _cache
    ) internal pure returns (string memory) {
        string memory cacheControl;
        string memory delimiter;
        if (_cache.maxAge > 0) {
            cacheControl = string.concat(
                "max-age=",
                Strings.toString(_cache.maxAge)
            );
        }
        if (_cache.sMaxage > 0) {
            delimiter = bytes(cacheControl).length > 0 ? ", " : "";
            cacheControl = string.concat(
                cacheControl,
                delimiter,
                "s-maxage=",
                Strings.toString(_cache.sMaxage)
            );
        }
        if (_cache.noStore) {
            delimiter = bytes(cacheControl).length > 0 ? ", " : "";
            cacheControl = string.concat(cacheControl, delimiter, "no-store");
        }
        if (_cache.noCache) {
            delimiter = bytes(cacheControl).length > 0 ? ", " : "";
            cacheControl = string.concat(cacheControl, delimiter, "no-cache");
        }
        if (_cache.immutableFlag) {
            delimiter = bytes(cacheControl).length > 0 ? ", " : "";
            cacheControl = string.concat(cacheControl, ", immutable");
        }
        if (_cache.mustRevalidate) {
            delimiter = bytes(cacheControl).length > 0 ? ", " : "";
            cacheControl = string.concat(
                cacheControl,
                delimiter,
                "must-revalidate"
            );
        }
        if (_cache.proxyRevalidate) {
            delimiter = bytes(cacheControl).length > 0 ? ", " : "";
            cacheControl = string.concat(cacheControl, ", proxy-revalidate");
        }
        if (_cache.staleWhileRevalidate > 0) {
            delimiter = bytes(cacheControl).length > 0 ? ", " : "";
            cacheControl = string.concat(
                cacheControl,
                delimiter,
                "stale-while-revalidate=",
                Strings.toString(_cache.staleWhileRevalidate)
            );
        }
        if (_cache.staleIfError > 0) {
            delimiter = bytes(cacheControl).length > 0 ? ", " : "";
            cacheControl = string.concat(
                cacheControl,
                ", stale-if-error=",
                Strings.toString(_cache.staleIfError)
            );
        }
        if (_cache.publicFlag) {
            delimiter = bytes(cacheControl).length > 0 ? ", " : "";
            cacheControl = string.concat(cacheControl, delimiter, "public");
        }
        return cacheControl;
    }

    function _assembleAllowedMethods(
        AllowedMethods memory _allowed
    ) internal pure returns (string memory) {
        string memory allowedMethods;
        string memory delimiter;
        if (_allowed.GET) {
            allowedMethods = string.concat(allowedMethods, "GET");
        }
        if (_allowed.HEAD) {
            delimiter = bytes(allowedMethods).length > 0 ? ", " : "";
            allowedMethods = string.concat(allowedMethods, delimiter, "HEAD");
        }
        if (_allowed.PUT) {
            delimiter = bytes(allowedMethods).length > 0 ? ", " : "";
            allowedMethods = string.concat(allowedMethods, delimiter, "PUT");
        }
        if (_allowed.PATCH) {
            delimiter = bytes(allowedMethods).length > 0 ? ", " : "";
            allowedMethods = string.concat(allowedMethods, delimiter, "PATCH");
        }
        if (_allowed.DELETE) {
            delimiter = bytes(allowedMethods).length > 0 ? ", " : "";
            allowedMethods = string.concat(allowedMethods, delimiter, "DELETE");
        }
        return allowedMethods;
    }

    function _assembleHeader(
        string memory _path
    ) internal view returns (string memory) {
        HeaderInfo memory header = headers[_path];
        bytes32[] memory resourceData = getResourceData(_path);
        string memory headerData = string.concat(
            "Content-Type: ",
            TYPE_MAP_.getTypeString(
                TypeCategory.MIME_TYPE,
                DPS_.readDataPoint(resourceData[0]).structure.mimeType
            ),
            "\n",
            "Content-Length: ",
            Strings.toString(getResourceInfo(_path).size),
            "\n",
            "Last-Modified: ",
            Strings.toString(getResourceInfo(_path).modifiedDate),
            "\n",
            "ETag: ",
            Strings.toHexString(
                uint256(keccak256(abi.encodePacked(resourceData)))
            ),
            "\n",
            "Accept-Ranges: ",
            resourceData.length > 1 ? "bytes" : "none"
        );
        string memory cacheData = _assembleCacheControl(header.cache);
        if (bytes(cacheData).length > 0) {
            headerData = string.concat(
                headerData,
                "\n",
                "Cache-Control: ",
                cacheData
            );
        }
        string memory allowedMethods = _assembleAllowedMethods(header.allowed);
        if (bytes(allowedMethods).length > 0) {
            headerData = string.concat(
                headerData,
                "\n",
                "Allow: ",
                allowedMethods
            );
        }
        return headerData;
    }

    function _assembleData(
        string memory _path,
        uint256 startBytes,
        uint256 endBytes
    ) internal view returns (bytes memory) {
        ResourceMetadata memory metadata = getResourceInfo(_path);
        uint256 totalSize = metadata.size;

        if (endBytes == 0 || endBytes > totalSize) {
            endBytes = totalSize;
        }

        require(startBytes <= endBytes, "WS: Invalid range");

        uint256 length = endBytes - startBytes;

        if (length > _MAX_RESOURCE_SIZE()) {
            length = _MAX_RESOURCE_SIZE();
            endBytes = startBytes + length;
        }

        bytes memory result = new bytes(length);
        bytes32[] memory resourceData = getResourceData(_path);

        uint256 startOffset;
        uint256 endOffset;

        uint256 locateBytes;
        uint256 chunkSize;

        for (uint256 i = 0; i < resourceData.length; i++) {
            bytes memory chunkData;

            if (result.length == 0) {
                chunkSize = DPS_.dataPointInfo(resourceData[i]).size;
            }

            locateBytes += chunkSize;

            if (
                locateBytes >= startBytes && locateBytes < endBytes + chunkSize
            ) {
                chunkData = DPS_.readDataPoint(resourceData[i]).data;
                chunkSize = chunkData.length;

                if (locateBytes >= endBytes) {
                    uint256 chunkStart = locateBytes - startBytes;
                    endOffset = endBytes - chunkStart;
                    if (endOffset > 0) {
                        chunkData = _sliceBytes(chunkData, 0, endOffset);
                    }

                    if (startBytes > chunkStart) {
                        chunkData = _sliceBytes(
                            chunkData,
                            chunkStart,
                            chunkData.length - 1
                        );
                    }

                    result = abi.encodePacked(result, chunkData);
                    break;
                }

                if (result.length == 0) {
                    startOffset = locateBytes - startBytes;
                    if (startOffset > 0) {
                        result = _sliceBytes(chunkData, startOffset, chunkSize);
                    } else {
                        result = chunkData;
                    }
                } else {
                    result = abi.encodePacked(result, chunkData);
                }
            } 
        }

        return result;
    }

    function _sliceBytes(
        bytes memory data,
        uint256 start,
        uint256 end
    ) private pure returns (bytes memory) {
        bytes memory result = new bytes(end - start);
        for (uint256 i = 0; i < end - start; i++) {
            result[i] = data[i + start];
        }
        return result;
    }

    function HEAD(
        string memory _path
    ) public view returns (RequestLine memory, string memory) {
        ResourceMetadata memory metadata = getResourceInfo(_path);

        if (metadata.size == 0) {
            return (
                RequestLine({
                    protocol: "WTTP/1.0",
                    path: _path,
                    code: 404,
                    reason: "Not Found"
                }),
                ""
            );
        }

        string memory headerData = _assembleHeader(_path);

        return (
            RequestLine({
                protocol: "WTTP/1.0",
                path: _path,
                code: 200,
                reason: "OK"
            }),
            headerData
        );
    }

    function GET(
        string memory _path,
        uint256 startIndex,
        uint256 endIndex
    ) public view returns (RequestLine memory, string memory, bytes memory) {
        ResourceMetadata memory metadata = getResourceInfo(_path);

        if (metadata.size == 0) {
            return (
                RequestLine({
                    protocol: "WTTP/1.0",
                    path: _path,
                    code: 404,
                    reason: "Not Found"
                }),
                "",
                new bytes(0)
            );
        }

        bytes memory assembledData = _assembleData(_path, startIndex, endIndex);
        string memory headerData = _assembleHeader(_path);

        uint16 statusCode;
        string memory statusReason;

        if (
            startIndex > 0 ||
            endIndex > 0 ||
            metadata.size > _MAX_RESOURCE_SIZE()
        ) {
            statusCode = 206;
            statusReason = "Partial Content";
            if (endIndex == 0 || endIndex > metadata.size) {
                endIndex = metadata.size;
            }
            headerData = string.concat(
                headerData,
                "\nContent-Range: bytes ",
                Strings.toString(startIndex),
                "-",
                Strings.toString(endIndex),
                "/",
                Strings.toString(metadata.size)
            );
        } else {
            statusCode = 200;
            statusReason = "OK";
        }

        return (
            RequestLine({
                protocol: "WTTP/1.0",
                path: _path,
                code: statusCode,
                reason: statusReason
            }),
            headerData,
            assembledData
        );
    }

    function PUT(
        string memory _path,
        string memory _mimeType,
        string memory _encoding,
        string memory _location,
        address _publisher,
        bytes memory _data
    ) public payable returns (bytes32) {
        return
            _createResource(
                _path,
                _mimeType,
                _encoding,
                _location,
                _publisher,
                _data
            );
    }

    function PATCH(
        string memory _path,
        bytes memory _data,
        uint256 _chunk,
        address _publisher
    ) public payable returns (bytes32) {
        return _updateResource(_path, _data, _chunk, _publisher);
    }

    function DELETE(string memory _path) public virtual {
        _deleteResource(_path);
    }
}
