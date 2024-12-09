// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "./WebStorage.sol";
import "./WebContract.sol";

/// @title WTTP (Web3 Transfer Protocol)
/// @notice Main interface for interacting with decentralized web resources on the blockchain
/// @dev Implements HTTP-like methods for retrieving and managing web content from WTTPSite contracts

/// @notice Header information for WTTP requests
/// @dev Used to pass accept types and conditional request parameters
struct RequestHeader {
    /// @notice Array of accepted MIME types in bytes2 format
    bytes2[] accept;
    /// @notice Array of accepted character sets in bytes2 format
    bytes2[] acceptCharset;
    /// @notice Array of accepted languages in bytes4 format
    bytes4[] acceptLanguage;
    /// @notice Timestamp for conditional requests based on modification date
    uint256 ifModifiedSince;
    /// @notice ETag for conditional requests based on content hash
    bytes32 ifNoneMatch;
}

/// @notice Parameters for GET requests
/// @dev Used to specify the target host and range of data to retrieve
struct GETRequest {
    /// @notice Address of the WTTPSite contract hosting the resource
    address host;
    /// @notice Starting chunk index for range requests
    uint32 rangeStart;
    /// @notice Ending chunk index for range requests (0 means until end)
    uint32 rangeEnd;
}

/// @notice Response structure for GET requests
/// @dev Contains both metadata and actual content
struct GETResponse {
    /// @notice Metadata and header information about the resource
    HEADResponse head;
    /// @notice Actual content data of the resource
    bytes body;
}

/// @title WTTP Protocol Implementation
/// @notice Chain-wide contract for accessing and managing web resources
/// @dev Acts as a gateway to individual WTTPSite contracts
contract WTTP {

    /// @notice Checks if a specific method is allowed for a resource
    /// @dev Uses bitwise operations to check method permissions
    /// @param _methods Bitmask of allowed methods
    /// @param _method Method to check
    /// @return bool True if method is allowed
    function _methodAllowed(
        uint16 _methods,
        Method _method
    ) internal pure returns (bool) {
        uint16 methodBit = uint16(1 << uint8(_method));
        return (_methods & methodBit != 0);
    }

    /// @notice Retrieves a resource from a WTTPSite
    /// @dev Supports conditional requests and range requests
    /// @param _requestLine Basic request information including path and protocol
    /// @param _requestHeader Request headers including conditional request parameters
    /// @param _getRequest Target host and range parameters
    /// @return getResponse Response containing metadata and content
    function GET(
        RequestLine memory _requestLine,
        RequestHeader memory _requestHeader,
        GETRequest memory _getRequest
    ) public view returns (GETResponse memory getResponse) {
        LOCATEResponse memory _locateResponse = WTTPSite(
            _getRequest.host
        ).LOCATE(_requestLine);
        DataPointStorage _dataPointStorage = WTTPSite(_getRequest.host)
            .DPR_()
            .DPS_();
        getResponse.head = _locateResponse.head;

        if (!_methodAllowed(getResponse.head.headerInfo.methods, Method.GET)) {
            getResponse.head.responseLine = ResponseLine(_requestLine.protocol, 405);
            return getResponse;
        }

        if (
            (getResponse.head.etag != bytes32(0) &&
                getResponse.head.etag == _requestHeader.ifNoneMatch) ||
            (getResponse.head.metadata.modifiedDate != 0 &&
                _requestHeader.ifModifiedSince >= getResponse.head.metadata.modifiedDate)
        ) {
            getResponse.head.responseLine = ResponseLine(
                _requestLine.protocol,
                304
            );
            return getResponse;
        }

        if (getResponse.head.responseLine.code == 200) {
            bytes32[] memory _dataPoints = _locateResponse.dataPoints;
            uint32 start = _getRequest.rangeStart;
            uint32 end = _getRequest.rangeEnd;
            if (end >= _dataPoints.length || start > end) {
                getResponse.head.responseLine = ResponseLine(
                    _requestLine.protocol,
                    416
                );
                return getResponse;
            } else if (end == 0) {
                end = uint32(_dataPoints.length) - 1;
            }

            if (start > 0 || end < _dataPoints.length - 1) {
                getResponse.head.responseLine = ResponseLine(
                    _requestLine.protocol,
                    206
                );
            }

            getResponse.body = _dataPointStorage
                .readDataPoint(_dataPoints[start])
                .data;
            for (uint256 i = start + 1; i <= end; i++) {
                getResponse.body = abi.encodePacked(
                    getResponse.body,
                    _dataPointStorage.readDataPoint(_dataPoints[i]).data
                );
            }
        }
    }

    /// @notice Retrieves resource metadata without content
    /// @dev Equivalent to HTTP HEAD method
    /// @param _host Address of the WTTPSite contract
    /// @param _requestLine Basic request information
    /// @return headResponse Response containing only metadata
    function HEAD(
        address _host,
        RequestLine memory _requestLine
    ) public view returns (HEADResponse memory headResponse) {
        return WTTPSite(_host).HEAD(_requestLine);
    }

    /// @notice Retrieves resource location information
    /// @dev Used to get DataPoint addresses for a resource
    /// @param _host Address of the WTTPSite contract
    /// @param _requestLine Basic request information
    /// @return locateResponse Response containing resource locations
    function LOCATE(
        address _host,
        RequestLine memory _requestLine
    ) public view returns (LOCATEResponse memory locateResponse) {
        return WTTPSite(_host).LOCATE(_requestLine);
    }

    /// @notice Retrieves allowed methods and other options
    /// @dev Equivalent to HTTP OPTIONS method
    /// @param _host Address of the WTTPSite contract
    /// @param _requestLine Basic request information
    /// @return optionsResponse Response containing allowed methods
    function OPTIONS(
        address _host,
        RequestLine memory _requestLine
    ) public view returns (HEADResponse memory optionsResponse) {
        optionsResponse = WTTPSite(_host).HEAD(_requestLine);
        
        // If OPTIONS method isn't allowed, return 405
        if (!_methodAllowed(optionsResponse.headerInfo.methods, Method.OPTIONS)) {
            optionsResponse.responseLine = ResponseLine(_requestLine.protocol, 405);
            return optionsResponse;
        }
        
        // For successful OPTIONS request, return 204 with allowed methods in header
        optionsResponse.responseLine = ResponseLine(_requestLine.protocol, 204);
        return optionsResponse;
    }

    /// @notice Returns request information for debugging
    /// @dev Equivalent to HTTP TRACE method
    /// @param _host Address of the WTTPSite contract
    /// @param _requestLine Basic request information
    /// @return traceResponse Response containing request information
    function TRACE(
        address _host,
        RequestLine memory _requestLine
    ) public view returns (HEADResponse memory traceResponse) {
        traceResponse = WTTPSite(_host).HEAD(_requestLine);
        
        // If TRACE method isn't allowed, return 405
        if (!_methodAllowed(traceResponse.headerInfo.methods, Method.TRACE)) {
            traceResponse.responseLine = ResponseLine(_requestLine.protocol, 405);
            return traceResponse;
        }
        
        // For successful TRACE request, return 200 with request info
        traceResponse.responseLine = ResponseLine(_requestLine.protocol, 200);
        return traceResponse;
    }
}
