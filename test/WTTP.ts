import {
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";
import { WTTP, Dev_WTTPBaseMethods, DataPointRegistry, DataPointStorage } from "../typechain-types";

describe("WTTP", function () {
    async function deployFixture() {
        const [tw3, user1, user2] = await hre.ethers.getSigners();

        const DataPointStorage = await hre.ethers.getContractFactory("DataPointStorage");
        const dataPointStorage = await DataPointStorage.deploy();

        const DataPointRegistry = await hre.ethers.getContractFactory("DataPointRegistry");
        const dataPointRegistry = await DataPointRegistry.deploy(dataPointStorage.target, tw3.address);

        const WTTPBaseMethods = await hre.ethers.getContractFactory("Dev_WTTPBaseMethods");
        const wttpBaseMethods = await WTTPBaseMethods.deploy(dataPointRegistry.target, tw3.address, {
            cache: {
                maxAge: 0,
                sMaxage: 0,
                noStore: false,
                noCache: false,
                immutableFlag: false,
                mustRevalidate: false,
                proxyRevalidate: false,
                staleWhileRevalidate: 0,
                staleIfError: 0,
                publicFlag: false,
                privateFlag: false
            },
            methods: 2913, // Default methods
            redirect: {
                code: 0,
                location: ""
            },
            resourceAdmin: ethers.ZeroHash
        });

        const WTTP = await hre.ethers.getContractFactory("WTTP");
        const wttp = await WTTP.deploy();

        return { dataPointStorage, dataPointRegistry, wttpBaseMethods, wttp, tw3, user1, user2 };
    }

    describe("GET Method", function () {
        it("Should successfully GET a single data point resource", async function () {
            const { wttpBaseMethods, wttp, tw3 } = await loadFixture(deployFixture);

            // First PUT a resource
            const content = "<html><body>Hello, World!</body></html>";
            const firstPut = await wttpBaseMethods.PUT(
                { path: "/test.html", protocol: "WTTP/2.0" },
                ethers.hexlify("0x7468"), // text/html
                ethers.hexlify("0x7574"), // utf-8
                ethers.hexlify("0x0101"), // datapoint/chunk
                tw3.address,
                ethers.toUtf8Bytes(content)
            );

            await firstPut.wait();

            // // Get LOCATE response to verify data points
            // const locateResponse = await wttpBaseMethods.LOCATE({ path: "/test.html", protocol: "WTTP/2.0" });
            // console.log("LOCATE Response:", locateResponse);

            // Then GET the resource
            const getResponse = await wttp.GET(
                { path: "/test.html", protocol: "WTTP/2.0" },
                { // RequestHeader
                    accept: [],
                    acceptCharset: [],
                    acceptLanguage: [],
                    ifModifiedSince: 0,
                    ifNoneMatch: ethers.ZeroHash
                },
                { // GETRequest
                    host: wttpBaseMethods.target,
                    rangeStart: 0,
                    rangeEnd: 0
                }
            );

            expect(getResponse.head.responseLine.code).to.equal(200);
            expect(ethers.toUtf8String(getResponse.body)).to.equal(content);
        });

        it("Should return 304 Not Modified when etag matches", async function () {
            const { wttpBaseMethods, wttp, tw3 } = await loadFixture(deployFixture);

            // PUT a resource
            const content = "<html><body>Hello, World!</body></html>";
            await wttpBaseMethods.PUT(
                { path: "/test.html", protocol: "WTTP/2.0" },
                ethers.hexlify("0x7468"),
                ethers.hexlify("0x7574"),
                ethers.hexlify("0x0101"),
                tw3.address,
                ethers.toUtf8Bytes(content)
            );

            // Get the etag from HEAD
            const headResponse = await wttpBaseMethods.HEAD({ path: "/test.html", protocol: "WTTP/2.0" });

            // GET with matching etag
            const getResponse = await wttp.GET(
                { path: "/test.html", protocol: "WTTP/2.0" },
                {
                    accept: [],
                    acceptCharset: [],
                    acceptLanguage: [],
                    ifModifiedSince: 0,
                    ifNoneMatch: headResponse.etag
                },
                {
                    host: wttpBaseMethods.target,
                    rangeStart: 0,
                    rangeEnd: 0
                }
            );

            expect(getResponse.head.responseLine.code).to.equal(304);
            expect(getResponse.body).to.equal("0x");
        });

        it("Should return 405 Method Not Allowed when GET is not allowed", async function () {
            const { wttpBaseMethods, wttp, tw3 } = await loadFixture(deployFixture);

            // PUT a resource
            const content = "<html><body>Hello, World!</body></html>";
            await wttpBaseMethods.PUT(
                { path: "/test.html", protocol: "WTTP/2.0" },
                ethers.hexlify("0x7468"),
                ethers.hexlify("0x7574"),
                ethers.hexlify("0x0101"),
                tw3.address,
                ethers.toUtf8Bytes(content)
            );

            // DEFINE new header that doesn't allow GET
            await wttpBaseMethods.DEFINE(
                { path: "/test.html", protocol: "WTTP/2.0" },
                {
                    cache: {
                        maxAge: 0,
                        sMaxage: 0,
                        noStore: false,
                        noCache: false,
                        immutableFlag: false,
                        mustRevalidate: false,
                        proxyRevalidate: false,
                        staleWhileRevalidate: 0,
                        staleIfError: 0,
                        publicFlag: false,
                        privateFlag: false
                    },
                    methods: 0, // No methods allowed
                    redirect: {
                        code: 0,
                        location: ""
                    },
                    resourceAdmin: ethers.ZeroHash
                }
            );

            // Try GET
            const getResponse = await wttp.GET(
                { path: "/test.html", protocol: "WTTP/2.0" },
                {
                    accept: [],
                    acceptCharset: [],
                    acceptLanguage: [],
                    ifModifiedSince: 0,
                    ifNoneMatch: ethers.ZeroHash
                },
                {
                    host: wttpBaseMethods.target,
                    rangeStart: 0,
                    rangeEnd: 0
                }
            );

            expect(getResponse.head.responseLine.code).to.equal(405);
        });
    });

    describe("GET Method - Multi-part Resources", function () {
        it("Should successfully GET a 3-part resource", async function () {
            const { wttpBaseMethods, wttp, tw3 } = await loadFixture(deployFixture);

            // Create a 3-part HTML file
            const part1 = "<html><head><title>Multi-part Test</title></head>";
            const part2 = "<body><h1>Hello World</h1>";
            const part3 = "<p>This is a test</p></body></html>";
            const fullContent = part1 + part2 + part3;

            // PUT first part
            await wttpBaseMethods.PUT(
                { path: "/multipart.html", protocol: "WTTP/2.0" },
                ethers.hexlify("0x7468"), // text/html
                ethers.hexlify("0x7574"), // utf-8
                ethers.hexlify("0x0101"), // datapoint/chunk
                tw3.address,
                ethers.toUtf8Bytes(part1)
            );

            // PATCH remaining parts
            await wttpBaseMethods.PATCH(
                { path: "/multipart.html", protocol: "WTTP/2.0" },
                ethers.toUtf8Bytes(part2),
                1,
                tw3.address
            );

            await wttpBaseMethods.PATCH(
                { path: "/multipart.html", protocol: "WTTP/2.0" },
                ethers.toUtf8Bytes(part3),
                2,
                tw3.address
            );

            // GET the complete resource
            const getResponse = await wttp.GET(
                { path: "/multipart.html", protocol: "WTTP/2.0" },
                {
                    accept: [],
                    acceptCharset: [],
                    acceptLanguage: [],
                    ifModifiedSince: 0,
                    ifNoneMatch: ethers.ZeroHash
                },
                {
                    host: wttpBaseMethods.target,
                    rangeStart: 0,
                    rangeEnd: 0
                }
            );

            expect(getResponse.head.responseLine.code).to.equal(200);
            expect(ethers.toUtf8String(getResponse.body)).to.equal(fullContent);
        });

        it("Should successfully GET ranges from a 20-part resource", async function () {
            const { wttpBaseMethods, wttp, tw3 } = await loadFixture(deployFixture);

            // Create a 20-part text file, each part containing a number
            const parts = Array.from({ length: 20 }, (_, i) => `Part ${i + 1}\n`);
            const fullContent = parts.join("");

            // PUT first part
            await wttpBaseMethods.PUT(
                { path: "/large.txt", protocol: "WTTP/2.0" },
                ethers.hexlify("0x7474"), // text/plain
                ethers.hexlify("0x7574"), // utf-8
                ethers.hexlify("0x0101"), // datapoint/chunk
                tw3.address,
                ethers.toUtf8Bytes(parts[0])
            );

            // PATCH remaining parts
            for (let i = 1; i < 20; i++) {
                await wttpBaseMethods.PATCH(
                    { path: "/large.txt", protocol: "WTTP/2.0" },
                    ethers.toUtf8Bytes(parts[i]),
                    i,
                    tw3.address
                );
            }

            // Test different ranges
            const ranges = [
                { start: 0, end: 4 },    // First 5 parts
                { start: 10, end: 14 },  // Middle 5 parts
                { start: 15, end: 19 }   // Last 5 parts
            ];

            for (const range of ranges) {
                const getResponse = await wttp.GET(
                    { path: "/large.txt", protocol: "WTTP/2.0" },
                    {
                        accept: [],
                        acceptCharset: [],
                        acceptLanguage: [],
                        ifModifiedSince: 0,
                        ifNoneMatch: ethers.ZeroHash
                    },
                    {
                        host: wttpBaseMethods.target,
                        rangeStart: range.start,
                        rangeEnd: range.end
                    }
                );

                expect(getResponse.head.responseLine.code).to.equal(206); // Partial Content
                const expectedContent = parts.slice(range.start, range.end + 1).join("");
                expect(ethers.toUtf8String(getResponse.body)).to.equal(expectedContent);
            }

            // Verify complete content with a full GET
            const fullGetResponse = await wttp.GET(
                { path: "/large.txt", protocol: "WTTP/2.0" },
                {
                    accept: [],
                    acceptCharset: [],
                    acceptLanguage: [],
                    ifModifiedSince: 0,
                    ifNoneMatch: ethers.ZeroHash
                },
                {
                    host: wttpBaseMethods.target,
                    rangeStart: 0,
                    rangeEnd: 19
                }
            );

            expect(fullGetResponse.head.responseLine.code).to.equal(200);
            expect(ethers.toUtf8String(fullGetResponse.body)).to.equal(fullContent);
        });

        it("Should return 416 for invalid ranges", async function () {
            const { wttpBaseMethods, wttp, tw3 } = await loadFixture(deployFixture);

            // Create a simple 3-part resource first
            await wttpBaseMethods.PUT(
                { path: "/range-test.txt", protocol: "WTTP/2.0" },
                ethers.hexlify("0x7474"),
                ethers.hexlify("0x7574"),
                ethers.hexlify("0x0101"),
                tw3.address,
                ethers.toUtf8Bytes("Part 1")
            );

            // Test invalid ranges
            const invalidRanges = [
                { start: 5, end: 10 },   // Beyond file length
                { start: 2, end: 1 },    // Invalid range (end before start)
                { start: 0, end: 100 }   // End beyond file length
            ];

            for (const range of invalidRanges) {
                const getResponse = await wttp.GET(
                    { path: "/range-test.txt", protocol: "WTTP/2.0" },
                    {
                        accept: [],
                        acceptCharset: [],
                        acceptLanguage: [],
                        ifModifiedSince: 0,
                        ifNoneMatch: ethers.ZeroHash
                    },
                    {
                        host: wttpBaseMethods.target,
                        rangeStart: range.start,
                        rangeEnd: range.end
                    }
                );

                expect(getResponse.head.responseLine.code).to.equal(416); // Range Not Satisfiable
            }
        });
    });

    describe("GET Method - Error Handling", function () {
        it("Should return 404 for non-existent resources", async function () {
            const { wttpBaseMethods, wttp } = await loadFixture(deployFixture);

            // Try to GET a non-existent resource
            const getResponse = await wttp.GET(
                { path: "/does-not-exist.html", protocol: "WTTP/2.0" },
                {
                    accept: [],
                    acceptCharset: [],
                    acceptLanguage: [],
                    ifModifiedSince: 0,
                    ifNoneMatch: ethers.ZeroHash
                },
                {
                    host: wttpBaseMethods.target,
                    rangeStart: 0,
                    rangeEnd: 0
                }
            );

            expect(getResponse.head.responseLine.code).to.equal(404);
            expect(getResponse.body).to.equal("0x");

            // Try with a different non-existent path
            const getResponse2 = await wttp.GET(
                { path: "/missing/nested/file.txt", protocol: "WTTP/2.0" },
                {
                    accept: [],
                    acceptCharset: [],
                    acceptLanguage: [],
                    ifModifiedSince: 0,
                    ifNoneMatch: ethers.ZeroHash
                },
                {
                    host: wttpBaseMethods.target,
                    rangeStart: 0,
                    rangeEnd: 0
                }
            );

            expect(getResponse2.head.responseLine.code).to.equal(404);
            expect(getResponse2.body).to.equal("0x");
        });
    });
});
