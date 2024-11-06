// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "./WebStorage.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

abstract contract WTTPPermissions is AccessControl {

    bytes32 internal constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 internal constant SITE_ADMIN_ROLE = keccak256("SITE_ADMIN_ROLE");

    constructor(address _owner) {
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _grantRole(OWNER_ROLE, _owner);
        _setRoleAdmin(SITE_ADMIN_ROLE, OWNER_ROLE);
        grantRole(SITE_ADMIN_ROLE, _owner);
    }

    function _isSiteAdmin(address _admin) internal view returns (bool) {
        return hasRole(SITE_ADMIN_ROLE, _admin);
    }

    // Admin functions
    modifier onlySiteAdmin() {
        require(_isSiteAdmin(msg.sender), "Caller must be site admin");
        _;
    }

    // Allows site admins to create resource-specific admin roles
    // modifier not needed since only site admins can use grantRole
    function createResourceRole(string memory roleName) public {
        bytes32 role = keccak256(abi.encodePacked(roleName));
        _setRoleAdmin(role, SITE_ADMIN_ROLE);
        grantRole(role, msg.sender);
    }

    // Events
    event AdminAdded(string indexed path, bytes32 indexed adminRole);
    event AdminRemoved(string indexed path, bytes32 indexed adminRole);
}


struct ResourceMetadata {
    uint256 size;
    uint256 version;
    uint256 modifiedDate;
    uint16 redirect;
}

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

enum Method {
    GET,
    POST,
    PUT,
    DELETE,
    PATCH,
    HEAD,
    OPTIONS,
    CONNECT,
    TRACE,
    LOCATE,
    DEFINE,
    INFO
}

struct HeaderInfo {
    CacheControl cache;
    uint16 methods;
    bytes32 resourceAdmin;
}

