// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "./WebStorage.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title WTTP Permissions Contract
/// @notice Manages role-based access control for the WTTP protocol
/// @dev Extends OpenZeppelin's AccessControl with site-specific roles
abstract contract WTTPPermissions is AccessControl {

    /// @notice Role identifier for contract owner
    bytes32 internal constant OWNER_ROLE = keccak256("OWNER_ROLE");
    /// @notice Role identifier for site administrators
    bytes32 internal constant SITE_ADMIN_ROLE = keccak256("SITE_ADMIN_ROLE");

    /// @notice Sets up initial roles and permissions
    /// @param _owner Address of the contract owner
    constructor(address _owner) {
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _grantRole(OWNER_ROLE, _owner);
        _setRoleAdmin(SITE_ADMIN_ROLE, OWNER_ROLE);
        _grantRole(SITE_ADMIN_ROLE, msg.sender);
        _grantRole(SITE_ADMIN_ROLE, _owner);
    }

    /// @notice Checks if an address has site admin privileges
    /// @param _admin Address to check
    /// @return bool True if address is a site admin
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

/// @title Resource Metadata Structure
/// @notice Stores metadata about web resources
/// @dev Used to track resource versions and modifications
struct ResourceMetadata {
    /// @notice Size of the resource in bytes
    uint256 size;
    /// @notice Version number of the resource
    uint256 version;
    /// @notice Timestamp of last modification
    uint256 modifiedDate;
}

/// @title Cache Control Structure
/// @notice Defines HTTP cache control directives
/// @dev Maps to standard HTTP cache-control header fields
struct CacheControl {
    /// @notice Maximum age in seconds for client caching
    uint256 maxAge;
    /// @notice Maximum age in seconds for shared caching
    uint256 sMaxage;
    /// @notice Prevents storing the response
    bool noStore;
    /// @notice Requires validation before using cached copy
    bool noCache;
    /// @notice Indicates resource will never change
    bool immutableFlag;
    /// @notice Requires revalidation after becoming stale
    bool mustRevalidate;
    /// @notice Requires proxy revalidation
    bool proxyRevalidate;
    /// @notice Grace period for serving stale content during revalidation
    uint256 staleWhileRevalidate;
    /// @notice Grace period for serving stale content during errors
    uint256 staleIfError;
    /// @notice Indicates response may be cached by any cache
    bool publicFlag;
    /// @notice Indicates response is intended for single user
    bool privateFlag;
}

/// @title HTTP Methods Enum
/// @notice Defines supported HTTP methods
/// @dev Used for method-based access control
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

/// @notice Converts array of methods to bitmask
/// @dev Used for efficient method permission storage
/// @param methods Array of HTTP methods to convert
/// @return uint16 Bitmask representing allowed methods
function methodsToMask(Method[] memory methods) pure returns (uint16) {
    uint16 mask = 0;
    for (uint i = 0; i < methods.length; i++) {
        mask |= uint16(1 << uint8(methods[i]));
    }
    return mask;
}

/// @title Redirect Structure
/// @notice Defines HTTP redirect information
/// @dev Maps to standard HTTP redirect response
struct Redirect {
    /// @notice HTTP status code for redirect
    uint16 code;
    /// @notice Target location for redirect
    string location;
}

/// @title Header Information Structure
/// @notice Combines all HTTP header related information
/// @dev Used for resource header management
struct HeaderInfo {
    /// @notice Cache control directives
    CacheControl cache;
    /// @notice Allowed HTTP methods bitmask
    uint16 methods;
    /// @notice Redirect information
    Redirect redirect;
    /// @notice Resource administrator role
    bytes32 resourceAdmin;
}

/// @title WTTP Storage Contract
/// @notice Manages web resource storage and access control
/// @dev Core storage functionality for the WTTP protocol
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

/// @title HTTP Request Line Structure
/// @notice Represents the first line of an HTTP request
/// @dev Contains protocol version and resource path
struct RequestLine {
    /// @notice Protocol version (e.g., "WTTP/2.0")
    string protocol;
    /// @notice Resource path being requested
    string path;
}

/// @title HTTP Response Line Structure
/// @notice Represents the first line of an HTTP response
/// @dev Contains protocol version and status code
struct ResponseLine {
    /// @notice Protocol version (e.g., "WTTP/2.0")
    string protocol;
    /// @notice HTTP status code (e.g., 200, 404)
    uint16 code;
}

/// @title HEAD Response Structure
/// @notice Contains metadata and header information for HEAD requests
/// @dev Used as base response type for other methods
struct HEADResponse {
    /// @notice Response status line
    ResponseLine responseLine;
    /// @notice Resource header information
    HeaderInfo headerInfo;
    /// @notice Resource metadata
    ResourceMetadata metadata;
    /// @notice Data point structural information
    DataPointInfo dataStructure;
    /// @notice Resource content hash
    bytes32 etag;
}

/// @title LOCATE Response Structure
/// @notice Extended response for LOCATE requests
/// @dev Includes storage addresses and data point locations
struct LOCATEResponse {
    /// @notice Base HEAD response
    HEADResponse head;
    /// @notice Address of data point storage contract
    address dpsAddress;
    /// @notice Array of data point addresses
    bytes32[] dataPoints;
}

/// @title PUT Response Structure
/// @notice Extended response for PUT/PATCH requests
/// @dev Includes registry information and data point address
struct PUTResponse {
    /// @notice Base HEAD response
    HEADResponse head;
    /// @notice Address of data point registry
    address dprAddress;
    /// @notice Address of created/updated data point
    bytes32 dataPointAddress;
}

/// @title WTTP Site Contract
/// @notice Implements core WTTP protocol methods
/// @dev Handles HTTP-like operations on the blockchain
abstract contract WTTPSite is WTTPStorage {

    /// @notice Current version of the WTTP protocol
    string public constant WTTP_VERSION = "WTTP/2.0";

    /// @notice Checks WTTP version compatibility
    /// @param _wttpVersion Protocol version to check
    /// @return bool True if version is compatible
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

    /// @notice Handles HTTP HEAD requests
    /// @param requestLine Request information
    /// @return head Response with header information
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
        else if (!_methodAllowed(_path, Method.HEAD)) {
            head.responseLine = ResponseLine({
                protocol: requestLine.protocol,
                code: 405
            });
        } else if (_dataPoints.length == 0) {
            head.responseLine = ResponseLine({
                protocol: requestLine.protocol,
                code: 404
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

    /// @notice Handles LOCATE requests to find resource storage locations
    /// @dev Returns storage contract address and data point addresses
    /// @param requestLine Request information
    /// @return locateResponse Response containing storage locations
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

    /// @notice Handles PATH requests for content negotiation
    /// @dev Returns resolved path based on language and charset preferences
    /// @param requestLine Request information
    /// @param _language Preferred language code
    /// @param _charset Preferred character set
    /// @return pathResponse Response containing resolved path
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

    /// @notice Handles DEFINE requests to update resource headers
    /// @dev Only accessible to resource administrators
    /// @param _requestLine Request information
    /// @param _header New header information
    /// @return defineResponse Response containing updated header information
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

    /// @notice Handles DELETE requests to remove resources
    /// @dev Only accessible to resource administrators
    /// @param _requestLine Request information
    /// @return deleteResponse Response confirming deletion
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

    /// @notice Handles PUT requests to create new resources
    /// @dev Requires payment for storage costs
    /// @param _requestLine Request information
    /// @param _mimeType Resource MIME type
    /// @param _charset Character encoding
    /// @param _location Storage location type
    /// @param _publisher Content publisher address
    /// @param _data Resource content
    /// @return putResponse Response containing created resource information
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

    /// @notice Handles PATCH requests to update existing resources
    /// @dev Requires payment for storage costs
    /// @param _requestLine Request information
    /// @param _data Updated content
    /// @param _chunk Chunk index for partial updates
    /// @param _publisher Content publisher address
    /// @return patchResponse Response containing updated resource information
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
    /// @notice Emitted when a PATCH request succeeds
    /// @param publisher Address of content publisher
    /// @param requestLine Original request information
    /// @param patchResponse Response details
    event PATCHSuccess(address indexed publisher, RequestLine requestLine, PUTResponse patchResponse);

    /// @notice Emitted when a PUT request succeeds
    /// @param publisher Address of content publisher
    /// @param requestLine Original request information
    /// @param putResponse Response details
    event PUTSuccess(address indexed publisher, RequestLine requestLine, PUTResponse putResponse);

    /// @notice Emitted when a DELETE request succeeds
    /// @param publisher Address of content publisher
    /// @param requestLine Original request information
    /// @param deleteResponse Response details
    event DELETESuccess(address indexed publisher, RequestLine requestLine, HEADResponse deleteResponse);

    /// @notice Emitted when a DEFINE request succeeds
    /// @param publisher Address of content publisher
    /// @param requestLine Original request information
    /// @param defineResponse Response details
    event DEFINESuccess(address indexed publisher, RequestLine requestLine, HEADResponse defineResponse);
}
