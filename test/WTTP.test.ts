import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";
import { contractManager } from '../src/utils/contractManager';
import { 
    WTTP, 
    DataPointRegistry, 
    DataPointStorage 
} from "../typechain-types";
import { DEFAULT_HEADER } from "../src/types/constants";

describe("WTTP Protocol", function () {
    let dataPointStorage: DataPointStorage;
    let dataPointRegistry: DataPointRegistry;
    let site: any;
    let wttp: WTTP;
    let tw3: any;
    let user1: any;
    let user2: any;
    let gasPrice: any;

    async function estimateGas() {
        return await hre.ethers.provider.getFeeData();
    }

    // Helper function to create test content
    async function createTestResource(path: string, content: string) {
        gasPrice = await estimateGas();
        const tx = await site.PUT(
            { path, protocol: "WTTP/2.0" },
            ethers.hexlify("0x7468"), // text/html
            ethers.hexlify("0x7574"), // utf-8
            ethers.hexlify("0x0101"), // datapoint/chunk
            tw3.address,
            ethers.toUtf8Bytes(content),
            { 
                maxFeePerGas: gasPrice.maxFeePerGas, 
                maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas 
            }
        );
        await tx.wait();
    }

    before(async function () {
        this.timeout(60000);
        [tw3, user1, user2] = await hre.ethers.getSigners();

        // Deploy or load contracts using contractManager
        const DataPointStorage = await hre.ethers.getContractFactory("DataPointStorage");
        const existingDPSAddress = contractManager.getContractAddress('dataPointStorage');
        
        if (existingDPSAddress) {
            console.log("Loading existing DataPointStorage at:", existingDPSAddress);
            dataPointStorage = DataPointStorage.attach(existingDPSAddress) as DataPointStorage;
        } else {
            gasPrice = await estimateGas();
            dataPointStorage = await DataPointStorage.deploy({
                maxFeePerGas: gasPrice.maxFeePerGas,
                maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas
            }) as DataPointStorage;
            await dataPointStorage.waitForDeployment();
            contractManager.saveContract('dataPointStorage', await dataPointStorage.getAddress());
            console.log("DataPointStorage deployed at:", await dataPointStorage.getAddress());
        }

        // Similar pattern for other contracts...
        const DataPointRegistry = await hre.ethers.getContractFactory("DataPointRegistry");
        const existingDPRAddress = contractManager.getContractAddress('dataPointRegistry');
        
        if (existingDPRAddress) {
            dataPointRegistry = DataPointRegistry.attach(existingDPRAddress) as DataPointRegistry;
        } else {
            gasPrice = await estimateGas();
            dataPointRegistry = await DataPointRegistry.deploy(
                await dataPointStorage.getAddress(),
                tw3.address,
                {
                    maxFeePerGas: gasPrice.maxFeePerGas,
                    maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas
                }
            ) as DataPointRegistry;
            await dataPointRegistry.waitForDeployment();
            contractManager.saveContract('dataPointRegistry', await dataPointRegistry.getAddress());
        }

        // Deploy WTTP Site
        const WTTPSite = await hre.ethers.getContractFactory("MyFirstWTTPSite");
        const existingSiteAddress = undefined; // contractManager.getContractAddress('wttpSite');
        
        if (existingSiteAddress) {
            site = WTTPSite.attach(existingSiteAddress);
        } else {
            gasPrice = await estimateGas();
            site = await WTTPSite.deploy(
                dataPointRegistry.target,
                tw3.address,
                DEFAULT_HEADER
                // ,
                // {
                //     maxFeePerGas: gasPrice.maxFeePerGas,
                //     maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas
                // }
            );
            await site.waitForDeployment();
            contractManager.saveContract('wttpSite', await site.getAddress());
            console.log("WTTPSite deployed at:", await site.getAddress());
        }

        // Deploy WTTP
        const WTTP = await hre.ethers.getContractFactory("WTTP");
        const existingWTTPAddress = contractManager.getContractAddress('wttp');
        
        if (existingWTTPAddress) {
            wttp = WTTP.attach(existingWTTPAddress) as WTTP;
        } else {
            gasPrice = await estimateGas();
            wttp = await WTTP.deploy({
                maxFeePerGas: gasPrice.maxFeePerGas,
                maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas
            }) as WTTP;
            await wttp.waitForDeployment();
            contractManager.saveContract('wttp', await wttp.getAddress());
        }
    });

    describe("GET Method", function () {
        beforeEach(async function() {
            this.timeout(30000);
        });

        it("Should successfully GET a single data point resource", async function () {
            const content = `<html><body>Should successfully GET a single data point resource ${Date.now()}</body></html>`;
            await createTestResource("/test.html", content);

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

            expect(getResponse.head.responseLine.code).to.equal(200);
            expect(ethers.toUtf8String(getResponse.body)).to.equal(content);
        });

        it("Should return 304 Not Modified when etag matches", async function () {
            const content = `<html><body>Should return 304 Not Modified when etag matches ${Date.now()}</body></html>`;
            await createTestResource("/etag-test.html", content);

            const headResponse = await site.HEAD({ 
                path: "/etag-test.html", 
                protocol: "WTTP/2.0" 
            });

            const getResponse = await wttp.GET(
                { path: "/etag-test.html", protocol: "WTTP/2.0" },
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
    });

    describe("GET Method - Multi-part Resources", function () {
        beforeEach(async function() {
            this.timeout(60000);
        });

        it("Should successfully GET a 3-part resource", async function () {
            this.timeout(100000);
            const parts = [
                `<html><head><title>Multi-part Test ${Date.now()}</title></head>`,
                `<body><h1>Hello World ${Date.now()}</h1>`,
                `<p>This is a test ${Date.now()}</p></body></html>`
            ];
            const fullContent = parts.join("");

            // PUT first part
            gasPrice = await estimateGas();
            let tx = await site.PUT(
                { path: "/multipart.html", protocol: "WTTP/2.0" },
                ethers.hexlify("0x7468"),
                ethers.hexlify("0x7574"),
                ethers.hexlify("0x0101"),
                tw3.address,
                ethers.toUtf8Bytes(parts[0]),
                {
                    maxFeePerGas: gasPrice.maxFeePerGas,
                    maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas
                }
            );
            await tx.wait();

            // PATCH remaining parts
            for (let i = 1; i < parts.length; i++) {
                gasPrice = await estimateGas();
                tx = await site.PATCH(
                    { path: "/multipart.html", protocol: "WTTP/2.0" },
                    ethers.toUtf8Bytes(parts[i]),
                    i,
                    tw3.address,
                    {
                        maxFeePerGas: gasPrice.maxFeePerGas,
                        maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas
                    }
                );
                await tx.wait();
            }

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
                    rangeEnd: parts.length - 1
                }
            );

            expect(getResponse.head.responseLine.code).to.equal(200);
            expect(ethers.toUtf8String(getResponse.body)).to.equal(fullContent);
        });

        it("Should return 416 for invalid ranges", async function () {
            await createTestResource("/range-test.txt", `Test content ${Date.now()}`);

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

                expect(getResponse.head.responseLine.code).to.equal(416);
            }
        });
    });
}); 