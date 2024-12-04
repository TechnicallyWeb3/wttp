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
        _grantRole(SITE_ADMIN_ROLE, msg.sender);
        _grantRole(SITE_ADMIN_ROLE, _owner);
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
    PATH
}

function methodsToMask(Method[] memory methods) pure returns (uint16) {
    uint16 mask = 0;
    for (uint i = 0; i < methods.length; i++) {
        mask |= uint16(1 << uint8(methods[i]));
    }
    return mask;
}

struct Redirect {
    uint16 code;
    string location;
}

struct HeaderInfo {
    CacheControl cache;
    uint16 methods;
    Redirect redirect;
    bytes32 resourceAdmin;
}

abstract contract WTTPStorage is WTTPPermissions, ReentrancyGuard {
    DataPointRegistry public DPR_;
    DataPointStorage internal DPS_;

    function getDPS() public view returns (address) {
        return address(DPS_);
    }

    function getDPR() public view returns (address) {
        return address(DPR_);
    }

    constructor(address _dpr, address _owner, HeaderInfo memory _header) WTTPPermissions(_owner) {
        DPR_ = DataPointRegistry(_dpr);
        DPS_ = DPR_.DPS_();

        // If header is not provided, set default values
        if (_header.methods == 0) {
            _header = HeaderInfo({
                cache: CacheControl(0, 0, false, false, false, false, false, 0, 0, false, false),
                methods: 2913,
                redirect: Redirect(0, ""),
                resourceAdmin: bytes32(0)
            });
        }

        bytes32 headerPath = keccak256(abi.encode(_header));
        headerPaths["*"] = headerPath;
        headers[headerPath] = _header;
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

    mapping(string path=> bytes32) private headerPaths;
    mapping(bytes32 header => HeaderInfo) private headers;
    mapping(string path => ResourceMetadata) private resourceMetadata;
    mapping(string path => bytes32[]) private resources;
    mapping(string path => string[]) private directories;
    mapping(string path => mapping(bytes2 language => mapping(bytes2 charset => string variation))) private variations;

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
        HeaderInfo memory _header
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

        emit HeaderUpdated(_path, _header, _header.redirect);
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
            header = headers[headerPaths["*"]];
        } else {
            header = headers[headerPath];
        }
    }

    function _readMetadata(
        string memory _path
    ) internal view returns (ResourceMetadata memory) {
        return resourceMetadata[_path];
    }

    function _readVariation(
        string memory _path,
        bytes2 _language,
        bytes2 _charset
    ) internal view returns (string memory) {
        string memory variation = variations[_path][_language][_charset];
        if (bytes(variation).length == 0) {
            return directories[_path][0];
        }
        return variation;
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

    // input path such as /about with a en-US language and utf-8 charset would resolve to /about/index.en-US.html
    function _createVariation(
        string memory _path,
        bytes2 _language,
        bytes2 _charset,
        string memory _variation
    ) internal {
        variations[_path][_language][_charset] = _variation;
        emit VariationCreated(_path, _language, _charset, _variation);
    }

    // Events
    event HeaderUpdated(string path, HeaderInfo header, Redirect redirect);
    event ResourceCreated(string path, uint256 size, address publisher);
    event ResourceUpdated(string path, uint256 chunk, address publisher);
    event ResourceDeleted(string path);
    event VariationCreated(string path, bytes2 language, bytes2 charset, string variation);
}

struct RequestLine {
    string protocol;
    string path;
}

struct ResponseLine {
    string protocol;
    uint16 code;
}

struct HEADResponse {
    ResponseLine responseLine;
    HeaderInfo headerInfo;
    ResourceMetadata metadata;
    DataPointInfo dataStructure;
    bytes32 etag;
}

struct LOCATEResponse {
    HEADResponse head;
    address dpsAddress;
    bytes32[] dataPoints;
}

struct PUTResponse {
    HEADResponse head;
    address dprAddress;
    bytes32 dataPointAddress;
}

