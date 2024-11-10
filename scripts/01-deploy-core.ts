import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    // Deploy DataPointStorage
    const DataPointStorage = await ethers.getContractFactory("DataPointStorage");
    const dataPointStorage = await DataPointStorage.deploy();
    await dataPointStorage.waitForDeployment();
    console.log("DataPointStorage deployed to:", dataPointStorage.target);

    // Deploy DataPointRegistry
    const DataPointRegistry = await ethers.getContractFactory("DataPointRegistry");
    const dataPointRegistry = await DataPointRegistry.deploy(
        dataPointStorage.target,
        deployer.address
    );
    await dataPointRegistry.waitForDeployment();
    console.log("DataPointRegistry deployed to:", dataPointRegistry.target);

    // Deploy WTTP Base Methods
    const WTTPBaseMethods = await ethers.getContractFactory("Dev_WTTPBaseMethods");
    const wttpBaseMethods = await WTTPBaseMethods.deploy(
        dataPointRegistry.target,
        deployer.address,
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
            methods: 2913,
            redirect: {
                code: 0,
                location: ""
            },
            resourceAdmin: ethers.ZeroHash
        }
    );
    await wttpBaseMethods.waitForDeployment();
    console.log("WTTPBaseMethods deployed to:", wttpBaseMethods.target);

    // Deploy WTTP
    const WTTP = await ethers.getContractFactory("WTTP");
    const wttp = await WTTP.deploy();
    await wttp.waitForDeployment();
    console.log("WTTP deployed to:", wttp.target);

    return {
        dataPointStorage: dataPointStorage.target,
        dataPointRegistry: dataPointRegistry.target,
        wttpBaseMethods: wttpBaseMethods.target,
        wttp: wttp.target
    };
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 