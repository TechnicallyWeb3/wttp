import {
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";
import { DataPointStorage, DataPointRegistry, DataPointStorage__factory } from "../typechain-types";

describe("WebStorage", function () {
    async function deployWebStorageFixture() {
        const [tw3, publisher, dev] = await hre.ethers.getSigners();

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
        const dataPointRegistry = await DataPointRegistry.deploy(dataPointStorage.target, tw3.address);

        return { statusMap, typeMap, dataPointStorage, dataPointRegistry, tw3, publisher, dev };
    }

    describe("StatusMap", function () {
        it("Should set and get status codes correctly", async function () {

            this.slow(2000);

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
            const { statusMap, publisher: user1 } = await loadFixture(deployWebStorageFixture);

            await expect(statusMap.connect(user1).setStatus(599, "Custom Error"))
                .to.be.reverted;
        });
    });

    describe("TypeMap", function () {
        it("Should return correct bytes2 for predefined MIME types", async function () {
            const { typeMap } = await loadFixture(deployWebStorageFixture);
            
            expect(await typeMap.getTypeBytes(0, "text/plain")).to.equal("0x7470");
            expect(await typeMap.getTypeBytes(0, "application/json")).to.equal("0x786a");
            expect(await typeMap.getTypeBytes(0, "image/png")).to.equal("0x6970");
        });

        it("Should return correct strings for predefined MIME type bytes", async function () {
            const { typeMap } = await loadFixture(deployWebStorageFixture);
            
            expect(await typeMap.getTypeString(0, "0x7470")).to.equal("text/plain");
            expect(await typeMap.getTypeString(0, "0x786A")).to.equal("application/json");
            expect(await typeMap.getTypeString(0, "0x6970")).to.equal("image/png");
        });

        it("Should allow owner to add new type mappings", async function () {
            const { typeMap } = await loadFixture(deployWebStorageFixture);
            
            await expect(typeMap.setType(0, "custom/type", "0x9999"))
                .to.not.be.reverted;

            expect(await typeMap.getTypeBytes(0, "custom/type")).to.equal("0x9999");
            expect(await typeMap.getTypeString(0, "0x9999")).to.equal("custom/type");
        });

        it("Should not allow non-owner to add new type mappings", async function () {
            const { typeMap, publisher } = await loadFixture(deployWebStorageFixture);
            
            await expect(typeMap.connect(publisher).setType(0, "custom/type", "0x9999"))
                .to.be.reverted;
        });

        it("Should revert when requesting non-existent types", async function () {
            const { typeMap } = await loadFixture(deployWebStorageFixture);
            
            await expect(typeMap.getTypeBytes(0, "non/existent"))
                .to.be.revertedWith("MAP: Type bytes not found");
                
            await expect(typeMap.getTypeString(0, "0x0000"))
                .to.be.revertedWith("MAP: Type string not found");
        });

        it("Should correctly handle type enums", async function () {
            const { typeMap } = await loadFixture(deployWebStorageFixture);
            
            // Get first MIME type (should be text/plain)
            const firstType = await typeMap.getTypeEnum(0, 0);
            expect(await typeMap.getTypeString(0, firstType)).to.equal("text/plain");
            
            // Should revert when index is out of bounds
            await expect(typeMap.getTypeEnum(0, 9999))
                .to.be.revertedWith("MAP: Invalid index");
        });
    });

    describe("DataPointStorage", function () {
        it("Should write and read a data point correctly", async function () {
            const { dataPointStorage, typeMap } = await loadFixture(deployWebStorageFixture);
            
            const dataPoint = {
                structure: {
                    mimeType: await typeMap.getTypeBytes(0, "text/plain"), // 0x7470
                    charset: await typeMap.getTypeBytes(1, "utf-8"), // 0x7508
                    location: await typeMap.getTypeBytes(2, "datapoint/chunk"), // 0x0101
                },
                data: ethers.toUtf8Bytes("Hello, World!"),
            };

            // Write the data point
            const tx = await dataPointStorage.writeDataPoint(dataPoint);
            const receipt = await tx.wait();
            
            // Get the data point address from the transaction logs
            const dataPointAddress = await dataPointStorage.calculateAddress(dataPoint);
            
            // Read the data point back
            const storedDataPoint = await dataPointStorage.readDataPoint(dataPointAddress);
            
            // Verify the stored data
            expect(storedDataPoint.structure.mimeType).to.equal(dataPoint.structure.mimeType);
            expect(storedDataPoint.structure.charset).to.equal(dataPoint.structure.charset);
            expect(storedDataPoint.structure.location).to.equal(dataPoint.structure.location);
            expect(ethers.toUtf8String(storedDataPoint.data)).to.equal("Hello, World!");
        });

        it("Should return same address and use less gas when rewriting identical data", async function () {
            const { dataPointStorage, typeMap } = await loadFixture(deployWebStorageFixture);
            
            const dataPoint = {
                structure: {
                    mimeType: await typeMap.getTypeBytes(0, "text/plain"),
                    charset: await typeMap.getTypeBytes(1, "utf-8"),
                    location: await typeMap.getTypeBytes(2, "datapoint/chunk"),
                },
                data: ethers.toUtf8Bytes("Hello, World!"),
            };

            // First write
            const tx1 = await dataPointStorage.writeDataPoint(dataPoint);
            const receipt1 = await tx1.wait();
            const gasUsed1 = receipt1?.gasUsed || 0n;
            const address1 = await dataPointStorage.calculateAddress(dataPoint);

            // Second write of same data
            const tx2 = await dataPointStorage.writeDataPoint(dataPoint);
            const receipt2 = await tx2.wait();
            const gasUsed2 = receipt2?.gasUsed || 0n;
            const address2 = await dataPointStorage.calculateAddress(dataPoint);

            // Verify addresses match and second transaction used less gas
            expect(address1).to.equal(address2);
            expect(gasUsed2).to.be.lessThan(gasUsed1);
        });

        it("Should return correct data point info", async function () {
            const { dataPointStorage, typeMap } = await loadFixture(deployWebStorageFixture);
            
            const dataPoint = {
                structure: {
                    mimeType: await typeMap.getTypeBytes(0, "text/plain"),
                    charset: await typeMap.getTypeBytes(1, "utf-8"),
                    location: await typeMap.getTypeBytes(2, "datapoint/chunk"),
                },
                data: ethers.toUtf8Bytes("Hello, World!"),
            };

            // Write the data point
            await dataPointStorage.writeDataPoint(dataPoint);
            const dataPointAddress = await dataPointStorage.calculateAddress(dataPoint);
            
            // Get the data point info
            const info = await dataPointStorage.dataPointInfo(dataPointAddress);
            
            // Verify the info
            expect(info.size).to.equal(BigInt(dataPoint.data.length));
            expect(info.mimeType).to.equal(dataPoint.structure.mimeType);
            expect(info.charset).to.equal(dataPoint.structure.charset);
            expect(info.location).to.equal(dataPoint.structure.location);
        });

        it("Should revert on invalid data point parameters", async function () {
            const { dataPointStorage, typeMap } = await loadFixture(deployWebStorageFixture);
            
            const invalidDataPoint = {
                structure: {
                    mimeType: "0x0000",
                    charset: await typeMap.getTypeBytes(1, "utf-8"),
                    location: await typeMap.getTypeBytes(2, "datapoint/chunk"),
                },
                data: ethers.toUtf8Bytes("Hello, World!"),
            };

            await expect(dataPointStorage.writeDataPoint(invalidDataPoint))
                .to.be.revertedWith("DPS: Invalid MIME Type");

            const emptyDataPoint = {
                structure: {
                    mimeType: await typeMap.getTypeBytes(0, "text/plain"),
                    charset: await typeMap.getTypeBytes(1, "utf-8"),
                    location: await typeMap.getTypeBytes(2, "datapoint/chunk"),
                },
                data: new Uint8Array(0),
            };

            await expect(dataPointStorage.writeDataPoint(emptyDataPoint))
                .to.be.revertedWith("DPS: Empty data");
        });
    });

    describe("DataPointRegistry", function () {
        it("Should write and read a data point with no royalties", async function () {
            const { dataPointStorage, dataPointRegistry, typeMap } = await loadFixture(deployWebStorageFixture);
            
            const dataPoint = {
                structure: {
                    mimeType: await typeMap.getTypeBytes(0, "text/plain"),
                    charset: await typeMap.getTypeBytes(1, "utf-8"),
                    location: await typeMap.getTypeBytes(2, "datapoint/chunk"),
                },
                data: ethers.toUtf8Bytes("Hello, World!"),
            };

            // Write with no publisher (address(0))
            const tx = await dataPointRegistry.writeDataPoint(dataPoint, ethers.ZeroAddress);
            const receipt = await tx.wait();
            
            const dataPointAddress = await dataPointStorage.calculateAddress(dataPoint);
            const storedDataPoint = await dataPointStorage.readDataPoint(dataPointAddress);
            
            expect(ethers.toUtf8String(storedDataPoint.data)).to.equal("Hello, World!");
        });

        it("Should handle royalties correctly", async function () {
            const { dataPointStorage, dataPointRegistry, typeMap, publisher, dev, tw3 } = await loadFixture(deployWebStorageFixture);
            
            this.slow(400);

            // Create a 24KB data chunk
            const chunk = new Uint8Array(24 * 1024); // 24 * 1024 bytes = 24KB
            for (let i = 0; i < chunk.length; i++) {
                chunk[i] = i % 256; // Fill with repeating pattern
            }
            
            const dataPoint = {
                structure: {
                    mimeType: await typeMap.getTypeBytes(0, "application/octet-stream"),
                    charset: await typeMap.getTypeBytes(1, "utf-8"),
                    location: await typeMap.getTypeBytes(2, "datapoint/chunk"),
                },
                data: chunk,
            };

            // Publisher writes the data point first
            await dataPointRegistry.connect(publisher).writeDataPoint(dataPoint, publisher.address);
            const dataPointAddress = await dataPointStorage.calculateAddress(dataPoint);
            
            // Get royalty amount
            const royaltyAmount = await dataPointRegistry.getRoyalty(dataPointAddress);
            expect(royaltyAmount).to.be.gt(0);

            // Dev tries to write same data point without paying royalty
            await expect(
                dataPointRegistry.connect(dev).writeDataPoint(dataPoint, ethers.ZeroAddress)
            ).to.be.revertedWith("Not enough value to pay royalties");

            // Dev writes same data point with royalty payment
            await dataPointRegistry.connect(dev).writeDataPoint(
                dataPoint, 
                ethers.ZeroAddress, 
                { value: royaltyAmount }
            );

            // Check publisher's royalty balance
            const publisherBalance = await dataPointRegistry.royaltyBalance(publisher.address);
            expect(publisherBalance).to.be.gt(0);
            
            // Check TW3's royalty balance (should be 10% of royalty)
            const tw3Balance = await dataPointRegistry.royaltyBalance(tw3.address);
            expect(tw3Balance).to.equal(royaltyAmount / 10n);

            // Publisher collects royalties
            const publisherInitialBalance = await ethers.provider.getBalance(publisher.address);
            const collectTx = await dataPointRegistry.connect(publisher).collectRoyalties(
                publisherBalance, 
                publisher.address
            );
            const collectReceipt = await collectTx.wait();
            // const gasUsedForCollection = collectReceipt ? collectReceipt.gasUsed * ((await ethers.provider.getFeeData()).gasPrice ?? 3000000n) : 0n;
            
            // Verify publisher received royalties (accounting for gas costs)
            const publisherFinalBalance = await ethers.provider.getBalance(publisher.address);
            expect(publisherFinalBalance).to.be.gt(publisherInitialBalance);

            // TW3 collects royalties
            const tw3InitialBalance = await ethers.provider.getBalance(tw3.address);
            const tw3CollectTx = await dataPointRegistry.connect(tw3).collectRoyalties(
                tw3Balance, 
                tw3.address
            );
            const tw3CollectReceipt = await tw3CollectTx.wait();
            // const tw3GasUsedForCollection = tw3CollectReceipt ? tw3CollectReceipt.gasUsed * (await ethers.provider.getFeeData()).gasPrice : 0n;
            
            // Verify TW3 received royalties (accounting for gas costs)
            const tw3FinalBalance = await ethers.provider.getBalance(tw3.address);
            expect(tw3FinalBalance).to.be.gt(tw3InitialBalance);
        });

        it("Should not allow collecting more than available balance", async function () {
            const { dataPointRegistry, publisher } = await loadFixture(deployWebStorageFixture);
            
            const balance = await dataPointRegistry.royaltyBalance(publisher.address);
            
            await expect(
                dataPointRegistry.connect(publisher).collectRoyalties(
                    balance + 1n, 
                    publisher.address
                )
            ).to.be.revertedWith("DPR: Insufficient balance");
        });

        it("Should not charge royalties for publisher's own writes", async function () {
            const { dataPointRegistry, typeMap, publisher } = await loadFixture(deployWebStorageFixture);
            
            const dataPoint = {
                structure: {
                    mimeType: await typeMap.getTypeBytes(0, "text/plain"),
                    charset: await typeMap.getTypeBytes(1, "utf-8"),
                    location: await typeMap.getTypeBytes(2, "datapoint/chunk"),
                },
                data: ethers.toUtf8Bytes("Hello, World!"),
            };

            // First write by publisher
            await dataPointRegistry.connect(publisher).writeDataPoint(dataPoint, publisher.address);
            
            // Second write by same publisher should not require royalty payment
            await expect(
                dataPointRegistry.connect(publisher).writeDataPoint(dataPoint, publisher.address)
            ).to.not.be.reverted;
        });
    });
});
