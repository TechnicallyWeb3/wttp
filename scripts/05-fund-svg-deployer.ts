import { ethers } from "hardhat";

async function main() {
    const [funder,,,,svgDeployer] = await ethers.getSigners();
    // console.log(svgDeployer.address);
    
    // Estimate gas for deployment
    const SVGAssembler = await ethers.getContractFactory("SVGAssembler");
    
    const gasEstimate = await SVGAssembler.getDeployTransaction(
        ethers.ZeroAddress  // DPR address placeholder
    ).then(tx => ethers.provider.estimateGas(tx));

    const feeData = await ethers.provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas || (feeData.gasPrice || 0n);
    const buffer = 1.5; // 50% buffer for safety
    
    // Calculate required funding
    const requiredFunding = (BigInt(gasEstimate) * maxFeePerGas * BigInt(Math.ceil(buffer * 100)) / 100n);
    const balance = await ethers.provider.getBalance(svgDeployer.address);

    console.log(`\nSVG Deployer ${svgDeployer.address}:`);
    console.log("Estimated Gas Limit:", gasEstimate.toString());
    console.log("Current Max Fee Per Gas:", ethers.formatUnits(maxFeePerGas, "gwei"), "gwei");
    console.log("Buffer multiplier:", buffer);
    console.log("Calculated required funding:", ethers.formatEther(requiredFunding), "ETH");
    console.log("Current balance:", ethers.formatEther(balance), "ETH");

    if (balance < requiredFunding) {
        const fundingNeeded = requiredFunding - balance;
        console.log(`Funding with ${ethers.formatEther(fundingNeeded)} ETH`);
        
        const tx = await funder.sendTransaction({
            to: svgDeployer.address,
            value: fundingNeeded,
            // maxFeePerGas: maxFeePerGas * 5n,
            // maxPriorityFeePerGas: (feeData.maxPriorityFeePerGas || 0n) * 5n,
        });
        
        console.log(`Transaction sent: ${tx.hash}`);
        console.log('Waiting for confirmation...');
        
        await tx.wait();
        console.log('Transaction confirmed!');
        
        const newBalance = await ethers.provider.getBalance(svgDeployer.address);
        console.log(`New balance: ${ethers.formatEther(newBalance)} ETH`);
    }

    console.log("Funding completed");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 