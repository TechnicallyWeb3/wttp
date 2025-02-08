import { ethers } from "hardhat";
import { contractManager } from '../lib/contractManager';

async function main() {
    const [, svgDeployer] = await ethers.getSigners();
    
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