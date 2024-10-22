import {
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";
import { StatusMap, TypeMap, DataPointStorage, WebRegistry, DataPointRegistry, WebServer } from "../typechain-types";

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

            await expect(webServer.WTTPRequest(
                { method: 1, path: "/index.html", version: 1 },
                { mimeType: "text/html", encoding: "utf-8", location: "datapoint/chunk", chunk: 0, publisher: owner.address, httpHeader: "" },
                ethers.toUtf8Bytes("<html><body>Hello, World!</body></html>")
            )).to.not.be.reverted;

            const fileAddresses = await webServer.readWebFile("/index.html");
            expect(fileAddresses.length).to.equal(1);
        });

        it("Should update an existing web file", async function () {
            const { webServer, owner } = await loadFixture(deployWebStorageFixture);

            await webServer.WTTPRequest(
                { method: 1, path: "/index.html", version: 1 },
                { mimeType: "text/html", encoding: "utf-8", location: "datapoint/chunk", chunk: 0, publisher: owner.address, httpHeader: "" },
                ethers.toUtf8Bytes("<html><body>Hello, World!</body></html>")
            );

            await expect(webServer.WTTPRequest(
                { method: 2, path: "/index.html", version: 1 },
                { mimeType: "text/html", encoding: "utf-8", location: "datapoint/chunk", chunk: 0, publisher: owner.address, httpHeader: "" },
                ethers.toUtf8Bytes("<html><body>Updated content</body></html>")
            )).to.not.be.reverted;

            const fileAddresses = await webServer.readWebFile("/index.html");
            expect(fileAddresses.length).to.equal(1);
        });

        it("Should not allow creating a file that already exists", async function () {
            const { webServer, owner } = await loadFixture(deployWebStorageFixture);

            await webServer.WTTPRequest(
                { method: 1, path: "/index.html", version: 1 },
                { mimeType: "text/html", encoding: "utf-8", location: "datapoint/chunk", chunk: 0, publisher: owner.address, httpHeader: "" },
                ethers.toUtf8Bytes("<html><body>Hello, World!</body></html>")
            );

            await expect(webServer.WTTPRequest(
                { method: 1, path: "/index.html", version: 1 },
                { mimeType: "text/html", encoding: "utf-8", location: "datapoint/chunk", chunk: 0, publisher: owner.address, httpHeader: "" },
                ethers.toUtf8Bytes("<html><body>Another file</body></html>")
            )).to.be.revertedWith("WS: Web file already exists");
        });

        it("Should delete a web file", async function () {
            const { webServer, owner } = await loadFixture(deployWebStorageFixture);

            await webServer.WTTPRequest(
                { method: 1, path: "/to-delete.html", version: 1 },
                { mimeType: "text/html", encoding: "utf-8", location: "datapoint/chunk", chunk: 0, publisher: owner.address, httpHeader: "" },
                ethers.toUtf8Bytes("<html><body>Delete me</body></html>")
            );

            await expect(webServer.WTTPRequest(
                { method: 3, path: "/to-delete.html", version: 1 },
                { mimeType: "", encoding: "", location: "", chunk: 0, publisher: owner.address, httpHeader: "" },
                new Uint8Array(0)
            )).to.not.be.reverted;

            const fileAddresses = await webServer.readWebFile("/to-delete.html");
            expect(fileAddresses.length).to.equal(0);
        });

        describe("Royalty Tests", function () {
            it("Should allow same address to update without royalty", async function () {
                const { webServer, owner } = await loadFixture(deployWebStorageFixture);
                
                await webServer.WTTPRequest(
                    { method: 1, path: "/test.txt", version: 1 },
                    { mimeType: "text/plain", encoding: "utf-8", location: "datapoint/chunk", chunk: 0, publisher: owner.address, httpHeader: "" },
                    ethers.toUtf8Bytes("Initial")
                );
                
                await expect(webServer.WTTPRequest(
                    { method: 2, path: "/test.txt", version: 1 },
                    { mimeType: "text/plain", encoding: "utf-8", location: "datapoint/chunk", chunk: 0, publisher: owner.address, httpHeader: "" },
                    ethers.toUtf8Bytes("Updated")
                )).to.not.be.reverted;
            });

            it("Should prevent different address from updating without royalty", async function () {
                const { webServer, owner, user1 } = await loadFixture(deployWebStorageFixture);
                
                await webServer.WTTPRequest(
                    { method: 1, path: "/test.txt", version: 1 },
                    { mimeType: "text/plain", encoding: "utf-8", location: "datapoint/chunk", chunk: 0, publisher: owner.address, httpHeader: "" },
                    ethers.toUtf8Bytes("Initial")
                );
                
                await expect(webServer.connect(user1).WTTPRequest(
                    { method: 2, path: "/test.txt", version: 1 },
                    { mimeType: "text/plain", encoding: "utf-8", location: "datapoint/chunk", chunk: 0, publisher: user1.address, httpHeader: "" },
                    ethers.toUtf8Bytes("Updated")
                )).to.be.reverted;
            });

            it("Should allow different address to update with royalty payment", async function () {
                const { webServer, owner, user1, dataPointRegistry } = await loadFixture(deployWebStorageFixture);
                
                await webServer.WTTPRequest(
                    { method: 1, path: "/test.txt", version: 1 },
                    { mimeType: "text/plain", encoding: "utf-8", location: "datapoint/chunk", chunk: 0, publisher: owner.address, httpHeader: "" },
                    ethers.toUtf8Bytes("Initial")
                );
                
                const fileAddresses = await webServer.readWebFile("/test.txt");
                const royaltyAmount = await dataPointRegistry.getRoyalty(fileAddresses[0]);
                
                await expect(webServer.connect(user1).WTTPRequest(
                    { method: 2, path: "/test.txt", version: 1 },
                    { mimeType: "text/plain", encoding: "utf-8", location: "datapoint/chunk", chunk: 0, publisher: user1.address, httpHeader: "" },
                    ethers.toUtf8Bytes("Updated"),
                    { value: royaltyAmount }
                )).to.not.be.reverted;
            });
        });
    });

    describe("WebServer Edge Cases", function () {
        it("Should test the maximum number of chunks that can be added to a single file", async function () {

            this.timeout(36000000);

            const { webServer, owner } = await loadFixture(deployWebStorageFixture);
            const chunkSize = 64 * 1024; // 64KB chunks
            const filePath = "/large-file.txt";
            let chunkCount = 0;

            // Create initial file
            await webServer.WTTPRequest(
                { method: 1, path: filePath, version: 1 },
                { mimeType: "text/plain", encoding: "utf-8", location: "datapoint/chunk", chunk: 0, publisher: owner.address, httpHeader: "" },
                ethers.toUtf8Bytes(`Chunk ${chunkCount}: ` + "a".repeat(chunkSize - 10))
            );
            chunkCount++;

            try {
                while (chunkCount < 1000) {
                    await webServer.WTTPRequest(
                        { method: 2, path: filePath, version: 1 },
                        { mimeType: "text/plain", encoding: "utf-8", location: "datapoint/chunk", chunk: chunkCount, publisher: owner.address, httpHeader: "" },
                        ethers.toUtf8Bytes(`Chunk ${chunkCount}: ` + "b".repeat(chunkSize - 10))
                    );
                    chunkCount++;

                    if (chunkCount % 100 === 0) {
                        console.log(`Chunk count: ${chunkCount}`);
                        // Verify the number of chunks
                        const fileAddresses = await webServer.readWebFile(filePath);
                        expect(fileAddresses.length).to.equal(chunkCount);

                        // const feeData = await ethers.provider.getFeeData();
                        // const gasPrice = feeData.gasPrice || 0;

                        // console.log(`Gas price: ${ethers.formatEther(gasPrice).slice(0, 11)} ETH; Balance: ${ethers.formatEther(await ethers.provider.getBalance(owner.address)).slice(0, 11)} ETH`);
                        // console.log(`File size: ${(await webServer.getFileInfo(filePath)).size} bytes`);
                    }
                }
            } catch (error) {
                console.log(`Maximum number of 64KB chunks in a single file: ${chunkCount}`);
                console.log(`Total file size: ${(await webServer.getFileInfo(filePath)).size} bytes`);
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
