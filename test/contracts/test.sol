// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

contract Test {
    function test() public pure returns (string memory) {
        return "Hello, World!";
    }
}

contract Test2 {

    Test public test;

    constructor(address _test) {
        test = Test(_test);
        test.test();
    }

    function test2() public view returns (string memory) {
        return test.test();
    }
}