abstract contract WTTPStorage is WTTPPermissions, ReentrancyGuard {
    DataPointRegistry internal DPR_;
    DataPointStorage internal DPS_;

    constructor(address _dpr, address _owner) WTTPPermissions(_owner) {
        DPR_ = DataPointRegistry(_dpr);
        DPS_ = DPR_.DPS_();
    }

    /// @notice Checks if an address has admin rights for a specific resource
    /// @param _path The resource path to check
    /// @param _admin Address to check
    /// @return bool indicating whether the address has admin rights
    function _isResourceAdmin(
        string memory _path,
        address _admin
    ) internal view returns (bool) {
        return hasRole(headers[headerPaths[_path]].resourceAdmin, _admin);
    }

    // Update the onlyAdmin modifier to check for resource-specific access
    modifier onlyResourceAdmin(string memory _path) {
        require(
            _isSiteAdmin(msg.sender) || _isResourceAdmin(_path, msg.sender),
            "Caller is not a resource admin"
        );
        _;
    }

    mapping(string => bytes32) private headerPaths;
    mapping(bytes32 => HeaderInfo) private headers;
    mapping(string => ResourceMetadata) private resourceMetadata;
    mapping(string => bytes32[]) private resources;

    modifier pathModifiable(string memory _path) {
        require(
            _readHeader(_path).cache.immutableFlag == false,
            "WS/pathModifiable: Path is immutable"
        );
        _;
    }

    modifier pathExists(string memory _path) {
        require(bytes(_path).length > 0, "WS/pathExists: Invalid path");
        require(
            resources[_path].length > 0,
            "WS/pathExists: Path does not exist"
        );
        _;
    }

    modifier pathDoesNotExist(string memory _path) {
        bytes memory path = bytes(_path);
        require(path.length > 0, "WS/pathDoesNotExist: Invalid path");
        require(keccak256(path) != keccak256(bytes("*")), "WS/pathDoesNotExist: Wildcard does not exist");
        require(
            resources[_path].length == 0,
            "WS/pathDoesNotExist: Path already exists"
        );
        _;
    }

    // Public functions
    // defines a resource header
    function _writeHeader(
        string memory _path,
        HeaderInfo memory _header,
        uint16 _redirect
    )
        internal
        virtual
        onlyResourceAdmin(_path)
        pathExists(_path)
        pathModifiable(_path)
    {
        bytes32 headerPath = keccak256(abi.encode(_header));
        headerPaths[_path] = headerPath;
        if (!_isSiteAdmin(msg.sender)) {
            bytes32 _resourceAdmin = headers[headerPath].resourceAdmin;
            headers[headerPath] = _header;
            // leave the resource admin as is, only site admins can change it
            headers[headerPath].resourceAdmin = _resourceAdmin;
        } else {
            headers[headerPath] = _header;
        }

        resourceMetadata[_path].redirect = _redirect;

        emit HeaderUpdated(_path, _header, _redirect);
    }

    // Returns all the datapoint addresses for a given resource
    function _readLocation(
        string memory _path
    ) internal view returns (bytes32[] memory) {
        return resources[_path];
    }

    function _readHeader(
        string memory _path
    ) internal view returns (HeaderInfo memory header) {
        bytes32 headerPath = headerPaths[_path];

        if (headerPath == bytes32(0)) {
            header = headers[bytes32("*")];
        } else {
            header = headers[headerPath];
        }
    }

    function _readMetadata(
        string memory _path
    ) internal view returns (ResourceMetadata memory) {
        return resourceMetadata[_path];
    }

    // Internal CRUD functions
    // Writes a data point to the resource, used by both create and update
    function _writeResource(
        string memory _path,
        uint256 _chunk,
        DataPoint memory _dataPoint,
        address _publisher
    )
        internal
        virtual
        nonReentrant
        onlyResourceAdmin(_path)
        pathModifiable(_path)
        returns (bytes32 dataPointAddress)
    {
        uint256 resourceLength = resources[_path].length;
        require(
            _chunk <= resourceLength,
            "WS/writeResource: Chunk index out of bounds"
        );

        // initialize to the original file size
        uint256 newResourceSize = resourceMetadata[_path].size;

        dataPointAddress = DPR_.writeDataPoint{value: msg.value}(
            _dataPoint,
            _publisher
        );

        if (_chunk == resourceLength) {
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

    // Creates a new resource path and writes the first data point
    function _createResource(
        string memory _path,
        bytes2 _mimeType,
        bytes2 _charset,
        bytes2 _location,
        address _publisher,
        bytes memory _data
    ) internal virtual pathDoesNotExist(_path) returns (bytes32) {
        DataPoint memory _dataPoint = DataPoint({
            structure: DataPointStructure({
                mimeType: _mimeType,
                charset: _charset,
                location: _location
            }),
            data: _data
        });

        emit ResourceCreated(_path, _data.length, _publisher);
        return _writeResource(_path, 0, _dataPoint, _publisher);
    }

    function _updateResource(
        string memory _path,
        bytes memory _data,
        uint256 _chunk,
        address _publisher
    ) internal virtual pathExists(_path) returns (bytes32) {

        bytes32 firstAddress = resources[_path][0];
        DataPointStructure memory firstStructure = DPS_
            .readDataPoint(firstAddress)
            .structure;
        if (_chunk > 0) {
            require(
                firstStructure.location == 0x0101,
                "WS/updateResource: Invalid chunk"
            );
        }

        DataPoint memory _dataPoint = DataPoint({
            structure: firstStructure,
            data: _data
        });

        emit ResourceUpdated(_path, _chunk, _publisher);
        return _writeResource(_path, _chunk, _dataPoint, _publisher);
    }

    function _deleteResource(
        string memory _path
    )
        internal
        virtual
        onlyResourceAdmin(_path)
        pathExists(_path)
        pathModifiable(_path)
    {
        resourceMetadata[_path].version++;
        resourceMetadata[_path].size = 0;
        resourceMetadata[_path].modifiedDate = block.timestamp;
        delete resources[_path];
        delete headerPaths[_path];
        emit ResourceDeleted(_path);
    }

    // Events
    event HeaderUpdated(string path, HeaderInfo header, uint16 redirect);
    event ResourceCreated(string path, uint256 size, address publisher);
    event ResourceUpdated(string path, uint256 chunk, address publisher);
    event ResourceDeleted(string path);
}

struct InfoResponse {
    HeaderInfo headerInfo;
    ResourceMetadata metadata;
}

abstract contract WTTPBaseMethods is WTTPStorage {

    string public constant WTTP_VERSION = "WTTP/2.0";

    function compatibleWTTPVersion(string memory _wttpVersion) public pure returns (bool) {
        require(
            keccak256(abi.encode(_wttpVersion)) ==
                keccak256(abi.encode(WTTP_VERSION)),
            "WBM: Invalid WTTP version"
        );
        return true;
    }

    constructor(address _dpr, address _owner) WTTPStorage(_dpr, _owner) {}

    modifier methodAllowed(string memory _path, Method _method) {
        uint16 methodBit = uint16(1 << uint8(_method)); // Create a bitmask for the method
        require(
            (_readHeader(_path).methods & methodBit != 0) ||
                _isResourceAdmin(_path, msg.sender),
            "WBM: Method not allowed"
        );
        _;
    }

    function INFO(
        string memory _path
    )
        public
        view
        pathExists(_path)
        methodAllowed(_path, Method.INFO)
        returns (InfoResponse memory infoResponse)
    {
        infoResponse.headerInfo = _readHeader(_path);
        infoResponse.metadata = _readMetadata(_path);
        return infoResponse;
    }

    function LOCATE(
        string memory _path
    )
        public
        view
        pathExists(_path)
        methodAllowed(_path, Method.LOCATE)
        returns (bytes32[] memory)
    {
        return _readLocation(_path);
    }

    function DEFINE(
        string memory _path,
        HeaderInfo memory _header,
        uint16 _redirect
    ) public methodAllowed(_path, Method.DEFINE) {
        _writeHeader(_path, _header, _redirect);
    }

    function DELETE(
        string memory _path
    ) public methodAllowed(_path, Method.DELETE) {
        _deleteResource(_path);
    }

    function PUT(
        string memory _path,
        bytes2 _mimeType,
        bytes2 _charset,
        bytes2 _location,
        address _publisher,
        bytes memory _data
    ) public payable methodAllowed(_path, Method.PUT) returns (bytes32) {
        return
            _createResource(
                _path,
                _mimeType,
                _charset,
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
    ) public payable methodAllowed(_path, Method.PATCH) returns (bytes32) {
        return _updateResource(_path, _data, _chunk, _publisher);
    }
}

// TW3 Implementation of WTTP
abstract contract WebContract is WTTPBaseMethods {
    // TW3 Public Data Point Registry
    DataPointRegistry public immutable DPR = DataPointRegistry(0x0000000000000000000000000000000000000000);

    constructor() WTTPBaseMethods(address(DPR), msg.sender) {}

}
