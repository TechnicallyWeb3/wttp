import { ethers } from "hardhat";

async function main() {
    const [funder, dpsDeployer, dprDeployer, wttpDeployer] = await ethers.getSigners();
    
    // Estimate gas for deployments
    const DataPointStorage = await ethers.getContractFactory("DataPointStorage");
    const DataPointRegistry = await ethers.getContractFactory("DataPointRegistry");
    const WTTP = await ethers.getContractFactory("WTTP");

    const gasEstimates = {
        dps: await DataPointStorage.getDeployTransaction().then(tx => 
            ethers.provider.estimateGas(tx)),
        dpr: await DataPointRegistry.getDeployTransaction(
            ethers.ZeroAddress,
            "0x352EBC51417C9511ce884547994b3eD6DcD2DbAE",
            ethers.parseUnits("1", "gwei"),
        ).then(tx => ethers.provider.estimateGas(tx)),
        wttp: await WTTP.getDeployTransaction().then(tx => 
            ethers.provider.estimateGas(tx))
    };

    const gasPrice = await ethers.provider.getFeeData().then(data => data.gasPrice || 0n);
    const buffer = 2; // 300% buffer for safety

    // Fund deployers if needed
    const deployersToFund = [
        { deployer: dpsDeployer, gasLimit: gasEstimates.dps },
        { deployer: dprDeployer, gasLimit: gasEstimates.dpr },
        { deployer: wttpDeployer, gasLimit: gasEstimates.wttp }
    ];

    // Process each deployer sequentially instead of in parallel
    for (const { deployer, gasLimit } of deployersToFund) {
        const balance = await ethers.provider.getBalance(deployer.address);
        const feeData = await ethers.provider.getFeeData();
        const maxFeePerGas = feeData.maxFeePerGas || (feeData.gasPrice || 0n);
        const requiredFunding = (BigInt(gasLimit) * maxFeePerGas * BigInt(buffer)); 
        
        console.log(`\nDeployer ${deployer.address}:`);
        console.log("Estimated Gas Limit:", gasLimit.toString());
        console.log("Current Max Fee Per Gas:", ethers.formatUnits(maxFeePerGas, "gwei"), "gwei");
        console.log("Buffer multiplier:", buffer);
        console.log("Calculated required funding:", ethers.formatEther(requiredFunding), "ETH");
        console.log("Current balance:", ethers.formatEther(balance), "ETH");
        console.log("Raw values for verification:");
        console.log("- Gas limit (wei):", gasLimit.toString());
        console.log("- Max fee per gas (wei):", maxFeePerGas.toString());
        console.log("- Required funding (wei):", requiredFunding.toString());
        console.log("- Current balance (wei):", balance.toString());
        
        if (balance < requiredFunding) {
            const fundingNeeded = requiredFunding - balance;
            console.log(`Funding with ${ethers.formatEther(fundingNeeded)} ETH`);
            
            const nonce = await funder.getNonce();
            console.log(`Sending transaction with nonce ${nonce}...`);
            
            const tx = await funder.sendTransaction({
                to: deployer.address,
                value: fundingNeeded,
                maxFeePerGas: maxFeePerGas * 5n,
                maxPriorityFeePerGas: (feeData.maxPriorityFeePerGas || 0n) * 5n,
                nonce
            });
            
            console.log(`Transaction sent: ${tx.hash}`);
            console.log('Waiting for confirmation...');
            
            // Wait for the transaction to be mined
            await tx.wait();
            console.log('Transaction confirmed!');
            
            // Verify the new balance
            const newBalance = await ethers.provider.getBalance(deployer.address);
            console.log(`New balance: ${ethers.formatEther(newBalance)} ETH`);
        }
    }

    console.log("Funding completed");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 