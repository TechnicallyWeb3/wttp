const { WTTPHandler } = require('./dist/src/WTTPHandler');
const { ethers } = require('ethers');
require('dotenv').config();

// Get the master network from the constants
const MASTER_NETWORK = process.env.MASTER_NETWORK || 'fantom';
console.log('MASTER_NETWORK:', MASTER_NETWORK);

// Create a wallet from private key if available, or use a random wallet
const signer = process.env.PRIVATE_KEY 
    ? new ethers.Wallet(process.env.PRIVATE_KEY)
    : ethers.Wallet.createRandom();

console.log('Using wallet address:', signer.address);

// Test URL with network specified in the URL
async function testMultiChainFetch() {
    try {
        // Test with different network formats
        const urls = [
            // Test with network name
            'wttp://0x7c1EecB4a6AB71B6C6E101FF811456fde4b657e3:sepolia/index.html',
            // Test with chain ID
            'wttp://0x7c1EecB4a6AB71B6C6E101FF811456fde4b657e3:11155111/index.html',
            // Test with network symbol
            'wttp://0x7c1EecB4a6AB71B6C6E101FF811456fde4b657e3:seth/index.html',
            // Test with other networks
            'wttp://0x7c1EecB4a6AB71B6C6E101FF811456fde4b657e3:ethereum/index.html',
            'wttp://0x7c1EecB4a6AB71B6C6E101FF811456fde4b657e3:eth/index.html',
            'wttp://0x7c1EecB4a6AB71B6C6E101FF811456fde4b657e3:1/index.html',
        ];

        console.log('Testing multi-chain fetch with different URL formats...');
        
        // Create a WTTP handler
        const handler = new WTTPHandler(undefined, signer, MASTER_NETWORK);
        
        for (const url of urls) {
            console.log(`\nTesting URL: ${url}`);
            try {
                // Parse the URL to verify it's correctly extracting the network
                const parsedUrl = handler.urlParser.parse(url);
                console.log('Parsed URL:', parsedUrl);
                
                // Test network resolution
                const networkName = parsedUrl.networkName;
                if (networkName) {
                    try {
                        const resolvedNetwork = handler.providerManager.resolveNetworkName(networkName);
                        console.log(`Network resolution: "${networkName}" resolves to "${resolvedNetwork}"`);
                    } catch (error) {
                        console.log(`Network resolution failed: ${error.message}`);
                    }
                }
                
                // Try to fetch the resource
                const response = await handler.fetch(url);
                console.log(`Response status: ${response.status} - ${response.statusText}`);
                
                if (response.status === 200) {
                    const data = await response.text();
                    console.log('Response data:', data.substring(0, 100) + (data.length > 100 ? '...' : ''));
                }
            } catch (error) {
                console.error(`Error with URL ${url}:`, error.message);
            }
        }
    } catch (error) {
        console.error('Error in test:', error);
    }
}

// Run the test
testMultiChainFetch().catch(console.error);