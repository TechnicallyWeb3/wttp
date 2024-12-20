import { ethers } from "hardhat";
import { contractManager } from '../lib/contractManager';

async function main() {
    const [, dpsDeployer, dprDeployer, wttpDeployer] = await ethers.getSigners();
    
    const DataPointStorage = await ethers.getContractFactory("DataPointStorage");
    const DataPointRegistry = await ethers.getContractFactory("DataPointRegistry");
    const WTTP = await ethers.getContractFactory("WTTP");

    // Deploy or load DataPointStorage
    const existingDPSAddress = contractManager.getContractAddress('dataPointStorage');
    let dataPointStorage;
    
    if (existingDPSAddress) {
        console.log("Loading existing DataPointStorage at:", existingDPSAddress);
        dataPointStorage = DataPointStorage.attach(existingDPSAddress);
    } else {
        const dpsWithSigner = DataPointStorage.connect(dpsDeployer);
        dataPointStorage = await dpsWithSigner.deploy();
        await dataPointStorage.waitForDeployment();
        console.log("DataPointStorage deployed to:", dataPointStorage.target);
        contractManager.saveContract('dataPointStorage', String(dataPointStorage.target));
    }

    // Deploy or load DataPointRegistry
    const existingDPRAddress = contractManager.getContractAddress('dataPointRegistry');
    let dataPointRegistry;
    
    if (existingDPRAddress) {
        console.log("Loading existing DataPointRegistry at:", existingDPRAddress);
        dataPointRegistry = DataPointRegistry.attach(existingDPRAddress);
    } else {
        const dprWithSigner = DataPointRegistry.connect(dprDeployer);
        dataPointRegistry = await dprWithSigner.deploy(
            dataPointStorage.target,
            "0xC6266149f988448b540899A91A0339Db67742e27",
            ethers.parseUnits("0.25", "gwei")
        );
        // SETH 10000000000 / 10 gwei //
        // ETH 15000000 / 0.015 gwei //
        // POL 115000000 / 0.115 gwei //
        // BASE 150000 / 0.00015 gwei //
        // FTM 100000000 / 0.1 gwei //
        // ARB 250000000 / 0.25 gwei //
        // OP 150000 / 0.00015 gwei //
        // AVAX 15000000 / 0.015 gwei //
        await dataPointRegistry.waitForDeployment();
        console.log("DataPointRegistry deployed to:", dataPointRegistry.target);
        contractManager.saveContract('dataPointRegistry', String(dataPointRegistry.target));
    }

    // Deploy or load WTTP
    const existingWTTPAddress = contractManager.getContractAddress('wttp');
    let wttp;
    
    if (existingWTTPAddress) {
        console.log("Loading existing WTTP at:", existingWTTPAddress);
        wttp = WTTP.attach(existingWTTPAddress);
    } else {
        const wttpWithSigner = WTTP.connect(wttpDeployer);
        wttp = await wttpWithSigner.deploy();
        await wttp.waitForDeployment();
        console.log("WTTP deployed to:", wttp.target);
        contractManager.saveContract('wttp', String(wttp.target));
    }

    return {
        dataPointStorage: dataPointStorage.target,
        dataPointRegistry: dataPointRegistry.target,
        wttp: wttp.target
    };
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 