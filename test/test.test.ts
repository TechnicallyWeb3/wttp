const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Test Contracts", function () {
    let test;
    let test2;
    let owner;

    beforeEach(async function () {
        // Get the signer
        [owner] = await ethers.getSigners();

        // Deploy Test contract
        const Test = await ethers.getContractFactory("Test");
        test = await Test.deploy();
        await test.waitForDeployment();

        // Deploy Test2 contract with Test contract address
        const Test2 = await ethers.getContractFactory("Test2");
        test2 = await Test2.deploy(await test.getAddress());
        await test2.waitForDeployment();
    });

    it("should store the correct Test contract address in Test2", async function () {
        // Get the stored Test contract address from Test2
        const storedTestAddress = await test2.test();
        
        // Get the actual Test contract address
        const actualTestAddress = await test.getAddress();

        // Verify addresses match
        expect(storedTestAddress).to.equal(actualTestAddress);
    });

    it("should correctly call test() through Test2", async function () {
        const result = await test2.test2();
        expect(result).to.equal("Hello, World!");
    });

    it("should get Test contract address and call test() function through Test2", async function () {
        // Get Test contract address from Test2
        const testAddress = await test2.test();
        console.log("Test contract address:", testAddress);

        // Connect to Test contract using its address
        const TestFactory = await ethers.getContractFactory("Test");
        const testContract = TestFactory.attach(testAddress);
        
        // Call test() function directly on Test contract
        const testResult = await testContract.test();
        console.log("Test function return value:", testResult);

        // Verify the return value
        expect(testResult).to.equal("Hello, World!");
    });
}); 