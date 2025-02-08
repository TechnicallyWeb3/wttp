import { ethers } from "hardhat";
import { DataPointRegistry__factory } from "../typechain-types";

async function main() {
    const contractAddress = "0x9885FF0546C921EFb19b1C8a2E10777A9dAc8e88";
    const startBlock = 7315672; // Contract creation block
    const [signer] = await ethers.getSigners();
    const dpr = DataPointRegistry__factory.connect(
        contractAddress,
        signer
    );

    // Get current block
    const latestBlock = await ethers.provider.getBlockNumber();
    const batchSize = 50000; // Maximum range allowed
    
    console.log("Fetching events...");
    console.log(`Scanning from block ${startBlock} to ${latestBlock}`);
    
    // Initialize arrays to store all events
    let registeredEvents = [];
    let paidEvents = [];
    let collectedEvents = [];

    // Fetch events in batches
    for (let fromBlock = startBlock; fromBlock <= latestBlock; fromBlock += batchSize) {
        const toBlock = Math.min(fromBlock + batchSize - 1, latestBlock);
        
        const [registered, paid, collected] = await Promise.all([
            dpr.queryFilter(dpr.filters.DataPointRegistered(), fromBlock, toBlock),
            dpr.queryFilter(dpr.filters.RoyaltiesPaid(), fromBlock, toBlock),
            dpr.queryFilter(dpr.filters.RoyaltiesCollected(), fromBlock, toBlock)
        ]);

        registeredEvents = [...registeredEvents, ...registered];
        paidEvents = [...paidEvents, ...paid];
        collectedEvents = [...collectedEvents, ...collected];

        console.log(`Processed blocks ${fromBlock} to ${toBlock}`);
    }

    // Track publisher stats and fees
    const publisherStats = new Map<string, {
        dataPoints: Set<string>,
        royaltiesReceived: bigint,
        royaltiesCollected: bigint
    }>();
    
    const TW3_ADDRESS = "0xC6266149f988448b540899A91A0339Db67742e27";
    let totalFees = 0n;

    // Process DataPointRegistered events
    for (const event of registeredEvents) {
        const publisher = event.args.publisher;
        const dataPoint = event.args.dataPointAddress;
        
        if (!publisherStats.has(publisher)) {
            publisherStats.set(publisher, {
                dataPoints: new Set(),
                royaltiesReceived: 0n,
                royaltiesCollected: 0n
            });
        }
        publisherStats.get(publisher)!.dataPoints.add(dataPoint);
    }

    // Process RoyaltiesPaid events
    for (const event of paidEvents) {
        const publisher = event.args.publisher;
        const amount = event.args.amount;
        // const fee = event.args.amount;  // Make sure this exists in your event
        
        totalFees += BigInt(amount) || 0n;
        
        if (!publisherStats.has(publisher)) {
            publisherStats.set(publisher, {
                dataPoints: new Set(),
                royaltiesReceived: 0n,
                royaltiesCollected: 0n
            });
        }
        publisherStats.get(publisher)!.royaltiesReceived += amount;
    }

    // Process RoyaltiesCollected events
    for (const event of collectedEvents) {
        const publisher = event.args.publisher;
        const amount = event.args.amount;
        
        if (publisherStats.has(publisher)) {
            publisherStats.get(publisher)!.royaltiesCollected += amount;
        }
    }

    // Print analysis
    console.log("\nPublisher Analysis:");
    let totalUncollectedRoyalties = 0n;
    
    for (const [publisher, stats] of publisherStats) {
        const uncollectedRoyalties = stats.royaltiesReceived - stats.royaltiesCollected;
        totalUncollectedRoyalties += uncollectedRoyalties;
        
        console.log(`\nPublisher: ${publisher}`);
        console.log(`Data Points Published: ${stats.dataPoints.size}`);
        console.log(`Total Royalties Received: ${ethers.formatEther(stats.royaltiesReceived)} ETH`);
        console.log(`Total Royalties Collected: ${ethers.formatEther(stats.royaltiesCollected)} ETH`);
        console.log(`Uncollected Royalties: ${ethers.formatEther(uncollectedRoyalties)} ETH`);
        
        // Get current balance
        const currentBalance = await dpr.royaltyBalance(publisher);
        console.log(`Current Contract Balance: ${ethers.formatEther(currentBalance)} ETH`);
    }

    // Get contract balance and calculate discrepancy
    const contractBalance = await ethers.provider.getBalance(contractAddress);
    const balance = BigInt(contractBalance);
    
    console.log(`\nFees Analysis:`);
    console.log(`Total TW3 Fees Generated: ${ethers.formatEther(totalFees)} ETH`);
    const tw3Balance = await dpr.royaltyBalance(TW3_ADDRESS);
    console.log(`Current TW3 Fee Balance: ${ethers.formatEther(tw3Balance)} ETH`);
    
    console.log(`\nBalance Analysis:`);
    console.log(`Total Contract Balance: ${ethers.formatEther(balance)} ETH`);
    console.log(`Total Uncollected Royalties: ${ethers.formatEther(totalUncollectedRoyalties)} ETH`);
    console.log(`Total Uncollected Fees: ${ethers.formatEther(tw3Balance)} ETH`);
    console.log(`Expected Total Balance: ${ethers.formatEther(totalUncollectedRoyalties + tw3Balance)} ETH`);
    console.log(`Actual Balance: ${ethers.formatEther(balance)} ETH`);
    console.log(`Discrepancy: ${ethers.formatEther(balance - (totalUncollectedRoyalties + tw3Balance))} ETH`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    }); 

function Addressable(target: string | ethers.Addressable) {
    throw new Error("Function not implemented.");
}
