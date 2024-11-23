import {
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";
// import { Dev_WTTPPermissions, Dev_WTTPStorage, Dev_WTTPBaseMethods, DataPointRegistry, DataPointStorage } from "../typechain-types";

describe("WebContract (WTTP/2.0)", function () {
    // Declare shared variables
    let dataPointStorage: any;
    let dataPointRegistry: any;
    let wttpPermissions: any;
    let adminRole: any;
    let wttpStorage: any;
    let wttpSite: any;
    let tw3: any;
    let user1: any;
    let user2: any;
    let gasPrice: any;
    let tx: any;

    async function estimateGas() {
        // const price = await hre.ethers.provider.getFeeData();
        // return price.gasPrice && price.gasPrice < (price.maxFeePerGas || 100000000) ? price.gasPrice : 10000000;
        return await hre.ethers.provider.getFeeData();
    }

    // Deploy once before all tests
    before(async function () {
        this.timeout(300000); // Increase timeout for deployment

        [tw3, user1, user2] = await hre.ethers.getSigners();

        console.log(`TW3: ${tw3.address}`);
        console.log(`User 1: ${user1.address}`);
        console.log(`User 2: ${user2.address}`);

        const DataPointStorage = await hre.ethers.getContractFactory("DataPointStorage");
        gasPrice = await estimateGas();
        dataPointStorage = await DataPointStorage.deploy({ maxFeePerGas: gasPrice.maxFeePerGas, maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas });
        await dataPointStorage.waitForDeployment();
        console.log("DataPointStorage deployed at:", dataPointStorage.target);

        const DataPointRegistry = await hre.ethers.getContractFactory("DataPointRegistry");
        gasPrice = await estimateGas();
        dataPointRegistry = await DataPointRegistry.deploy(dataPointStorage.target, tw3.address, { maxFeePerGas: gasPrice.maxFeePerGas, maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas });
        await dataPointRegistry.waitForDeployment();
        console.log("DataPointRegistry deployed at:", dataPointRegistry.target);

        const WTTPPermissions = await hre.ethers.getContractFactory("Dev_WTTPPermissions");
        gasPrice = await estimateGas();
        wttpPermissions = await WTTPPermissions.deploy({ maxFeePerGas: gasPrice.maxFeePerGas, maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas });
        await wttpPermissions.waitForDeployment();
        console.log("WTTPPermissions deployed at:", wttpPermissions.target);
        adminRole = await wttpPermissions.siteAdmin();

        const WTTPStorage = await hre.ethers.getContractFactory("Dev_WTTPStorage");
        gasPrice = await estimateGas();
        wttpStorage = await WTTPStorage.deploy(dataPointRegistry.target, tw3.address, { maxFeePerGas: gasPrice.maxFeePerGas, maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas });
        await wttpStorage.waitForDeployment();
        console.log("WTTPStorage deployed at:", wttpStorage.target);

        const WTTPSite = await hre.ethers.getContractFactory("MyFirstWTTPSite");
        gasPrice = await estimateGas();
        wttpSite = await WTTPSite.deploy(dataPointRegistry.target, tw3.address, { maxFeePerGas: gasPrice.maxFeePerGas, maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas });
        await wttpSite.waitForDeployment();
        console.log("WTTPSite deployed at:", wttpSite.target);

    });

    describe("WTTP Permissions", function () {
        it("Should correctly manage site admin roles", async function () {
            expect(await wttpPermissions.isSiteAdmin(tw3.address)).to.be.true;
            expect(await wttpPermissions.isSiteAdmin(user1.address)).to.be.false;

            gasPrice = await estimateGas();
            tx = await wttpPermissions.grantRole(adminRole, user1.address, { maxFeePerGas: gasPrice.maxFeePerGas, maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas });
            await tx.wait();

            expect(await wttpPermissions.isSiteAdmin(user1.address)).to.be.true;
        });

        it("Should prevent site admins from creating other site admins", async function () {
            expect(await wttpPermissions.isSiteAdmin(user1.address)).to.be.true;

            gasPrice = await estimateGas();

            await expect(wttpPermissions.connect(user1).grantRole(adminRole, user2.address, { maxFeePerGas: gasPrice.maxFeePerGas, maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas })).to.be.reverted;

        });

        it("Should prevent resource admins from creating roles", async function () {
            expect(await wttpPermissions.isSiteAdmin(user1.address)).to.be.true;

            const roleName = "TEST_RESOURCE_ADMIN";
            gasPrice = await estimateGas();
            // console.log(gasPrice);
            tx = await wttpPermissions.connect(user1).createResourceRole(roleName, { maxFeePerGas: gasPrice.maxFeePerGas, maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas });
            await tx.wait();

            const roleHash = ethers.id(roleName);
            gasPrice = await estimateGas();
            tx = await wttpPermissions.connect(user1).grantRole(roleHash, user2.address, { maxFeePerGas: gasPrice.maxFeePerGas, maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas });
            await tx.wait();

            gasPrice = await estimateGas();
            // console.log(gasPrice);
            await expect(
                wttpPermissions.connect(user2).createResourceRole("NEW_ROLE", { maxFeePerGas: gasPrice.maxFeePerGas, maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas })
            ).to.be.reverted;
        });

        it("Should allow creating resource-specific roles", async function () {
            const roleName = "TEST_RESOURCE_ADMIN";
            gasPrice = await estimateGas();
            tx = await wttpPermissions.createResourceRole(roleName, { maxFeePerGas: gasPrice.maxFeePerGas, maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas });
            await tx.wait();

            const roleHash = ethers.id(roleName);
            expect(await wttpPermissions.hasRole(roleHash, tw3.address)).to.be.true;
        });
    });

    describe("WTTP Storage", function () {
        describe("Resource Management", function () {
            it("Should create resource and verify data integrity", async function () {
                const content = "<html><body>Hello, World!</body></html>";
                gasPrice = await estimateGas();
                tx = await wttpStorage.createResource(
                    "/test.html",
                    ethers.hexlify("0x7468"), // text/html
                    ethers.hexlify("0x7574"), // utf-8
                    ethers.hexlify("0x0101"), // datapoint/chunk
                    tw3.address,
                    ethers.toUtf8Bytes(content),
                    { maxFeePerGas: gasPrice.maxFeePerGas, maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas }
                );
                await tx.wait();

                const locations = await wttpStorage.readLocation("/test.html");
                const dataPoint = await dataPointStorage.readDataPoint(locations[0]);
                const metadata = await wttpStorage.readMetadata("/test.html");

                expect(ethers.toUtf8String(dataPoint.data)).to.equal(content);
                expect(metadata.version).to.equal(1);
                expect(ethers.toUtf8String(dataPoint.data).length).to.equal(metadata.size);
            });
        });
    });

    describe("WTTP Methods", function () {
        it("Should allow site admin to PUT", async function () {
            const content = "<html><body>Hello again, World!</body></html>";
            gasPrice = await estimateGas();
            tx = await wttpSite.PUT(
                { path: "/test.html", protocol: "WTTP/2.0" },
                ethers.hexlify("0x7468"), // text/html
                ethers.hexlify("0x7574"), // utf-8
                ethers.hexlify("0x0101"), // datapoint/chunk
                tw3.address,
                ethers.toUtf8Bytes(content),
                { maxFeePerGas: gasPrice.maxFeePerGas, maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas }
            )
            await tx.wait();

            const headResponse = await wttpSite.HEAD({ path: "/test.html", protocol: "WTTP/2.0" });

            expect(headResponse.metadata.size).to.equal(content.length);
            expect(headResponse.metadata.version).to.equal(1);

            const locations = await wttpSite.LOCATE({ path: "/test.html", protocol: "WTTP/2.0" });
            expect(locations.dataPoints.length).to.equal(1);
        });

        it("Should allow admin to PUT then PATCH multi-part resources", async function () {

            this.timeout(100000);

            const part1 = "<html><body>First part";
            const part2 = " Second part";
            const part3 = " Third part</body></html>";

            gasPrice = await estimateGas();
            tx = await wttpSite.PUT(
                { path: "/multipart.html", protocol: "WTTP/2.0" },
                ethers.hexlify("0x7468"),
                ethers.hexlify("0x7574"),
                ethers.hexlify("0x0101"),
                tw3.address,
                ethers.toUtf8Bytes(part1),
                { maxFeePerGas: gasPrice.maxFeePerGas, maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas }
            );
            await tx.wait();

            gasPrice = await estimateGas();
            tx = await wttpSite.PATCH(
                { path: "/multipart.html", protocol: "WTTP/2.0" },
                ethers.toUtf8Bytes(part2),
                1,
                tw3.address,
                { maxFeePerGas: gasPrice.maxFeePerGas, maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas }
            );
            await tx.wait();

            gasPrice = await estimateGas();
            tx = await wttpSite.PATCH(
                { path: "/multipart.html", protocol: "WTTP/2.0" },
                ethers.toUtf8Bytes(part3),
                2,
                tw3.address,
                { maxFeePerGas: gasPrice.maxFeePerGas, maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas }
            );
            await tx.wait();

            let locations = await wttpSite.LOCATE({ path: "/multipart.html", protocol: "WTTP/2.0" });

            const headResponse = await wttpSite.HEAD({ path: "/multipart.html", protocol: "WTTP/2.0" });
            expect(headResponse.metadata.size).to.equal(part1.length + part2.length + part3.length);
            expect(headResponse.metadata.version).to.equal(3);

            locations = await wttpSite.LOCATE({ path: "/multipart.html", protocol: "WTTP/2.0" });
            expect(locations.dataPoints.length).to.equal(3);

            let result = "";
            for (let i = 0; i < 3; i++) {
                const data = await dataPointStorage.readDataPoint(locations.dataPoints[i]);
                result += ethers.toUtf8String(data.data);
            }
            expect(result).to.equal(part1 + part2 + part3);
        });
    });
}); 