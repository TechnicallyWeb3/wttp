import { generateSecureWallet } from '../lib/keyGenerator';

// Generate a single wallet
const wallet = generateSecureWallet("this is the WTTP deployer");
console.log(wallet.privateKey);
console.log(wallet.address);