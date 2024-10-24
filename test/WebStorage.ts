import {
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";
import { TypeCategory, StatusMap, TypeMap, DataPointStorage, WebRegistry, DataPointRegistry, WebServer, DataPointStorage__factory } from "../typechain-types";

describe("WebStorage", function () {
    async function deployWebStorageFixture() {
        const [owner, user1, user2] = await hre.ethers.getSigners();

        console.log(`Deploying StatusMap...`);
        const StatusMap = await hre.ethers.getContractFactory("StatusMap");
        const statusMap = await StatusMap.deploy();

        console.log(`Deploying TypeMap...`);
        const TypeMap = await hre.ethers.getContractFactory("TypeMap");
        const typeMap = await TypeMap.deploy();

        console.log(`Deploying DataPointStorage...`);
        const DataPointStorage = await hre.ethers.getContractFactory("DataPointStorage");
        const dataPointStorage = await DataPointStorage.deploy();

        console.log(`Deploying DataPointRegistry...`);
        const DataPointRegistry = await hre.ethers.getContractFactory("DataPointRegistry");
        const dataPointRegistry = await DataPointRegistry.deploy(dataPointStorage.target);

        console.log(`Deploying WebServer...`);
        const WebServer = await hre.ethers.getContractFactory("WebServer");
        const webServer = await WebServer.deploy(statusMap.target, typeMap.target, dataPointRegistry.target, owner.address);

        return { statusMap, typeMap, dataPointStorage, dataPointRegistry, webServer, owner, user1, user2 };
    }

    describe("StatusMap", function () {
        it("Should set and get status codes correctly", async function () {
            const { statusMap } = await loadFixture(deployWebStorageFixture);

            //   await expect(statusMap.getReasonPhrase(200)).to.not.be.reverted;
            expect(await statusMap.getReasonPhrase(200)).to.equal("OK");

            //   await expect(statusMap.getStatusCode("Not Found")).to.not.be.reverted;
            expect(await statusMap.getStatusCode("Not Found")).to.equal(404);
        });

        it("Should allow owner to add new status codes", async function () {
            const { statusMap } = await loadFixture(deployWebStorageFixture);

            await expect(statusMap.setStatus(599, "Custom Error"))
                .to.not.be.reverted;

            expect(await statusMap.getReasonPhrase(599)).to.equal("Custom Error");
            expect(await statusMap.getStatusCode("Custom Error")).to.equal(599);
        });

        it("Should not allow non-owner to add new status codes", async function () {
            const { statusMap, user1 } = await loadFixture(deployWebStorageFixture);

            await expect(statusMap.connect(user1).setStatus(599, "Custom Error"))
                .to.be.reverted;
        });
    });

    describe("WebServer", function () {
        it("Should create a web file", async function () {
            const { webServer, owner } = await loadFixture(deployWebStorageFixture);

            await expect(webServer.PUT(
                "/index.html",
                "text/html",
                "utf-8",
                "datapoint/chunk",
                owner.address,
                ethers.toUtf8Bytes("<html><body>Hello, World!</body></html>"),
                { value: 0 }
            )).to.not.be.reverted;

            const fileAddresses = await webServer.GET("/index.html");
            expect(fileAddresses.length).to.equal(1);
        });

        it("Should update an existing web file", async function () {
            const { webServer, owner } = await loadFixture(deployWebStorageFixture);

            await webServer.PUT(
                "/index.html",
                "text/html",
                "utf-8",
                "datapoint/chunk",
                owner.address,
                ethers.toUtf8Bytes("<html><body>Hello, World!</body></html>"),
                { value: 0 }
            );

            await expect(webServer.PATCH(
                "/index.html",
                ethers.toUtf8Bytes("<html><body>Updated content</body></html>"),
                0,
                owner.address,
                { value: 0 }
            )).to.not.be.reverted;

            const fileAddresses = await webServer.GET("/index.html");
            expect(fileAddresses.length).to.equal(1);
        });

        it("Should not allow creating a file that already exists", async function () {
            const { webServer, owner } = await loadFixture(deployWebStorageFixture);

            await webServer.PUT(
                "/index.html",
                "text/html",
                "utf-8",
                "datapoint/chunk",
                owner.address,
                ethers.toUtf8Bytes("<html><body>Hello, World!</body></html>"),
                { value: 0 }
            );

            await expect(webServer.PUT(
                "/index.html",
                "text/html",
                "utf-8",
                "datapoint/chunk",
                owner.address,
                ethers.toUtf8Bytes("<html><body>Another file</body></html>")
            )).to.be.reverted;
        });

        it("Should delete a web file", async function () {
            const { webServer, owner } = await loadFixture(deployWebStorageFixture);

            await webServer.PUT(
                "/to-delete.html",
                "text/html",
                "utf-8",
                "datapoint/chunk",
                owner.address,
                ethers.toUtf8Bytes("<html><body>Delete me</body></html>"),
                { value: 0 }
            );

            await expect(webServer.DELETE(
                "/to-delete.html",
                { value: 0 }
            )).to.not.be.reverted;

            const fileAddresses = await webServer.GET("/to-delete.html");
            expect(fileAddresses.length).to.equal(0);
        });

        describe("Royalty Tests", function () {
            it("Should allow same address to update without royalty", async function () {
                const { webServer, owner } = await loadFixture(deployWebStorageFixture);

                await webServer.PUT(
                    "/test.txt",
                    "text/plain",
                    "utf-8",
                    "datapoint/chunk",
                    owner.address,
                    ethers.toUtf8Bytes("Initial"),
                    { value: 0 }
                );

                await expect(webServer.PATCH(
                    "/test.txt",
                    ethers.toUtf8Bytes("Updated"),
                    0,
                    owner.address,
                    { value: 0 }
                )).to.not.be.reverted;
            });

            it("Should require royalty payment when different WebServer writes the same data", async function () {
                const { webServer, owner, user1, dataPointRegistry, dataPointStorage, statusMap, typeMap } = await loadFixture(deployWebStorageFixture);
                console.log("Starting Royalty Test");

                const dataPointData = ethers.toUtf8Bytes("Common Data");

                // First WebServer writes data
                await expect(webServer.PUT(
                    "/test.txt",
                    "text/plain",
                    "utf-8",
                    "datapoint/chunk",
                    owner.address,
                    dataPointData,
                    { value: 0 }
                )).to.not.be.reverted;

                const dataPointStructure = {
                    mimeType: await typeMap.getTypeString(TypeCategory.MIME_TYPE, "text/plain"),
                    encoding: await typeMap.getTypeString(TypeCategory.ENCODING_TYPE, "utf-8"),
                    location: await typeMap.getTypeString(TypeCategory.LOCATION_TYPE, "datapoint/chunk")
                };

                const dataPoint = {
                    structure: dataPointStructure,
                    data: dataPointData
                };

                const dataPointAddress = await dataPointStorage.calculateAddress(dataPoint);
                console.log(`Data point address: ${dataPointAddress}`);

                // Deploy a second WebServer
                const WebServer2 = await ethers.getContractFactory("WebServer");
                const webServer2 = await WebServer2.deploy(statusMap.target, typeMap.target, dataPointRegistry.target, user1.address);
                console.log("Second WebServer deployed");

                console.log("Second WebServer tries to write the same data");
                // Second WebServer tries to write the same data
                await expect(webServer2.PUT(
                    "/different-path.txt",
                    "text/plain",
                    "utf-8",
                    "datapoint/chunk",
                    user1.address,
                    dataPointData,
                    { value: 0 }
                )).to.be.reverted;

                console.log("Second WebServer failed to write the same data");

                console.log(`Calculated data point address: ${dataPointAddress}`);
                const royaltyAmount = await dataPointRegistry.getRoyalty(dataPointAddress);
                console.log(`Royalty amount: ${royaltyAmount}`);
                // Second WebServer writes the same data with royalty payment
                await expect(webServer2.connect(user1).PUT(
                    "/different-path.txt",
                    "text/plain",
                    "utf-8",
                    "datapoint/chunk",
                    user1.address,
                    dataPointData,
                    { value: royaltyAmount }
                )).to.not.be.reverted;
                console.log("Second WebServer wrote the same data with royalty payment");
            });

            it("Should not require royalty payment for different data", async function () {
                const { webServer, owner, user1, dataPointRegistry, statusMap, typeMap } = await loadFixture(deployWebStorageFixture);

                // First WebServer writes data
                await webServer.PUT(
                    "/test1.txt",
                    "text/plain",
                    "utf-8",
                    "datapoint/chunk",
                    owner.address,
                    ethers.toUtf8Bytes("Data 1"),
                    { value: 0 }
                );

                // Deploy a second WebServer
                const WebServer2 = await ethers.getContractFactory("WebServer");
                const webServer2 = await WebServer2.deploy(statusMap.target, typeMap.target, dataPointRegistry.target, user1.address);

                // // Second WebServer writes different data
                // await expect(webServer2.WTTPRequest(
                //     { method: 1, path: "/test2.txt", version: 1 },
                //     { mimeType: "text/plain", encoding: "utf-8", location: "datapoint/chunk", chunk: 0, publisher: user1.address, httpHeader: "" },
                //     ethers.toUtf8Bytes("Data 2")
                // )).to.not.be.reverted;
            });
        });
    });

    describe("WebServer Edge Cases", function () {
        it("Should test the maximum number of chunks that can be added to a single file", async function () {

            this.timeout(6000000);

            const { webServer, owner } = await loadFixture(deployWebStorageFixture);
            const chunkSize = 64 * 1024; // 64KB chunks
            const filePath = "/large-file.txt";
            let chunkCount = 0;

            // Create initial file
            await webServer.PUT(
                filePath,
                "text/plain",
                "utf-8",
                "datapoint/chunk",
                owner.address,
                ethers.toUtf8Bytes(`Chunk ${chunkCount}: ` + "a".repeat(chunkSize - 10)),
                { value: 0 }
            );
            chunkCount++;

            try {
                while (chunkCount < 200) {
                    await webServer.PATCH(
                        filePath,
                        ethers.toUtf8Bytes(`Chunk ${chunkCount}: ` + "b".repeat(chunkSize - 10)),
                        chunkCount,
                        owner.address,
                        { value: 0 }
                    );
                    chunkCount++;

                    if (chunkCount % 100 === 0) {
                        console.log(`Chunk count: ${chunkCount}`);
                        // Verify the number of chunks
                        const fileAddresses = await webServer.GET(filePath);
                        expect(fileAddresses.length).to.equal(chunkCount);

                        // const feeData = await ethers.provider.getFeeData();
                        // const gasPrice = feeData.gasPrice || 0;

                        // console.log(`Gas price: ${ethers.formatEther(gasPrice).slice(0, 11)} ETH; Balance: ${ethers.formatEther(await ethers.provider.getBalance(owner.address)).slice(0, 11)} ETH`);
                        // console.log(`File size: ${(await webServer.getFileInfo(filePath)).size} bytes`);
                    }
                }
            } catch (error) {
                console.log(`Maximum number of 64KB chunks in a single file: ${chunkCount}`);
                console.log(`Total file size: ${(await webServer.getResourceInfo(filePath)).size} bytes`);
                if (error instanceof Error) {
                    console.log(`Error: ${error.message}`);
                } else {
                    console.log(`Error: ${String(error)}`);
                }
            }

            expect(chunkCount).to.be.greaterThan(1);


        });
    });
});
