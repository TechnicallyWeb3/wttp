import {
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";
import { Dev_WTTPPermissions, Dev_WTTPStorage, Dev_WTTPBaseMethods, DataPointRegistry, DataPointStorage } from "../typechain-types";

describe("WebContract (WTTP/2.0)", function () {
    async function deployFixture() {
        const [tw3, user1, user2] = await hre.ethers.getSigners();

        const DataPointStorage = await hre.ethers.getContractFactory("DataPointStorage");
        const dataPointStorage = await DataPointStorage.deploy();

        const DataPointRegistry = await hre.ethers.getContractFactory("DataPointRegistry");
        const dataPointRegistry = await DataPointRegistry.deploy(dataPointStorage.target, tw3.address);

        const WTTPPermissions = await hre.ethers.getContractFactory("Dev_WTTPPermissions");
        const wttpPermissions = await WTTPPermissions.deploy();

        const WTTPStorage = await hre.ethers.getContractFactory("Dev_WTTPStorage");
        const wttpStorage = await WTTPStorage.deploy(dataPointRegistry.target, tw3.address);

        const WTTPSite = await hre.ethers.getContractFactory("MyFirstWTTPSite");
        const wttpSite = await WTTPSite.deploy(dataPointRegistry.target, tw3.address);

        return { dataPointStorage, dataPointRegistry, wttpPermissions, wttpStorage, wttpSite, tw3, user1, user2 };
    }

    describe("WTTP Permissions", function () {
        it("Should correctly manage site admin roles", async function () {

            this.slow(2000);

            const { wttpPermissions, tw3, user1 } = await loadFixture(deployFixture);
            
            // tw3 should be site admin (set in constructor)
            expect(await wttpPermissions.isSiteAdmin(tw3.address)).to.be.true;
            
            // user1 should not be site admin
            expect(await wttpPermissions.isSiteAdmin(user1.address)).to.be.false;
            
            // tw3 can grant site admin role
            await wttpPermissions.grantRole(await wttpPermissions.siteAdmin(), user1.address);
            expect(await wttpPermissions.isSiteAdmin(user1.address)).to.be.true;
        });

        it("Should prevent site admins from creating other site admins", async function () {
            const { wttpPermissions, tw3, user1, user2 } = await loadFixture(deployFixture);
            
            // Grant site admin role to user1
            await wttpPermissions.grantRole(await wttpPermissions.siteAdmin(), user1.address);
            expect(await wttpPermissions.isSiteAdmin(user1.address)).to.be.true;
            
            // User1 should not be able to grant site admin role to user2
            await expect(
                wttpPermissions.connect(user1).grantRole(await wttpPermissions.siteAdmin(), user2.address)
            ).to.be.reverted;
            
            expect(await wttpPermissions.isSiteAdmin(user2.address)).to.be.false;
        });

        it("Should prevent resource admins from creating roles", async function () {
            const { wttpPermissions, tw3, user1 } = await loadFixture(deployFixture);
            
            // Create a resource role and grant it to user1
            const roleName = "TEST_RESOURCE_ADMIN";
            await wttpPermissions.createResourceRole(roleName);
            const roleHash = ethers.id(roleName);
            await wttpPermissions.grantRole(roleHash, user1.address);
            
            // User1 should not be able to create new roles
            await expect(
                wttpPermissions.connect(user1).createResourceRole("NEW_ROLE")
            ).to.be.reverted;
        });

        it("Should allow creating resource-specific roles", async function () {
            const { wttpPermissions, tw3 } = await loadFixture(deployFixture);
            
            const roleName = "TEST_RESOURCE_ADMIN";
            await wttpPermissions.createResourceRole(roleName);
            
            const roleHash = ethers.id(roleName);
            expect(await wttpPermissions.hasRole(roleHash, tw3.address)).to.be.true;
        });
    });

    describe("WTTP Storage", function () {
        describe("Resource Management", function () {
            it("Should create resource and verify data integrity", async function () {
                const { dataPointStorage, wttpStorage, tw3 } = await loadFixture(deployFixture);

                const content = "<html><body>Hello, World!</body></html>";
                await wttpStorage.createResource(
                    "/test.html",
                    ethers.hexlify("0x7468"), // text/html
                    ethers.hexlify("0x7574"), // utf-8
                    ethers.hexlify("0x0101"), // datapoint/chunk
                    tw3.address,
                    ethers.toUtf8Bytes(content)
                );

                // Verify data integrity
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
            const { wttpSite, tw3 } = await loadFixture(deployFixture);

            const content = "<html><body>Hello, World!</body></html>";
            await expect(wttpSite.PUT(
                { path: "/test.html", protocol: "WTTP/2.0" },
                ethers.hexlify("0x7468"), // text/html
                ethers.hexlify("0x7574"), // utf-8
                ethers.hexlify("0x0101"), // datapoint/chunk
                tw3.address,
                ethers.toUtf8Bytes(content)
            )).to.not.be.reverted;

            // Add debug output
            const headResponse = await wttpSite.HEAD({ path: "/test.html", protocol: "WTTP/2.0" });
            // console.log("HEAD Response:", headResponse);

            expect(headResponse.metadata.size).to.equal(content.length);
            expect(headResponse.metadata.version).to.equal(1);

            // Add debug output for LOCATE
            const locations = await wttpSite.LOCATE({ path: "/test.html", protocol: "WTTP/2.0" });
            // console.log("Locations array:", locations);
            // console.log("Locations length:", locations);
            expect(locations.dataPoints.length).to.equal(1);
        });

        it("Should allow admin to PUT then PATCH multi-part resources", async function () {
            const { wttpSite, dataPointStorage, tw3 } = await loadFixture(deployFixture);

            const part1 = "<html><body>First part";
            const part2 = " Second part";
            const part3 = " Third part</body></html>";

            // Add debug output for initial PUT
            await wttpSite.PUT(
                { path: "/multipart.html", protocol: "WTTP/2.0" },
                ethers.hexlify("0x7468"),
                ethers.hexlify("0x7574"),
                ethers.hexlify("0x0101"),
                tw3.address,
                ethers.toUtf8Bytes(part1)
            );

            let headResponse = await wttpSite.HEAD({ path: "/multipart.html", protocol: "WTTP/2.0" });
            // console.log("\nAfter PUT:", {
            //     size: headResponse.metadata.size,
            //     version: headResponse.metadata.version
            // });

            // PATCH chunk 1
            await wttpSite.PATCH(
                { path: "/multipart.html", protocol: "WTTP/2.0" },
                ethers.toUtf8Bytes(part2),
                1,
                tw3.address
            );

            headResponse = await wttpSite.HEAD({ path: "/multipart.html", protocol: "WTTP/2.0" });
            // console.log("\nAfter PATCH 1:", {
            //     size: headResponse.metadata.size,
            //     version: headResponse.metadata.version
            // });

            // PATCH chunk 2
            await wttpSite.PATCH(
                { path: "/multipart.html", protocol: "WTTP/2.0" },
                ethers.toUtf8Bytes(part3),
                2,
                tw3.address
            );

            headResponse = await wttpSite.HEAD({ path: "/multipart.html", protocol: "WTTP/2.0" });
            // console.log("\nAfter PATCH 2:", {
            //     size: headResponse.metadata.size,
            //     version: headResponse.metadata.version
            // });

            let  locations = await wttpSite.LOCATE({ path: "/multipart.html", protocol: "WTTP/2.0" });
            // console.log("\nFinal locations:", locations);
            // console.log("Locations length:", locations.dataPoints.length);
            
            // Verify final state
            headResponse = await wttpSite.HEAD({ path: "/multipart.html", protocol: "WTTP/2.0" });
            expect(headResponse.metadata.size).to.equal(part1.length + part2.length + part3.length);
            expect(headResponse.metadata.version).to.equal(3);

            // Verify all chunks are present
            locations = await wttpSite.LOCATE({ path: "/multipart.html", protocol: "WTTP/2.0" });
            expect(locations.dataPoints.length).to.equal(3);

            // Verify data integrity
            let result = "";
            for (let i = 0; i < 3; i++) {
                const data = await dataPointStorage.readDataPoint(locations.dataPoints[i]);
                result += ethers.toUtf8String(data.data);
            }
            expect(result).to.equal(part1 + part2 + part3);
        });
    });
}); 