// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "./WebStorage.sol";
import "./WebContract.sol";

struct RequestHeader {
    bytes2[] accept;
    bytes2[] acceptCharset;
    bytes4[] acceptLanguage;
    uint256 ifModifiedSince;
    bytes32 ifNoneMatch;
}

struct GETRequest {
    address host;
    uint32 rangeStart;
    uint32 rangeEnd;
}

struct GETResponse {
    HEADResponse head;
    bytes body;
}

contract WTTP {
    function _methodAllowed(
        uint16 _methods,
        Method _method
    ) internal pure returns (bool) {
        uint16 methodBit = uint16(1 << uint8(_method)); // Create a bitmask for the method

        if (_methods & methodBit != 0) {
            return true;
        }

        return false;
    }

    function GET(
        RequestLine memory _requestLine,
        RequestHeader memory _requestHeader,
        GETRequest memory _getRequest
    ) public view returns (GETResponse memory getResponse) {
        LOCATEResponse memory _locateResponse = WTTPBaseMethods(
            _getRequest.host
        ).LOCATE(_requestLine);
        DataPointStorage _dataPointStorage = WTTPBaseMethods(_getRequest.host)
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
}
