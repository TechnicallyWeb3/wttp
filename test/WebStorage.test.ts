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

    before(async function () {
        this.timeout(100000);
        [tw3, publisher, dev] = await hre.ethers.getSigners();

        // Deploy StatusMap
        const StatusMap = await hre.ethers.getContractFactory("StatusMap");
        
        const gas = await estimateGas();
        statusMap = await StatusMap.deploy(
            gas.deployParams
        );
        await statusMap.waitForDeployment();
        console.log("StatusMap deployed at:", await statusMap.getAddress());

        // Deploy or load TypeMap
        const TypeMap = await hre.ethers.getContractFactory("TypeMap");

        gasPrice = await estimateGas();
        typeMap = await TypeMap.deploy(
            gasPrice.deployParams
        );
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
            dataPointStorage = await DataPointStorage.deploy(
                gasPrice.deployParams
            );
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
                1000000,
                gasPrice.deployParams
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
            const gas = await estimateGas();
            const randomStatus = Math.floor(Math.random() * 10000);
            const randomNumber = Math.random();
            const tx = await statusMap.setStatus(
                randomStatus, 
                `Custom Error ${randomNumber}`, 
                gas.txParams
            );
            await tx.wait();

            expect(await statusMap.getReasonPhrase(randomStatus)).to.equal(`Custom Error ${randomNumber}`);
            expect(await statusMap.getStatusCode(`Custom Error ${randomNumber}`)).to.equal(randomStatus);
        });

        it("Should not allow non-owner to add new status codes", async function () {
            const gas = await estimateGas();
            const randomStatus = Math.floor(Math.random() * 10000);
            await expect(
                statusMap.connect(publisher).setStatus(randomStatus, `Custom Error ${randomStatus}`, gas.txParams)
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
            const randomNumber = Math.random();
            const gas = await estimateGas();
            const tx = await typeMap.setType(0, `custom/type${randomNumber}`, `0x${randomType.toString(16).padStart(4, '0')}`, gas.txParams);
            await tx.wait();

            expect(await typeMap.getTypeBytes(0, `custom/type${randomNumber}`)).to.equal(`0x${randomType.toString(16).padStart(4, '0')}`);
            expect(await typeMap.getTypeString(0, `0x${randomType.toString(16).padStart(4, '0')}`)).to.equal(`custom/type${randomNumber}`);
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

            const gas = await estimateGas();
            const tx = await dataPointStorage.writeDataPoint(dataPoint, gas.txParams);
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
            const chunk = ethers.toUtf8Bytes(`Should handle royalties correctly ${Math.random()}`);
            
            const dataPoint = {
                structure: {
                    mimeType: await typeMap.getTypeBytes(0, "text/plain"),
                    charset: await typeMap.getTypeBytes(1, "utf-8"),
                    location: await typeMap.getTypeBytes(2, "datapoint/chunk"),
                },
                data: chunk,
            };

            
            const dataPointAddress = await dataPointStorage.calculateAddress(dataPoint);
            const royaltyAmount: bigint = await dataPointRegistry.getRoyalty(dataPointAddress);
            // console.log(`Royalty amount: ${royaltyAmount}`);

            // Publisher writes
            const gasPrice = await estimateGas();
            let tx = await dataPointRegistry.connect(publisher).writeDataPoint(
                dataPoint, 
                publisher.address,
                {
                    value: royaltyAmount,
                    ...gasPrice.txParams
                }
            );
            await tx.wait();

            const publisherInitialRoyaltyBalance = await dataPointRegistry.royaltyBalance(publisher.address);
            const tw3InitialRoyaltyBalance = await dataPointRegistry.royaltyBalance(tw3.address);

            const dataPointAddress2 = await dataPointStorage.calculateAddress(dataPoint);
            const royaltyAmount2: bigint = await dataPointRegistry.getRoyalty(dataPointAddress2);
            // console.log(`Royalty amount: ${royaltyAmount2}`);
            
            // Dev writes with royalty
            const gas = await estimateGas();
            tx = await dataPointRegistry.connect(dev).writeDataPoint(
                dataPoint,
                ethers.ZeroAddress,
                {
                    value: royaltyAmount2,
                    ...gas.txParams
                }
            );
            await tx.wait();

            // Verify balances
            const publisherBalance = await dataPointRegistry.royaltyBalance(publisher.address);
            const tw3Balance = await dataPointRegistry.royaltyBalance(tw3.address);

            const updatedRoyaltyAmount: bigint = await dataPointRegistry.getRoyalty(dataPointAddress) - royaltyAmount;
            const updatedRoyaltyAmount2: bigint = await dataPointRegistry.getRoyalty(dataPointAddress2) - royaltyAmount2;
            
            expect(tw3Balance - tw3InitialRoyaltyBalance).to.equal(updatedRoyaltyAmount2 / 10n);
            expect(publisherBalance - publisherInitialRoyaltyBalance).to.equal(updatedRoyaltyAmount / 10n * 9n);
        });
    });
}); 