import { ethers } from "ethers";
import * as crypto from "crypto";

/**
 * Generates a secure random wallet using multiple sources of entropy
 * @param userSalt - Additional random string provided by the user for extra entropy
 * @returns An ethers Wallet instance
 */
export function generateSecureWallet(userSalt: string): ethers.Wallet {
    // Combine multiple sources of entropy
    const systemEntropy = crypto.randomBytes(32);
    const timestamp = Date.now().toString();
    const saltedEntropy = crypto.createHash('sha256')
        .update(Buffer.concat([
            systemEntropy,
            Buffer.from(userSalt),
            Buffer.from(timestamp)
        ]))
        .digest();

    // Create a wallet from the combined entropy
    return new ethers.Wallet('0x' + saltedEntropy.toString('hex'));
}

/**
 * Exports the wallet details to a secure format
 * @param wallet - The wallet to export
 * @returns Object containing the address and private key
 */
export function exportWalletDetails(wallet: ethers.Wallet) {
    return {
        address: wallet.address,
        privateKey: wallet.privateKey,
    };
}

/**
 * Generates multiple secure wallets at once
 * @param count - Number of wallets to generate
 * @param userSalt - Additional random string provided by the user for extra entropy
 * @returns Array of wallet details
 */
export function generateMultipleWallets(count: number, userSalt: string) {
    return Array.from({ length: count }, (_, i) => {
        const individualSalt = `${userSalt}-${i}`;
        const wallet = generateSecureWallet(individualSalt);
        return exportWalletDetails(wallet);
    });
} 