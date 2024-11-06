// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import { WTTPPermissions } from "../contracts/WebContract.sol";

contract Dev_WTTPPermissions is WTTPPermissions {
    constructor() WTTPPermissions(msg.sender) {}

    function isSiteAdmin(address _admin) public view returns (bool) {
        return _isSiteAdmin(_admin);
    }
}
