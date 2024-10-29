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

            const response = await webServer.GET("/index.html", 0, 0);
            expect(response[0].code).to.equal(200);
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
            const [requestLine, headerData, content] = await webServer.GET("/test-get.html", 0, 0);

            console.log("GET Response:");
            console.log("Protocol:", requestLine.protocol);
            console.log("Path:", requestLine.path);
            console.log("Status Code:", requestLine.code);
            console.log("Reason:", requestLine.reason);
            console.log("Header Data:", headerData);
            console.log("Content:", ethers.toUtf8String(content));

            // Assertions
            expect(requestLine.protocol).to.equal("WTTP/1.0");
            expect(requestLine.path).to.equal("/test-get.html");
            expect(requestLine.code).to.equal(200);
            expect(requestLine.reason).to.equal("OK");
            expect(headerData).to.include("Content-Type: text/html");
            expect(ethers.toUtf8String(content)).to.equal("<html><body>Test GET</body></html>");

            // Partial GET request
            const [partialRequestLine, partialHeaderData, partialContent] = await webServer.GET("/test-get.html", 6, 11);

            console.log("\nPartial GET Response:");
            console.log("Protocol:", partialRequestLine.protocol);
            console.log("Path:", partialRequestLine.path);
            console.log("Status Code:", partialRequestLine.code);
            console.log("Reason:", partialRequestLine.reason);
            console.log("Header Data:", partialHeaderData);
            console.log("Content:", ethers.toUtf8String(partialContent));

            // Assertions for partial content
            expect(partialRequestLine.code).to.equal(206);
            expect(partialRequestLine.reason).to.equal("Partial Content");
            expect(partialHeaderData).to.include("Content-Range: bytes 6-11/34");
            expect(ethers.toUtf8String(partialContent)).to.equal("<body>");

            // Test for non-existent file (404 case)
            const [notFoundRequestLine, notFoundHeaderData, notFoundContent] = await webServer.GET("/non-existent.html", 0, 0);

            console.log("\nGET Response for non-existent file (404):");
            console.log("Protocol:", notFoundRequestLine.protocol);
            console.log("Path:", notFoundRequestLine.path);
            console.log("Status Code:", notFoundRequestLine.code);
            console.log("Reason:", notFoundRequestLine.reason);
            console.log("Header Data:", notFoundHeaderData);
            console.log("Content:", notFoundContent);

            // Assertions for non-existent file (404 case)
            expect(notFoundRequestLine.protocol).to.equal("WTTP/1.0");
            expect(notFoundRequestLine.path).to.equal("/non-existent.html");
            expect(notFoundRequestLine.code).to.equal(404);
            expect(notFoundRequestLine.reason).to.equal("Not Found");
            expect(notFoundHeaderData).to.equal("");
            expect(notFoundContent).to.equal("0x");
        });
    });

    describe("WebServer Edge Cases", function () {
        it("Should test the maximum number of chunks that can be added to a single file", async function () {

            this.timeout(6000000);

            const { webServer, owner } = await loadFixture(deployWebStorageFixture);
            const chunkSize = 24 * 1024; // 24KB chunks
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
                        const fileAddresses = await webServer.getResourceData(filePath);
                        expect(fileAddresses.length).to.equal(chunkCount);

                        // const feeData = await ethers.provider.getFeeData();
                        // const gasPrice = feeData.gasPrice || 0;

                        // console.log(`Gas price: ${ethers.formatEther(gasPrice).slice(0, 11)} ETH; Balance: ${ethers.formatEther(await ethers.provider.getBalance(owner.address)).slice(0, 11)} ETH`);
                        // console.log(`File size: ${(await webServer.getFileInfo(filePath)).size} bytes`);
                    }
                }
            } catch (error) {
                console.log(`Maximum number of 24KB chunks in a single file: ${chunkCount}`);
                console.log(`Total file size: ${(await webServer.getResourceInfo(filePath)).size} bytes`);
                if (error instanceof Error) {
                    console.log(`Error: ${error.message}`);
                } else {
                    console.log(`Error: ${String(error)}`);
                }
            }

            expect(chunkCount).to.be.greaterThan(1);


        });it("Should handle GET request for a large file (128KB)", async function () {
            const { webServer, owner } = await loadFixture(deployWebStorageFixture);
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

            const fileAddresses = await webServer.getResourceData(filePath);
            expect(fileAddresses.length).to.equal(4);

            console.log(`File addresses: ${fileAddresses.join(', ')}`);
        
            // Full GET request
            const [requestLine, headerData, content] = await webServer.GET(filePath, 0, 0);

            // Convert content (hex data string) to UTF-8 string
            const contentString = ethers.toUtf8String(content);
            console.log("Content (first 100 chars):", contentString.substring(0, 100));
            console.log("Content length:", contentString.length);
        
            // Log the first 100 characters of each chunk
            for (let i = 0; i < 4; i++) {
                const chunkStart = i * chunkSize;
                const chunkEnd = (i + 1) * chunkSize;
                const chunkContent = contentString.slice(chunkStart, chunkEnd);
                console.log(`Chunk ${i + 1} (first 100 chars):`, chunkContent.substring(0, 100));
            }
        
            // Assertions
            expect(requestLine.protocol).to.equal("WTTP/1.0");
            expect(requestLine.path).to.equal(filePath);
            expect(requestLine.code).to.equal(200);
            expect(requestLine.reason).to.equal("OK");
            expect(headerData).to.include("Content-Type: text/plain");
            expect(headerData).to.include(`Content-Length: ${totalSize}`);
            expect(contentString.length).to.equal(totalSize);
            
            let expectedFullContent = "";
            // Verify content of each chunk
            for (let i = 0; i < 4; i++) {
                const chunkStart = i * chunkSize;
                const chunkEnd = Math.min((i + 1) * chunkSize, totalSize);
                const chunkContent = contentString.slice(chunkStart, chunkEnd);
                const expectedChunkContent = `Chunk ${i + 1} `.repeat(chunkSize / 8).slice(0, chunkSize);
                console.log(`Comparing chunk ${i + 1}:`);
                console.log("Actual (first 100 chars):", chunkContent.substring(0, 100));
                console.log("Expected (first 100 chars):", expectedChunkContent.substring(0, 100));
                expect(chunkContent.substring(0, 100)).to.equal(expectedChunkContent.substring(0, 100));
                expectedFullContent += expectedChunkContent;
            }
        
            // Partial GET request (middle of the file)
            const partialStart = 50000;
            const partialEnd = 70000;
            const [partialRequestLine, partialHeaderData, partialContent] = await webServer.GET(filePath, partialStart, partialEnd);
        
            const partialContentString = ethers.toUtf8String(partialContent);
            console.log("Partial Content (first 100 chars):", partialContentString.substring(0, 100));

            console.log("\nPartial Large File GET Response:");
            console.log("Protocol:", partialRequestLine.protocol);
            console.log("Path:", partialRequestLine.path);
            console.log("Status Code:", partialRequestLine.code);
            console.log("Reason:", partialRequestLine.reason);
            console.log("Header Data:", partialHeaderData);
            console.log("Partial Content Length:", partialContentString.length);
        
            // Assertions for partial content
            expect(partialRequestLine.code).to.equal(206);
            expect(partialRequestLine.reason).to.equal("Partial Content");
            expect(partialHeaderData).to.include(`Content-Range: bytes ${partialStart}-${partialEnd}/${totalSize}`);
            // expect(partialContentString.length).to.equal(partialEnd - partialStart);
        
            // Verify content of partial request
            const expectedPartialContent = expectedFullContent.slice(partialStart, partialEnd);
            console.log(`${expectedPartialContent.substring(18990, 19010)}...${expectedPartialContent.substring(expectedPartialContent.length - 20)}.`);
            console.log(`${partialContentString.substring(18990, 19010)}...${partialContentString.substring(partialContentString.length - 20)}.`);
            expect(partialContentString.substring(0, 100)).to.equal(expectedPartialContent.substring(0, 100));
        });

    });

    describe("WebServer Data Assembly", function () {
        it("Should correctly assemble data from multiple chunks", async function () {
            const { webServer, owner } = await loadFixture(deployWebStorageFixture);
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

            // Verify resource info
            const resourceInfo = await webServer.getResourceInfo(filePath);
            console.log("Total file size:", resourceInfo.size);

            // Get resource data (chunk addresses)
            const chunks = await webServer.getResourceData(filePath);
            console.log("Number of chunks:", chunks.length);
            
            // Test full content retrieval
            const [requestLine, headerData, content] = await webServer.GET(filePath, 0, 0);
            console.log("Full content:", ethers.toUtf8String(content));
            expect(ethers.toUtf8String(content)).to.equal("Chunk1Chunk2Chunk3");

            // Test partial content retrieval (middle chunk)
            const [partialRequestLine, partialHeaderData, partialContent] = await webServer.GET(filePath, 6, 11);
            console.log("Partial content:", ethers.toUtf8String(partialContent));
            expect(ethers.toUtf8String(partialContent)).to.equal("Chunk2");

            // Test cross-chunk content retrieval
            const [crossRequestLine, crossHeaderData, crossContent] = await webServer.GET(filePath, 4, 13);
            console.log("Cross-chunk content:", ethers.toUtf8String(crossContent));
            expect(ethers.toUtf8String(crossContent)).to.equal("1Chunk2Ch");
        });
    });
});
