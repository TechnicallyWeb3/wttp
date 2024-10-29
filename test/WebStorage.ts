import {
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";
import { StatusMap, TypeMap, DataPointStorage, WebRegistry, DataPointRegistry, WebServer, DataPointStorage__factory } from "../typechain-types";

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

            const [response, _, chunks] = await webServer.GET("/index.html", 0, 0);
            expect(response.code).to.equal(200);
            expect(chunks.length).to.be.greaterThan(0);
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

            const response = await webServer.GET("/index.html", 0, 0);
            expect(response[0].code).to.equal(200);
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
                "/to-delete.html"
            )).to.not.be.reverted;

            const response = await webServer.GET("/to-delete.html", 0, 0);
            expect(response[0].code).to.equal(404);
        });

        describe("Royalty Tests", function () {
            it("Should require royalty payment when writing existing data point", async function () {
                const { owner, user1, dataPointRegistry, dataPointStorage } = await loadFixture(deployWebStorageFixture);

                const dataPointStructure = {
                    mimeType: "0x7470", // text/plain
                    encoding: "0x7574", // utf-8
                    location: "0x6463" // datapoint/chunk
                };

                const dataPoint = {
                    structure: dataPointStructure,
                    data: ethers.toUtf8Bytes("Test Data")
                };

                // First write by owner
                await expect(dataPointRegistry.writeDataPoint(dataPoint, owner.address))
                    .to.not.be.reverted;

                // Calculate the data point address
                const dataPointAddress = await dataPointStorage.calculateAddress(dataPoint);

                // Get the royalty amount
                const royaltyAmount = await dataPointRegistry.getRoyalty(dataPointAddress);

                // Attempt to write the same data point by user1 without paying royalty
                await expect(dataPointRegistry.connect(user1).writeDataPoint(dataPoint, user1.address))
                    .to.be.reverted;

                // Write the same data point by user1 with correct royalty payment
                await expect(dataPointRegistry.connect(user1).writeDataPoint(dataPoint, user1.address, { value: royaltyAmount }))
                    .to.not.be.reverted;
            });
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
                    mimeType: "0x7470",
                    encoding: "0x7508",
                    location: "0x0101"
                };

                const dataPoint = {
                    structure: dataPointStructure,
                    data: dataPointData
                };

                const dataPointAddress = await dataPointStorage.calculateAddress(dataPoint);
                console.log(`Data point address: ${dataPointAddress}`);

                // Deploy a second WebServer
                const WebServer2 = await ethers.getContractFactory("WebServer");
                const webServer2 = await WebServer2.connect(user1).deploy(statusMap.target, typeMap.target, dataPointRegistry.target, user1.address);
                console.log("Second WebServer deployed");

                console.log("Second WebServer tries to write the same data");
                // Second WebServer tries to write the same data
                await expect(webServer2.connect(user1).PUT(
                    "/different-path.txt",
                    "text/plain",
                    "utf-8",
                    "datapoint/chunk",
                    user1.address,
                    dataPointData,
                    { value: 0 }
                )).to.be.reverted;

                console.log("Second WebServer failed to write the same data as expected");

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

        it("Should return correct HEAD response", async function () {
            const { webServer, owner } = await loadFixture(deployWebStorageFixture);

            // Create a file first
            await webServer.PUT(
                "/test-head.html",
                "text/html",
                "utf-8",
                "datapoint/chunk",
                owner.address,
                ethers.toUtf8Bytes("<html><body>Test HEAD</body></html>"),
                { value: 0 }
            );

            // Call HEAD function
            const [requestLine, headerData] = await webServer.HEAD("/test-head.html");

            console.log("HEAD Response:");
            console.log("Protocol:", requestLine.protocol);
            console.log("Path:", requestLine.path);
            console.log("Status Code:", requestLine.code);
            console.log("Reason:", requestLine.reason);
            console.log("Header Data:", headerData);

            // Assertions
            expect(requestLine.protocol).to.equal("WTTP/1.0");
            expect(requestLine.path).to.equal("/test-head.html");
            expect(requestLine.code).to.equal(200);
            expect(requestLine.reason).to.equal("OK");
            expect(headerData).to.include("Content-Type: text/html");

            // Test for non-existent file
            const [notFoundRequestLine, notFoundHeaderData] = await webServer.HEAD("/non-existent.html");

            console.log("\nHEAD Response for non-existent file:");
            console.log("Protocol:", notFoundRequestLine.protocol);
            console.log("Path:", notFoundRequestLine.path);
            console.log("Status Code:", notFoundRequestLine.code);
            console.log("Reason:", notFoundRequestLine.reason);
            console.log("Header Data:", notFoundHeaderData);

            // Assertions for non-existent file
            expect(notFoundRequestLine.protocol).to.equal("WTTP/1.0");
            expect(notFoundRequestLine.path).to.equal("/non-existent.html");
            expect(notFoundRequestLine.code).to.equal(404);
            expect(notFoundRequestLine.reason).to.equal("Not Found");
            expect(notFoundHeaderData).to.equal("");
        });

        it("Should return correct GET response including 404", async function () {
            const { webServer, owner } = await loadFixture(deployWebStorageFixture);

            // Create a file
            await webServer.PUT(
                "/test-get.html",
                "text/html",
                "utf-8",
                "datapoint/chunk",
                owner.address,
                ethers.toUtf8Bytes("<html><body>Test GET</body></html>"),
                { value: 0 }
            );

            // Full GET request
            const [requestLine, headerData, chunks] = await webServer.GET("/test-get.html", 0, 0);

            console.log("GET Response:");
            console.log("Protocol:", requestLine.protocol);
            console.log("Path:", requestLine.path);
            console.log("Status Code:", requestLine.code);
            console.log("Reason:", requestLine.reason);
            console.log("Header Data:", headerData);
            console.log("Chunk Addresses:", chunks);

            // Assertions
            expect(requestLine.protocol).to.equal("WTTP/1.0");
            expect(requestLine.path).to.equal("/test-get.html");
            expect(requestLine.code).to.equal(200);
            expect(requestLine.reason).to.equal("OK");
            expect(headerData).to.include("Content-Type: text/html");
            expect(chunks.length).to.be.greaterThan(0);

            // Test for non-existent file (404 case)
            const [notFoundRequestLine, notFoundHeaderData, notFoundChunks] = await webServer.GET("/non-existent.html", 0, 0);

            console.log("\nGET Response for non-existent file (404):");
            console.log("Protocol:", notFoundRequestLine.protocol);
            console.log("Path:", notFoundRequestLine.path);
            console.log("Status Code:", notFoundRequestLine.code);
            console.log("Reason:", notFoundRequestLine.reason);
            console.log("Header Data:", notFoundHeaderData);
            console.log("Chunk Addresses:", notFoundChunks);

            // Assertions for non-existent file (404 case)
            expect(notFoundRequestLine.protocol).to.equal("WTTP/1.0");
            expect(notFoundRequestLine.path).to.equal("/non-existent.html");
            expect(notFoundRequestLine.code).to.equal(404);
            expect(notFoundRequestLine.reason).to.equal("Not Found");
            expect(notFoundHeaderData).to.equal("");
            expect(notFoundChunks.length).to.equal(0);
        });
    });

    describe("WebServer Edge Cases", function () {
        
        it("Should handle GET request for a large file (128KB)", async function () {
            const { webServer, owner, dataPointStorage } = await loadFixture(deployWebStorageFixture);
            const chunkSize = 32000; // 32KB
            const totalSize = 128000; // 128KB
            const filePath = "/large-file.txt";
        
            // Create a large file with 4 chunks
            for (let i = 0; i < 4; i++) {
                const chunkContent = Buffer.alloc(chunkSize, `Chunk ${i + 1} `);
                if (i === 0) {
                    await webServer.PUT(
                        filePath,
                        "text/plain",
                        "utf-8",
                        "datapoint/chunk",
                        owner.address,
                        chunkContent,
                        { value: 0 }
                    );
                } else {
                    await webServer.PATCH(
                        filePath,
                        chunkContent,
                        i,
                        owner.address,
                        { value: 0 }
                    );
                }
            }
        
            // Verify file size
            const fileInfo = await webServer.getResourceInfo(filePath);
            expect(fileInfo.size).to.equal(totalSize);

            // Full GET request
            const [requestLine, headerData, chunkAddresses] = await webServer.GET(filePath, 0, 0);
            
            // Get actual content from chunks
            let fullContent = "";
            for (const chunkAddress of chunkAddresses) {
                const dataPoint = await dataPointStorage.readDataPoint(chunkAddress);
                fullContent += ethers.toUtf8String(dataPoint.data);
            }

            console.log("Content length:", fullContent.length);
            console.log("First chunk preview:", fullContent.substring(0, 100));

            // Assertions
            expect(requestLine.protocol).to.equal("WTTP/1.0");
            expect(requestLine.path).to.equal(filePath);
            expect(requestLine.code).to.equal(200);
            expect(requestLine.reason).to.equal("OK");
            expect(headerData).to.include("Content-Type: text/plain");
            expect(headerData).to.include(`Content-Length: ${totalSize}`);
            expect(fullContent.length).to.equal(totalSize);
            expect(chunkAddresses.length).to.equal(4);
        });

    });

    describe("WebServer Data Assembly", function () {
        it("Should correctly assemble data from multiple chunks", async function () {
            const { webServer, owner, dataPointStorage } = await loadFixture(deployWebStorageFixture);
            const filePath = "/multi-chunk.txt";
            
            // Create first chunk
            await webServer.PUT(
                filePath,
                "text/plain",
                "utf-8",
                "datapoint/chunk",
                owner.address,
                ethers.toUtf8Bytes("Chunk1"),
                { value: 0 }
            );

            // Add second chunk
            await webServer.PATCH(
                filePath,
                ethers.toUtf8Bytes("Chunk2"),
                1,
                owner.address,
                { value: 0 }
            );

            // Add third chunk
            await webServer.PATCH(
                filePath,
                ethers.toUtf8Bytes("Chunk3"),
                2,
                owner.address,
                { value: 0 }
            );

            // Get resource data (chunk addresses)
            const [requestLine, headerData, chunkAddresses] = await webServer.GET(filePath, 0, 0);

            console.log(requestLine);
            console.log(headerData);
            
            // Assemble content from chunks
            let assembledContent = "";
            for (const chunkAddress of chunkAddresses) {
                const dataPoint = await dataPointStorage.readDataPoint(chunkAddress);
                assembledContent += ethers.toUtf8String(dataPoint.data);
            }

            console.log("Assembled content:", assembledContent);
            expect(assembledContent).to.equal("Chunk1Chunk2Chunk3");

            // // Test partial content retrieval (middle chunk)
            // const [partialRequestLine, partialHeaderData, partialChunks] = await webServer.GET(filePath, 6, 11);
            // let partialContent = "";
            // for (const chunkAddress of partialChunks) {
            //     const dataPoint = await dataPointStorage.readDataPoint(chunkAddress);
            //     partialContent += ethers.toUtf8String(dataPoint.data);
            // }
            // console.log("Partial content:", partialContent);
            // expect(partialContent).to.equal();
        });

        it("Should test the maximum number of chunks that can be added to a single file", async function () {

            console.log("Testing the maximum number of chunks that can be added to a single file... this will take a long ass time, go to bed.");
            console.log("To shorten the test change the TEST_END variable in the test file to a lower number (such as 250).");

            this.timeout(60000000);

            const TEST_END = 25000;

            const { webServer, owner } = await loadFixture(deployWebStorageFixture);
            const chunkSize = 32 * 1024; // 32KB chunks
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
                while (chunkCount < TEST_END) {
                    await webServer.PATCH(
                        filePath,
                        ethers.toUtf8Bytes(`Chunk ${chunkCount}: ` + "b".repeat(chunkSize - 10)),
                        chunkCount,
                        owner.address,
                        { value: 0 }
                    );
                    chunkCount++;

                    if (chunkCount % 500 === 0) {
                        console.log(`Chunk count: ${chunkCount}`);
                        // Verify the number of chunks
                        const fileAddresses = await webServer.getResourceData(filePath);
                        expect(fileAddresses.length).to.equal(chunkCount);

                        // const feeData = await ethers.provider.getFeeData();
                        // const gasPrice = feeData.gasPrice || 0;

                        // console.log(`Gas price: ${ethers.formatEther(gasPrice).slice(0, 11)} ETH; Balance: ${ethers.formatEther(await ethers.provider.getBalance(owner.address)).slice(0, 11)} ETH`);
                        console.log(`File size: ${(await webServer.getResourceInfo(filePath)).size} bytes`);
                    }
                }
            } catch (error) {
                console.log(`Maximum number of 32KB chunks in a single file: ${chunkCount}`);
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
