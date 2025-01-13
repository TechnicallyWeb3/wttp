// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "./WebContract.sol";

contract MyFirstWTTPSite is WTTPSite {
    constructor(address _dpr, address _owner) WTTPSite(_dpr, _owner, HeaderInfo(CacheControl(0, 0, false, false, false, false, false, 0, 0, false, false), 0, Redirect(0, ""), bytes32(0))) {}
}