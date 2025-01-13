import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";
import { contractManager } from '../lib/contractManager';
import { 
    WTTP, 
    DataPointRegistry, 
    DataPointStorage 
} from "../typechain-types";
import { DEFAULT_HEADER } from "../src/types/constants";
import { Contract } from "ethers";

describe("WTTP Protocol", function () {
    let dataPointStorage;
    let dataPointRegistry;
    let site: any;
    let wttp: any;
    let tw3: any;
    let user1: any;
    let user2: any;
    let gasPrice: any;

    async function estimateGas() {
        const feeData = await hre.ethers.provider.getFeeData();
        
        // Network-specific default gas prices (in gwei)
        const defaultGasPrices = {
            'polygon': BigInt(40000000000),    // 40 gwei
            'arbitrum': BigInt(250000000),     // 0.25 gwei
            'optimism': BigInt(150000),        // 0.00015 gwei
            'base': BigInt(150000),            // 0.00015 gwei
            'avalanche': BigInt(15000000),     // 0.015 gwei
            'fantom': BigInt(100000000),       // 0.1 gwei
            'hardhat': BigInt(40000000000),    // 40 gwei (fallback)
        };

        const networkName = hre.network.name.toLowerCase();
        const defaultGasPrice = defaultGasPrices[networkName] || defaultGasPrices['hardhat'];

        // For EIP-1559 compatible networks
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
            return {
                deployParams: {
                    maxFeePerGas: feeData.maxFeePerGas,
                    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
                },
                txParams: {
                    maxFeePerGas: feeData.maxFeePerGas,
                    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
                    gasLimit: BigInt(2000000), // Reasonable gas limit for transactions
                }
            };
        }

        // For legacy networks
        return {
            deployParams: {
                gasPrice: feeData.gasPrice || defaultGasPrice,
            },
            txParams: {
                gasPrice: feeData.gasPrice || defaultGasPrice,
                gasLimit: BigInt(2000000),
            }
        };
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
            gasPrice.txParams
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
            dataPointStorage = DataPointStorage.attach(existingDPSAddress);
        } else {
            gasPrice = await estimateGas();
            dataPointStorage = await DataPointStorage.deploy(
                gasPrice.deployParams
            );
            await dataPointStorage.waitForDeployment();
            contractManager.saveContract('dataPointStorage', await dataPointStorage.getAddress());
            console.log("DataPointStorage deployed at:", await dataPointStorage.getAddress());
        }

        // Similar pattern for other contracts...
        const DataPointRegistry = await hre.ethers.getContractFactory("DataPointRegistry");
        const existingDPRAddress = contractManager.getContractAddress('dataPointRegistry');
        
        if (existingDPRAddress) {
            dataPointRegistry = DataPointRegistry.attach(existingDPRAddress);
        } else {
            gasPrice = await estimateGas();
            console.log("gasPrice", gasPrice);
            dataPointRegistry = await DataPointRegistry.deploy(
                await dataPointStorage.getAddress(),
                tw3.address,
                1000000,
                gasPrice.deployParams
            );
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
                gasPrice.deployParams
            );
            await site.waitForDeployment();
            contractManager.saveContract('wttpSite', await site.getAddress());
            console.log("WTTPSite deployed at:", await site.getAddress());
        }

        // Deploy WTTP
        const WTTP = await hre.ethers.getContractFactory("WTTP");
        const existingWTTPAddress = contractManager.getContractAddress('wttp');
        
        if (existingWTTPAddress) {
            wttp = WTTP.attach(existingWTTPAddress);
        } else {
            gasPrice = await estimateGas();
            wttp = await WTTP.deploy(
                gasPrice.deployParams
            ) as Contract;
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
                gasPrice.txParams
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
                    gasPrice.txParams
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