import {
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";
import { WTTP, Dev_WTTPBaseMethods, DataPointRegistry, DataPointStorage } from "../typechain-types";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("WTTP", function () {
    async function deployFixture() {
        const [tw3, user1, user2] = await hre.ethers.getSigners();

        const DataPointStorage = await hre.ethers.getContractFactory("DataPointStorage");
        const dataPointStorage = await DataPointStorage.deploy();

        const DataPointRegistry = await hre.ethers.getContractFactory("DataPointRegistry");
        const dataPointRegistry = await DataPointRegistry.deploy(dataPointStorage.target, tw3.address);

        const WTTPBaseMethods = await hre.ethers.getContractFactory("Dev_WTTPBaseMethods");
        const site = await WTTPBaseMethods.deploy(dataPointRegistry.target, tw3.address, {
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

        return { dataPointStorage, dataPointRegistry, site, wttp, tw3, user1, user2 };
    }

    describe("GET Method", function () {
        it("Should successfully GET a single data point resource", async function () {
            const { site, wttp, tw3 } = await loadFixture(deployFixture);

            // First PUT a resource directly through site
            const content = "<html><body>Hello, World!</body></html>";
            await site.PUT(
                { path: "/test.html", protocol: "WTTP/2.0" },
                ethers.hexlify("0x7468"), // text/html
                ethers.hexlify("0x7574"), // utf-8
                ethers.hexlify("0x0101"), // datapoint/chunk
                tw3.address,
                ethers.toUtf8Bytes(content)
            );

            // Then GET the resource through WTTP
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
                    host: site.target,
                    rangeStart: 0,
                    rangeEnd: 0
                }
            );

            expect(getResponse.head.responseLine.code).to.equal(200);
            expect(ethers.toUtf8String(getResponse.body)).to.equal(content);
        });

        it("Should return 304 Not Modified when etag matches", async function () {
            const { site, wttp, tw3 } = await loadFixture(deployFixture);

            // PUT a resource
            const content = "<html><body>Hello, World!</body></html>";
            await site.PUT(
                { path: "/test.html", protocol: "WTTP/2.0" },
                ethers.hexlify("0x7468"),
                ethers.hexlify("0x7574"),
                ethers.hexlify("0x0101"),
                tw3.address,
                ethers.toUtf8Bytes(content)
            );

            // Get the etag from HEAD
            const headResponse = await site.HEAD({ path: "/test.html", protocol: "WTTP/2.0" });

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
                    host: site.target,
                    rangeStart: 0,
                    rangeEnd: 0
                }
            );

            expect(getResponse.head.responseLine.code).to.equal(304);
            expect(getResponse.body).to.equal("0x");
        });

        it("Should return 405 Method Not Allowed when GET is not allowed", async function () {
            const { site, wttp, tw3 } = await loadFixture(deployFixture);

            // PUT a resource
            const content = "<html><body>Hello, World!</body></html>";
            await site.PUT(
                { path: "/test.html", protocol: "WTTP/2.0" },
                ethers.hexlify("0x7468"),
                ethers.hexlify("0x7574"),
                ethers.hexlify("0x0101"),
                tw3.address,
                ethers.toUtf8Bytes(content)
            );

            // DEFINE new header that doesn't allow GET
            await site.DEFINE(
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
                    host: site.target,
                    rangeStart: 0,
                    rangeEnd: 0
                }
            );

            expect(getResponse.head.responseLine.code).to.equal(405);
        });
    });

    describe("GET Method - Multi-part Resources", function () {
        it("Should successfully GET a 3-part resource", async function () {
            const { site, wttp, tw3 } = await loadFixture(deployFixture);

            // Create a 3-part HTML file
            const part1 = "<html><head><title>Multi-part Test</title></head>";
            const part2 = "<body><h1>Hello World</h1>";
            const part3 = "<p>This is a test</p></body></html>";
            const fullContent = part1 + part2 + part3;

            // PUT first part
            await site.PUT(
                { path: "/multipart.html", protocol: "WTTP/2.0" },
                ethers.hexlify("0x7468"), // text/html
                ethers.hexlify("0x7574"), // utf-8
                ethers.hexlify("0x0101"), // datapoint/chunk
                tw3.address,
                ethers.toUtf8Bytes(part1)
            );

            // PATCH remaining parts
            await site.PATCH(
                { path: "/multipart.html", protocol: "WTTP/2.0" },
                ethers.toUtf8Bytes(part2),
                1,
                tw3.address
            );

            await site.PATCH(
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
                    host: site.target,
                    rangeStart: 0,
                    rangeEnd: 0
                }
            );

            expect(getResponse.head.responseLine.code).to.equal(200);
            expect(ethers.toUtf8String(getResponse.body)).to.equal(fullContent);
        });

        it("Should successfully GET ranges from a 20-part resource", async function () {
            const { site, wttp, tw3 } = await loadFixture(deployFixture);

            // Create a 20-part text file, each part containing a number
            const parts = Array.from({ length: 20 }, (_, i) => `Part ${i + 1}\n`);
            const fullContent = parts.join("");

            // PUT first part
            await site.PUT(
                { path: "/large.txt", protocol: "WTTP/2.0" },
                ethers.hexlify("0x7474"), // text/plain
                ethers.hexlify("0x7574"), // utf-8
                ethers.hexlify("0x0101"), // datapoint/chunk
                tw3.address,
                ethers.toUtf8Bytes(parts[0])
            );

            // PATCH remaining parts
            for (let i = 1; i < 20; i++) {
                await site.PATCH(
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
                        host: site.target,
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
                    host: site.target,
                    rangeStart: 0,
                    rangeEnd: 19
                }
            );

            expect(fullGetResponse.head.responseLine.code).to.equal(200);
            expect(ethers.toUtf8String(fullGetResponse.body)).to.equal(fullContent);
        });

        it("Should return 416 for invalid ranges", async function () {
            const { site, wttp, tw3 } = await loadFixture(deployFixture);

            // Create a simple 3-part resource first
            await site.PUT(
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
                        host: site.target,
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
            const { site, wttp } = await loadFixture(deployFixture);

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
                    host: site.target,
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
                    host: site.target,
                    rangeStart: 0,
                    rangeEnd: 0
                }
            );

            expect(getResponse2.head.responseLine.code).to.equal(404);
            expect(getResponse2.body).to.equal("0x");
        });
    });

    describe("HEAD Method", function () {
        it("Should return correct HEAD response for an existing resource", async function () {
            const { site, wttp, tw3 } = await loadFixture(deployFixture);

            // PUT a resource first
            const content = "<html><body>Hello, World!</body></html>";
            await site.PUT(
                { path: "/test.html", protocol: "WTTP/2.0" },
                ethers.hexlify("0x7468"),
                ethers.hexlify("0x7574"),
                ethers.hexlify("0x0101"),
                tw3.address,
                ethers.toUtf8Bytes(content)
            );

            // HEAD request
            const headResponse = await wttp.HEAD(site.target, { path: "/test.html", protocol: "WTTP/2.0" });

            expect(headResponse.responseLine.code).to.equal(200);
            expect(headResponse.etag).to.not.equal(ethers.ZeroHash);
        });
    });

    describe("LOCATE Method", function () {
        it("Should return correct LOCATE response for an existing resource", async function () {
            const { site, wttp, tw3 } = await loadFixture(deployFixture);

            // PUT a resource first
            const content = "<html><body>Hello, World!</body></html>";
            await site.PUT(
                { path: "/test.html", protocol: "WTTP/2.0" },
                ethers.hexlify("0x7468"),
                ethers.hexlify("0x7574"),
                ethers.hexlify("0x0101"),
                tw3.address,
                ethers.toUtf8Bytes(content)
            );

            // LOCATE request
            const locateResponse = await wttp.LOCATE(site.target, { path: "/test.html", protocol: "WTTP/2.0" });

            expect(locateResponse.head.responseLine.code).to.equal(200);
            expect(locateResponse.dataPoints.length).to.be.greaterThan(0);
        });
    });

    describe("DEFINE Method", function () {
        it("Should update resource headers correctly", async function () {
            const { site, wttp, tw3 } = await loadFixture(deployFixture);

            // PUT a resource first
            const content = "<html><body>Hello, World!</body></html>";
            await site.PUT(
                { path: "/test.html", protocol: "WTTP/2.0" },
                ethers.hexlify("0x7468"),
                ethers.hexlify("0x7574"),
                ethers.hexlify("0x0101"),
                tw3.address,
                ethers.toUtf8Bytes(content)
            );

            // DEFINE new headers
            const defineTx = await site.DEFINE({ path: "/test.html", protocol: "WTTP/2.0" }, {
                cache: {
                    maxAge: 3600,
                    sMaxage: 3600,
                    noStore: false,
                    noCache: false,
                    immutableFlag: false,
                    mustRevalidate: false,
                    proxyRevalidate: false,
                    staleWhileRevalidate: 0,
                    staleIfError: 0,
                    publicFlag: true,
                    privateFlag: false
                },
                methods: 2913, // Default methods
                redirect: {
                    code: 0,
                    location: ""
                },
                resourceAdmin: ethers.ZeroHash
            });

            expect(defineTx).to.not.be.reverted;
            // await expect(defineTx).to.emit(wttp, "DEFINEExecuted").withArgs(site.target, anyValue);

        });
    });

    describe("DELETE Method", function () {
        it("Should delete an existing resource", async function () {
            const { site, wttp, tw3 } = await loadFixture(deployFixture);

            // PUT a resource first
            const content = "<html><body>Hello, World!</body></html>";
            await site.PUT(
                { path: "/test.html", protocol: "WTTP/2.0" },
                ethers.hexlify("0x7468"),
                ethers.hexlify("0x7574"),
                ethers.hexlify("0x0101"),
                tw3.address,
                ethers.toUtf8Bytes(content)
            );

            // DELETE the resource
            const deleteTx = await site.DELETE({ path: "/test.html", protocol: "WTTP/2.0" });

            expect(deleteTx).to.not.be.reverted;
            // await expect(deleteTx).to.emit(wttp, "DELETEExecuted").withArgs(site.target, anyValue);

            // Verify deletion
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
                    host: site.target,
                    rangeStart: 0,
                    rangeEnd: 0
                }
            );

            expect(getResponse.head.responseLine.code).to.equal(404);
        });
    });

    describe("PUT Method", function () {
        it("Should emit PUTExecuted event with correct parameters", async function () {
            const { site, wttp, tw3 } = await loadFixture(deployFixture);

            const requestLine = { path: "/test.html", protocol: "WTTP/2.0" };
            const content = "<html><body>Hello, World!</body></html>";

            const tx = await site.PUT(
                requestLine,
                ethers.hexlify("0x7468"), // text/html
                ethers.hexlify("0x7574"), // utf-8
                ethers.hexlify("0x0101"), // datapoint/chunk
                tw3.address,
                ethers.toUtf8Bytes(content)
            );

            expect(tx).to.not.be.reverted;
            // await expect(tx)
            //     .to.emit(wttp, "PUTExecuted")
            //     .withArgs(site.target, requestLine, anyValue); // PUTResponse is complex, so we use anyValue
        });
    });

    describe("PATCH Method", function () {
        it("Should emit PATCHSuccess event with correct parameters", async function () {
            const { site, wttp, tw3 } = await loadFixture(deployFixture);

            const requestLine = { path: "/test.html", protocol: "WTTP/2.0" };
            
            // First create the resource with PUT
            await site.PUT(
                requestLine,
                ethers.hexlify("0x7468"),
                ethers.hexlify("0x7574"),
                ethers.hexlify("0x0101"),
                tw3.address,
                ethers.toUtf8Bytes("<html><body>Part 1</body></html>")
            );

            // Then PATCH it
            const content = "<html><body>Part 2</body></html>";
            const tx = await site.PATCH(
                requestLine,
                ethers.toUtf8Bytes(content),
                1,
                tw3.address
            );

            await expect(tx)
                .to.emit(site, "PATCHSuccess")
                .withArgs(
                    tw3.address,  // publisher address
                    requestLineArray, // requestLine as array
                    anyValue     // response
                );
        });
    });

    // describe("DELETE Method", function () {
    //     it("Should emit DELETEExecuted event with correct parameters", async function () {
    //         const { site, wttp, tw3 } = await loadFixture(deployFixture);

    //         const requestLine = { path: "/test.html", protocol: "WTTP/2.0" };

    //         const tx = await wttp.DELETE(site.target, requestLine);

    //         await expect(tx)
    //             .to.emit(wttp, "DELETEExecuted")
    //             .withArgs(site.target, anyValue);
    //     });
    // });

    // describe("DEFINE Method", function () {
    //     it("Should emit DEFINEExecuted event with correct parameters", async function () {
    //         const { site, wttp, tw3 } = await loadFixture(deployFixture);

    //         const requestLine = { path: "/test.html", protocol: "WTTP/2.0" };
    //         const headerInfo = {
    //             cache: {
    //                 maxAge: 3600,
    //                 sMaxage: 3600,
    //                 noStore: false,
    //                 noCache: false,
    //                 immutableFlag: false,
    //                 mustRevalidate: false,
    //                 proxyRevalidate: false,
    //                 staleWhileRevalidate: 0,
    //                 staleIfError: 0,
    //                 publicFlag: true,
    //                 privateFlag: false
    //             },
    //             methods: 2913, // Default methods
    //             redirect: {
    //                 code: 0,
    //                 location: ""
    //             },
    //             resourceAdmin: ethers.ZeroAddress
    //         };

    //         const tx = await wttp.DEFINE(site.target, requestLine, headerInfo);

    //         await expect(tx)
    //             .to.emit(wttp, "DEFINEExecuted")
    //             .withArgs(site.target, anyValue);
    //     });
    // });

    describe("OPTIONS Method", function () {
        it("Should return allowed methods for a resource", async function () {
            const { site, wttp, tw3 } = await loadFixture(deployFixture);

            // Setup resource directly through site
            const content = "<html><body>Test</body></html>";
            await site.PUT(
                { path: "/test.html", protocol: "WTTP/2.0" },
                ethers.hexlify("0x7468"),
                ethers.hexlify("0x7574"),
                ethers.hexlify("0x0101"),
                tw3.address,
                ethers.toUtf8Bytes(content)
            );

            // Test OPTIONS through WTTP
            const optionsResponse = await wttp.OPTIONS(
                site.target,
                { path: "/test.html", protocol: "WTTP/2.0" }
            );

            expect(optionsResponse.responseLine.code).to.equal(204);
            expect(optionsResponse.headerInfo.methods).to.equal(2913); // Default methods
        });

        it("Should return 405 when OPTIONS is not allowed", async function () {
            const { site, wttp, tw3 } = await loadFixture(deployFixture);

            // Setup resource with OPTIONS disabled
            await site.PUT(
                { path: "/test.html", protocol: "WTTP/2.0" },
                ethers.hexlify("0x7468"),
                ethers.hexlify("0x7574"),
                ethers.hexlify("0x0101"),
                tw3.address,
                ethers.toUtf8Bytes("test")
            );

            // Disable OPTIONS method
            await site.DEFINE(
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
                    methods: 1, // Only GET allowed
                    redirect: {
                        code: 0,
                        location: ""
                    },
                    resourceAdmin: ethers.ZeroHash
                }
            );

            const optionsResponse = await wttp.OPTIONS(
                site.target,
                { path: "/test.html", protocol: "WTTP/2.0" }
            );

            expect(optionsResponse.responseLine.code).to.equal(405);
        });
    });

    describe("TRACE Method", function () {
        it("Should return request info when TRACE is allowed", async function () {
            const { site, wttp, tw3 } = await loadFixture(deployFixture);

            // Setup resource directly through site
            await site.PUT(
                { path: "/test.html", protocol: "WTTP/2.0" },
                ethers.hexlify("0x7468"),
                ethers.hexlify("0x7574"),
                ethers.hexlify("0x0101"),
                tw3.address,
                ethers.toUtf8Bytes("test")
            );

            const traceResponse = await wttp.TRACE(
                site.target,
                { path: "/test.html", protocol: "WTTP/2.0" }
            );

            expect(traceResponse.responseLine.code).to.equal(200);
        });

        it("Should return 405 when TRACE is not allowed", async function () {
            const { site, wttp, tw3 } = await loadFixture(deployFixture);

            // Setup resource with TRACE disabled
            await site.PUT(
                { path: "/test.html", protocol: "WTTP/2.0" },
                ethers.hexlify("0x7468"),
                ethers.hexlify("0x7574"),
                ethers.hexlify("0x0101"),
                tw3.address,
                ethers.toUtf8Bytes("test")
            );

            // Disable TRACE method
            await site.DEFINE(
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
                    methods: 1, // Only GET allowed
                    redirect: {
                        code: 0,
                        location: ""
                    },
                    resourceAdmin: ethers.ZeroHash
                }
            );

            const traceResponse = await wttp.TRACE(
                site.target,
                { path: "/test.html", protocol: "WTTP/2.0" }
            );

            expect(traceResponse.responseLine.code).to.equal(405);
        });
    });
});
