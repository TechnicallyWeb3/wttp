import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";
import { contractManager } from '../lib/contractManager';
// import { DataPointStorage, DataPointRegistry } from "../typechain-types";

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
        const feeData = await hre.ethers.provider.getFeeData();
        const maxFeePerGas = feeData.maxFeePerGas ? feeData.maxFeePerGas : BigInt(40000000000);
        const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ? feeData.maxPriorityFeePerGas : BigInt(2000000000);
        
        return { maxFeePerGas, maxPriorityFeePerGas };
    }

    before(async function () {
        this.timeout(100000);
        [tw3, publisher, dev] = await hre.ethers.getSigners();

        // Deploy StatusMap
        const StatusMap = await hre.ethers.getContractFactory("StatusMap");
        
        gasPrice = await estimateGas();
        statusMap = await StatusMap.deploy({
            ...gasPrice
        });
        await statusMap.waitForDeployment();
        console.log("StatusMap deployed at:", await statusMap.getAddress());

        // Deploy or load TypeMap
        const TypeMap = await hre.ethers.getContractFactory("TypeMap");

        gasPrice = await estimateGas();
        typeMap = await TypeMap.deploy({
            ...gasPrice
        });
        await typeMap.waitForDeployment();
        console.log("TypeMap deployed at:", await typeMap.getAddress());

        // Deploy or load DataPointStorage
        const DataPointStorage = await hre.ethers.getContractFactory("DataPointStorage");
        const existingDPSAddress = contractManager.getContractAddress('dataPointStorage');
        
        if (existingDPSAddress) {
            console.log("Loading existing DataPointStorage at:", existingDPSAddress);
            dataPointStorage = DataPointStorage.attach(existingDPSAddress);
        } else {
            gasPrice = await estimateGas();
            dataPointStorage = await DataPointStorage.deploy({
                ...gasPrice
            });
            await dataPointStorage.waitForDeployment();
            contractManager.saveContract('dataPointStorage', await dataPointStorage.getAddress());
            console.log("DataPointStorage deployed at:", await dataPointStorage.getAddress());
        }

        // Deploy or load DataPointRegistry
        const DataPointRegistry = await hre.ethers.getContractFactory("DataPointRegistry");
        const existingDPRAddress = contractManager.getContractAddress('dataPointRegistry');
        
        if (existingDPRAddress) {
            console.log("Loading existing DataPointRegistry at:", existingDPRAddress);
            dataPointRegistry = DataPointRegistry.attach(existingDPRAddress);
        } else {
            gasPrice = await estimateGas();
            dataPointRegistry = await DataPointRegistry.deploy(
                await dataPointStorage.getAddress(),
                tw3.address,
                {
                    ...gasPrice
                }
            );
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
            const randomStatus = Math.floor(Math.random() * 10000);
            const tx = await statusMap.setStatus(randomStatus, `Custom Error ${randomStatus}`, {
                ...gasPrice
            });
            await tx.wait();

            expect(await statusMap.getReasonPhrase(randomStatus)).to.equal(`Custom Error ${randomStatus}`);
            expect(await statusMap.getStatusCode(`Custom Error ${randomStatus}`)).to.equal(randomStatus);
        });

        it("Should not allow non-owner to add new status codes", async function () {
            gasPrice = await estimateGas();
            const randomStatus = Math.floor(Math.random() * 10000);
            await expect(
                statusMap.connect(publisher).setStatus(randomStatus, `Custom Error ${randomStatus}`, {
                    ...gasPrice
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
            const randomType = Math.floor(Math.random() * 10000);
            gasPrice = await estimateGas();
            const tx = await typeMap.setType(0, `custom/type${randomType}`, `0x${randomType.toString(16).padStart(4, '0')}`, {
                ...gasPrice
            });
            await tx.wait();

            expect(await typeMap.getTypeBytes(0, `custom/type${randomType}`)).to.equal(`0x${randomType.toString(16).padStart(4, '0')}`);
            expect(await typeMap.getTypeString(0, `0x${randomType.toString(16).padStart(4, '0')}`)).to.equal(`custom/type${randomType}`);
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
                ...gasPrice
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
            const chunk = ethers.toUtf8Bytes(`Should handle royalties correctly`);
            
            const dataPoint = {
                structure: {
                    mimeType: await typeMap.getTypeBytes(0, "application/octet-stream"),
                    charset: await typeMap.getTypeBytes(1, "utf-8"),
                    location: await typeMap.getTypeBytes(2, "datapoint/chunk"),
                },
                data: chunk,
            };

            
            const dataPointAddress = await dataPointStorage.calculateAddress(dataPoint);
            const royaltyAmount = await dataPointRegistry.getRoyalty(dataPointAddress);
            // console.log(`Royalty amount: ${royaltyAmount}`);

            // Publisher writes
            gasPrice = await estimateGas();
            let tx = await dataPointRegistry.connect(publisher).writeDataPoint(
                dataPoint, 
                publisher.address,
                {
                    value: royaltyAmount,
                    ...gasPrice
                }
            );
            await tx.wait();

            const publisherInitialRoyaltyBalance = await dataPointRegistry.royaltyBalance(publisher.address);
            const tw3InitialRoyaltyBalance = await dataPointRegistry.royaltyBalance(tw3.address);

            const dataPointAddress2 = await dataPointStorage.calculateAddress(dataPoint);
            const royaltyAmount2 = await dataPointRegistry.getRoyalty(dataPointAddress2);
            // console.log(`Royalty amount: ${royaltyAmount2}`);
            
            // Dev writes with royalty
            gasPrice = await estimateGas();
            tx = await dataPointRegistry.connect(dev).writeDataPoint(
                dataPoint,
                ethers.ZeroAddress,
                {
                    value: royaltyAmount2,
                    ...gasPrice
                }
            );
            await tx.wait();

            // Verify balances
            const publisherBalance = await dataPointRegistry.royaltyBalance(publisher.address);
            const tw3Balance = await dataPointRegistry.royaltyBalance(tw3.address);
            expect(tw3Balance - tw3InitialRoyaltyBalance).to.equal(royaltyAmount2 / 10n);
            expect(publisherBalance - publisherInitialRoyaltyBalance).to.equal(royaltyAmount2 / 10n * 9n);
        });
    });
}); 