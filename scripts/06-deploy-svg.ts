import { ethers } from "hardhat";
import { contractManager } from '../lib/contractManager';

async function main() {
    const [,,,, svgDeployer] = await ethers.getSigners();
    console.log(svgDeployer.address);

    // Check nonce of SVG deployer
    const nonce = await svgDeployer.getNonce();
    console.log(nonce);
    if (nonce !== 0) {
        throw new Error(`SVG deployer address ${svgDeployer.address} has nonce ${nonce}. Expected nonce 0 for fresh deployment.`);
    }
    
    const SVGAssembler = await ethers.getContractFactory("SVGAssembler");

    // Get DPR address - required for SVGAssembler constructor
    const dprAddress = contractManager.getContractAddress('dataPointRegistry');
    if (!dprAddress) {
        throw new Error("DataPointRegistry address not found. Please deploy core contracts first.");
    }

    // Deploy or load SVGAssembler
    const existingSVGAddress = contractManager.getContractAddress('svgAssembler');
    let svgAssembler;
    
    if (existingSVGAddress) {
        console.log("Loading existing SVGAssembler at:", existingSVGAddress);
        svgAssembler = SVGAssembler.attach(existingSVGAddress);
    } else {
        // Estimate gas and check if deployment is likely to succeed
        const deployTx = await SVGAssembler.getDeployTransaction(dprAddress);
        try {
            await ethers.provider.estimateGas(deployTx);
        } catch (error) {
            throw new Error(`Deployment would likely fail: ${error.message}`);
        }

        const svgWithSigner = SVGAssembler.connect(svgDeployer);
        svgAssembler = await svgWithSigner.deploy(dprAddress);
        await svgAssembler.waitForDeployment();
        console.log("SVGAssembler deployed to:", svgAssembler.target);
        contractManager.saveContract('svgAssembler', String(svgAssembler.target));
    }

    return {
        svgAssembler: svgAssembler.target
    };
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 