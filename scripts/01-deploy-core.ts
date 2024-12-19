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
            "0x352EBC51417C9511ce884547994b3eD6DcD2DbAE",
            ethers.parseUnits("1", "gwei")
        );
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