abstract contract WTTPSite is WTTPStorage {

    string public constant WTTP_VERSION = "WTTP/2.0";

    function compatibleWTTPVersion(string memory _wttpVersion) public pure returns (bool) {
        require(
            keccak256(abi.encode(_wttpVersion)) ==
                keccak256(abi.encode(WTTP_VERSION)),
            "WBM: Invalid WTTP version"
        );
        return true;
    }

    constructor(address _dpr, address _owner, HeaderInfo memory _header) WTTPStorage(_dpr, _owner, _header) {}
    
    function _methodAllowed(string memory _path, Method _method) internal view returns (bool) {
        uint16 methodBit = uint16(1 << uint8(_method)); // Create a bitmask for the method
        return (_readHeader(_path).methods & methodBit != 0) || _isResourceAdmin(_path, msg.sender);
    }

    function HEAD(
        RequestLine memory requestLine
    )
        public
        view
        returns (HEADResponse memory head)
    {
        string memory _path = requestLine.path;
        head.headerInfo = _readHeader(_path);
        head.metadata = _readMetadata(_path);
        bytes32[] memory _dataPoints = _readLocation(_path);
        head.etag = keccak256(abi.encode(_dataPoints));

        if (!compatibleWTTPVersion(requestLine.protocol)) {
            head.responseLine = ResponseLine({
                protocol: requestLine.protocol,
                code: 505
            });
        }
        // 400 codes
        else if (_dataPoints.length == 0) {
            head.responseLine = ResponseLine({
                protocol: requestLine.protocol,
                code: 404
            });
        } else if (!_methodAllowed(_path, Method.HEAD)) {
            head.responseLine = ResponseLine({
                protocol: requestLine.protocol,
                code: 405
            });
        } 
        // 300 codes
        else if (head.headerInfo.redirect.code != 0) {
            head.responseLine = ResponseLine({
                protocol: requestLine.protocol,
                code: head.headerInfo.redirect.code
            });
        }
        // 200 codes
        else if (head.metadata.size == 0) {
            head.dataStructure = DPS_.dataPointInfo(_dataPoints[0]);
            head.responseLine = ResponseLine({
                protocol: requestLine.protocol,
                code: 204
            });
        } else if (head.metadata.size > 0) {
            head.dataStructure = DPS_.dataPointInfo(_dataPoints[0]);
            head.responseLine = ResponseLine({
                protocol: requestLine.protocol,
                code: 200
            });
        }
        return head;
    }

    function LOCATE(
        RequestLine memory requestLine
    )
        public
        view
        returns (LOCATEResponse memory locateResponse)
    {
        string memory _path = requestLine.path;
        locateResponse.head = HEAD(requestLine);
        locateResponse.dpsAddress = address(DPS_);
        if (!_methodAllowed(_path, Method.LOCATE)) {
            locateResponse.head.responseLine = ResponseLine({
                protocol: requestLine.protocol,
                code: 405
            });
        } else {
            locateResponse.dataPoints = _readLocation(_path);
        }
    }

    function PATH(
        RequestLine memory requestLine,
        bytes2 _language,
        bytes2 _charset
    ) public view returns (HEADResponse memory pathResponse) {
        string memory _path = requestLine.path;
        if (!_methodAllowed(_path, Method.PATH)) {
            pathResponse.responseLine = ResponseLine({
                protocol: requestLine.protocol,
                code: 405
            });
        } else {
            pathResponse.headerInfo = _readHeader(_path);
            pathResponse.headerInfo.redirect.code = 301;
            pathResponse.headerInfo.redirect.location = _readVariation(_path, _language, _charset);
            pathResponse.metadata = _readMetadata(_path);
            bytes32[] memory _dataPoints = _readLocation(_path);
            pathResponse.dataStructure = DPS_.dataPointInfo(_dataPoints[0]);
            pathResponse.etag = keccak256(abi.encode(_dataPoints));
        }
        return pathResponse;
    }

    function DEFINE(
        RequestLine memory _requestLine,
        HeaderInfo memory _header
    ) public returns (HEADResponse memory defineResponse) {
        string memory _path = _requestLine.path;
        if (_methodAllowed(_path, Method.DEFINE)) {
            _writeHeader(_path, _header);
            defineResponse = HEAD(_requestLine);
        } else {
            defineResponse.responseLine = ResponseLine({
                protocol: _requestLine.protocol,
                code: 405
            });
        }

        emit DEFINESuccess(msg.sender, _requestLine, defineResponse);
    }

    function DELETE(
        RequestLine memory _requestLine
    ) public returns (HEADResponse memory deleteResponse) {
        string memory _path = _requestLine.path;
        if (_methodAllowed(_path, Method.DELETE)) {
            _deleteResource(_path);
            deleteResponse = HEAD(_requestLine);
        } else {
            deleteResponse.responseLine = ResponseLine({
                protocol: _requestLine.protocol,
                code: 405
            });
        }

        emit DELETESuccess(msg.sender, _requestLine, deleteResponse);
    }

    function PUT(
        RequestLine memory _requestLine,
        bytes2 _mimeType,
        bytes2 _charset,
        bytes2 _location,
        address _publisher,
        bytes memory _data
    ) public payable returns (PUTResponse memory putResponse) {
        string memory _path = _requestLine.path;
        if (_methodAllowed(_path, Method.PUT)) {
            putResponse.dataPointAddress =
                _createResource(
                _path,
                _mimeType,
                _charset,
                _location,
                _publisher,
                _data
            );
            putResponse.head = HEAD(_requestLine);
            putResponse.head.responseLine = ResponseLine({
                protocol: _requestLine.protocol,
                code: 201
            });
        } else {
            putResponse.head.responseLine = ResponseLine({
                protocol: _requestLine.protocol,
                code: 405
            });
        }

        emit PUTSuccess(msg.sender, _requestLine, putResponse);
    }

    function PATCH(
        RequestLine memory _requestLine,
        bytes memory _data,
        uint256 _chunk,
        address _publisher
    ) public payable returns (PUTResponse memory patchResponse) {
        string memory _path = _requestLine.path;
        if (_methodAllowed(_path, Method.PATCH)) {
            patchResponse.dataPointAddress = _updateResource(_path, _data, _chunk, _publisher);
            patchResponse.head = HEAD(_requestLine);
        } else {
            patchResponse.head.responseLine = ResponseLine({
                protocol: _requestLine.protocol,
                code: 405
            });
        }

        emit PATCHSuccess(msg.sender, _requestLine, patchResponse);
    }

    // Define events
    event PATCHSuccess(address indexed publisher, RequestLine requestLine, PUTResponse patchResponse);
    event PUTSuccess(address indexed publisher, RequestLine requestLine, PUTResponse putResponse);
    event DELETESuccess(address indexed publisher, RequestLine requestLine, HEADResponse deleteResponse);
    event DEFINESuccess(address indexed publisher, RequestLine requestLine, HEADResponse defineResponse);
}
