import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";
import { contractManager } from './helpers/contractManager';
import { DataPointStorage, Dev_DataPointRegistry } from "../typechain-types";

describe("WebStorage", function () {
    let dataPointStorage: any;
    let dataPointRegistry: any;
    let statusMap: any;
    let typeMap: any;
    let tw3: any;
    let publisher: any;
    let dev: any;
    let gasPrice: any;

    async function estimateGas() {
        return await hre.ethers.provider.getFeeData();
    }

    before(async function () {
        this.timeout(60000);
        [tw3, publisher, dev] = await hre.ethers.getSigners();

        // Deploy or load StatusMap
        const StatusMap = await hre.ethers.getContractFactory("StatusMap");
        const existingStatusMapAddress = undefined;
        
        if (existingStatusMapAddress) {
            console.log("Loading existing StatusMap at:", existingStatusMapAddress);
            statusMap = StatusMap.attach(existingStatusMapAddress);
        } else {
            gasPrice = await estimateGas();
            statusMap = await StatusMap.deploy({
                maxFeePerGas: gasPrice.maxFeePerGas,
                maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas
            });
            await statusMap.waitForDeployment();
            contractManager.saveContract('statusMap', await statusMap.getAddress());
            console.log("StatusMap deployed at:", await statusMap.getAddress());
        }

        // Deploy or load TypeMap
        const TypeMap = await hre.ethers.getContractFactory("TypeMap");
        const existingTypeMapAddress = undefined;
        
        if (existingTypeMapAddress) {
            console.log("Loading existing TypeMap at:", existingTypeMapAddress);
            typeMap = TypeMap.attach(existingTypeMapAddress);
        } else {
            gasPrice = await estimateGas();
            typeMap = await TypeMap.deploy({
                maxFeePerGas: gasPrice.maxFeePerGas,
                maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas
            });
            await typeMap.waitForDeployment();
            contractManager.saveContract('typeMap', await typeMap.getAddress());
            console.log("TypeMap deployed at:", await typeMap.getAddress());
        }

        // Deploy or load DataPointStorage
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

        // Deploy or load DataPointRegistry
        const DataPointRegistry = await hre.ethers.getContractFactory("Dev_DataPointRegistry");
        const existingDPRAddress = undefined;
        
        if (existingDPRAddress) {
            console.log("Loading existing DataPointRegistry at:", existingDPRAddress);
            dataPointRegistry = DataPointRegistry.attach(existingDPRAddress);
        } else {
            gasPrice = await estimateGas();
            dataPointRegistry = await DataPointRegistry.deploy(
                await dataPointStorage.getAddress(),
                tw3.address,
                {
                    maxFeePerGas: gasPrice.maxFeePerGas,
                    maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas
                }
            ) as Dev_DataPointRegistry;
            await dataPointRegistry.waitForDeployment();
            contractManager.saveContract('dataPointRegistry', await dataPointRegistry.getAddress());
            console.log("DataPointRegistry deployed at:", await dataPointRegistry.getAddress());
        }
    });

    describe("StatusMap", function () {
        it("Should set and get status codes correctly", async function () {
            expect(await statusMap.getReasonPhrase(200)).to.equal("OK");
            expect(await statusMap.getStatusCode("Not Found")).to.equal(404);
        });

        it("Should allow owner to add new status codes", async function () {
            gasPrice = await estimateGas();
            const tx = await statusMap.setStatus(599, "Custom Error", {
                maxFeePerGas: gasPrice.maxFeePerGas,
                maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas
            });
            await tx.wait();

            expect(await statusMap.getReasonPhrase(599)).to.equal("Custom Error");
            expect(await statusMap.getStatusCode("Custom Error")).to.equal(599);
        });

        it("Should not allow non-owner to add new status codes", async function () {
            gasPrice = await estimateGas();
            await expect(
                statusMap.connect(publisher).setStatus(599, "Custom Error", {
                    maxFeePerGas: gasPrice.maxFeePerGas,
                    maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas
                })
            ).to.be.reverted;
        });
    });

    describe("TypeMap", function () {
        it("Should handle MIME types correctly", async function () {
            // Batch read operations
            expect(await typeMap.getTypeBytes(0, "text/plain")).to.equal("0x7470");
            expect(await typeMap.getTypeBytes(0, "application/json")).to.equal("0x786a");
            expect(await typeMap.getTypeString(0, "0x7470")).to.equal("text/plain");
            expect(await typeMap.getTypeString(0, "0x786A")).to.equal("application/json");
        });

        it("Should manage custom types", async function () {
            gasPrice = await estimateGas();
            const tx = await typeMap.setType(0, "custom/type", "0x9999", {
                maxFeePerGas: gasPrice.maxFeePerGas,
                maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas
            });
            await tx.wait();

            expect(await typeMap.getTypeBytes(0, "custom/type")).to.equal("0x9999");
            expect(await typeMap.getTypeString(0, "0x9999")).to.equal("custom/type");
        });
    });

    describe("DataPointStorage", function () {
        it("Should handle data points efficiently", async function () {
            const dataPoint = {
                structure: {
                    mimeType: await typeMap.getTypeBytes(0, "text/plain"),
                    charset: await typeMap.getTypeBytes(1, "utf-8"),
                    location: await typeMap.getTypeBytes(2, "datapoint/chunk"),
                },
                data: ethers.toUtf8Bytes("Hello, World!"),
            };

            gasPrice = await estimateGas();
            const tx = await dataPointStorage.writeDataPoint(dataPoint, {
                maxFeePerGas: gasPrice.maxFeePerGas,
                maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas
            });
            await tx.wait();

            const dataPointAddress = await dataPointStorage.calculateAddress(dataPoint);
            const storedDataPoint = await dataPointStorage.readDataPoint(dataPointAddress);
            
            expect(ethers.toUtf8String(storedDataPoint.data)).to.equal("Hello, World!");
        });
    });

    describe("DataPointRegistry", function () {
        it("Should handle royalties correctly", async function () {
            this.timeout(60000);

            // Create test data
            const chunk = new Uint8Array(24 * 1024);
            for (let i = 0; i < chunk.length; i++) {
                chunk[i] = i % 256;
            }
            
            const dataPoint = {
                structure: {
                    mimeType: await typeMap.getTypeBytes(0, "application/octet-stream"),
                    charset: await typeMap.getTypeBytes(1, "utf-8"),
                    location: await typeMap.getTypeBytes(2, "datapoint/chunk"),
                },
                data: chunk,
            };

            // Publisher writes
            gasPrice = await estimateGas();
            let tx = await dataPointRegistry.connect(publisher).writeDataPoint(
                dataPoint, 
                publisher.address,
                {
                    maxFeePerGas: gasPrice.maxFeePerGas,
                    maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas
                }
            );
            await tx.wait();

            const dataPointAddress = await dataPointStorage.calculateAddress(dataPoint);
            const royaltyAmount = await dataPointRegistry.getRoyalty(dataPointAddress);
            
            // Dev writes with royalty
            gasPrice = await estimateGas();
            tx = await dataPointRegistry.connect(dev).writeDataPoint(
                dataPoint,
                ethers.ZeroAddress,
                {
                    value: royaltyAmount,
                    maxFeePerGas: gasPrice.maxFeePerGas,
                    maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas
                }
            );
            await tx.wait();

            // Verify balances
            const publisherBalance = await dataPointRegistry.royaltyBalance(publisher.address);
            const tw3Balance = await dataPointRegistry.royaltyBalance(tw3.address);
            expect(tw3Balance).to.equal(royaltyAmount / 10n);
            expect(publisherBalance).to.equal(royaltyAmount / 10n * 9n);
        });
    });
}); 