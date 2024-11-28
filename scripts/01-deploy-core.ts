import { ethers } from "hardhat";
import { contractManager } from '../utils/contractManager';

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    // Deploy or load DataPointStorage
    const DataPointStorage = await ethers.getContractFactory("DataPointStorage");
    const existingDPSAddress = contractManager.getContractAddress('dataPointStorage');
    let dataPointStorage;
    
    if (existingDPSAddress) {
        console.log("Loading existing DataPointStorage at:", existingDPSAddress);
        dataPointStorage = DataPointStorage.attach(existingDPSAddress);
    } else {
        dataPointStorage = await DataPointStorage.deploy();
        await dataPointStorage.waitForDeployment();
        console.log("DataPointStorage deployed to:", dataPointStorage.target);
        contractManager.saveContract('dataPointStorage', dataPointStorage.target);
    }

    // Deploy or load DataPointRegistry
    const DataPointRegistry = await ethers.getContractFactory("DataPointRegistry");
    const existingDPRAddress = contractManager.getContractAddress('dataPointRegistry');
    let dataPointRegistry;
    
    if (existingDPRAddress) {
        console.log("Loading existing DataPointRegistry at:", existingDPRAddress);
        dataPointRegistry = DataPointRegistry.attach(existingDPRAddress);
    } else {
        dataPointRegistry = await DataPointRegistry.deploy(
            dataPointStorage.target,
            deployer.address
        );
        await dataPointRegistry.waitForDeployment();
        console.log("DataPointRegistry deployed to:", dataPointRegistry.target);
        contractManager.saveContract('dataPointRegistry', dataPointRegistry.target);
    }

    // Deploy or load WTTP
    const WTTP = await ethers.getContractFactory("WTTP");
    const existingWTTPAddress = contractManager.getContractAddress('wttp');
    let wttp;
    
    if (existingWTTPAddress) {
        console.log("Loading existing WTTP at:", existingWTTPAddress);
        wttp = WTTP.attach(existingWTTPAddress);
    } else {
        wttp = await WTTP.deploy();
        await wttp.waitForDeployment();
        console.log("WTTP deployed to:", wttp.target);
        contractManager.saveContract('wttp', String(wttp.target));
    }

    // After all deployments:
    const fs = require('fs');
    const path = require('path');
    
    const constantsPath = path.join(__dirname, '../types/constants.ts');
    const constants = fs.readFileSync(constantsPath, 'utf8');
    const updatedConstants = constants
        .replace(
            /export const WTTP_CONTRACT = '.*?'/,
            `export const WTTP_CONTRACT = '${wttp.target}'`
        )
        .replace(
            /export const DATAPOINT_REGISTRY = '.*?'/,
            `export const DATAPOINT_REGISTRY = '${dataPointRegistry.target}'`
        );
    
    fs.writeFileSync(constantsPath, updatedConstants);
    console.log('Updated WTTP_CONTRACT and DATAPOINT_REGISTRY in constants file');

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