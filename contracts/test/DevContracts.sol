// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "../WebStorage.sol";
import "../WebContract.sol";

contract Dev_DataPointRegistry is DataPointRegistry {
    constructor(address _dps, address _owner) DataPointRegistry(_dps, _owner) {}

    function setFileSystem(address _dps) public {
        _setFileSystem(_dps);
    }

    function useFileSystem(
        address _dps
    ) public view returns (DataPointStorage) {
        return _useFileSystem(DataPointStorage(_dps));
    }

    function _royaltyGasRate() internal pure override returns (uint256) {
        return 100000000; // 0.1 gwei
    }
}

contract Dev_WTTPPermissions is WTTPPermissions {
    constructor() WTTPPermissions(msg.sender) {}

    function owner() external pure returns (bytes32) {
        return OWNER_ROLE;
    }

    function siteAdmin() external pure returns (bytes32) {
        return SITE_ADMIN_ROLE;
    }

    function isSiteAdmin(address _admin) public view returns (bool) {
        return _isSiteAdmin(_admin);
    }
}

contract Dev_WTTPStorage is WTTPStorage {
    constructor(address _dpr, address _owner) WTTPStorage(_dpr, _owner, HeaderInfo(CacheControl(0, 0, false, false, false, false, false, 0, 0, false, false), 0, Redirect(0, ""), bytes32(0))) {}

    function isResourceAdmin(
        string memory _path,
        address _admin
    ) public view returns (bool) {
        return _isResourceAdmin(_path, _admin);
    }

    function writeHeader(
        string memory _path,
        HeaderInfo memory _header
    ) public {
        _writeHeader(_path, _header);
    }

    function readLocation(
        string memory _path
    ) public view returns (bytes32[] memory) {
        return _readLocation(_path);
    }

    function readHeader(
        string memory _path
    ) public view returns (HeaderInfo memory) {
        return _readHeader(_path);
    }

    function readMetadata(
        string memory _path
    ) public view returns (ResourceMetadata memory) {
        return _readMetadata(_path);
    }

    function createResource(
        string memory _path,
        bytes2 _mimeType,
        bytes2 _charset,
        bytes2 _location,
        address _publisher,
        bytes memory _data
    ) public {
        _createResource(
            _path,
            _mimeType,
            _charset,
            _location,
            _publisher,
            _data
        );
    }

    function updateResource(
        string memory _path,
        bytes memory _data,
        uint256 _chunk,
        address _publisher
    ) public {
        _updateResource(_path, _data, _chunk, _publisher);
    }

    function deleteResource(
        string memory _path
    ) public {
        _deleteResource(_path);
    }

}

contract MyFirstWTTPSite is WTTPSite {
    constructor(address _dpr, address _owner) WTTPSite(_dpr, _owner, HeaderInfo(CacheControl(0, 0, false, false, false, false, false, 0, 0, false, false), 0, Redirect(0, ""), bytes32(0))) {}
}



