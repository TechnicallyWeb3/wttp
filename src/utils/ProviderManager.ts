import { ethers, Provider } from "ethers";
import fs from 'fs';
import path from 'path';
import { SupportedNetworks } from "../types/constants";

/**
 * Manages Ethereum providers for different networks
 * @remarks
 * Handles provider initialization, configuration loading, and network switching
 */
export class ProviderManager {
    /** Current active provider instance */
    private provider: Provider;
    /** Configuration data loaded from wttp.config.json */
    private config: any;

    /**
     * Initializes the ProviderManager with default network configuration
     */
    constructor() {
        this.loadConfig();
        this.provider = this.getProvider(this.config.masterNetwork);
        // console.log(await this.provider.getBlockNumber());
    }

    /**
     * Loads configuration from wttp.config.json
     * @throws Error if config file cannot be read or parsed
     */
    private loadConfig() {
        try {
            const configPath = path.join(__dirname, '../wttp.config.json');
            this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (error) {
            if (error instanceof Error) {
                console.error('Error reading config:', error.message);
                throw error;
            } else {
                console.error('Error reading config:', error);
                throw error;
            }
        }
    }

    /**
     * Gets RPC URL for specified network
     * @param network - Network to get RPC URL for
     * @returns RPC URL string
     * @throws Error if no RPC URL is configured for network
     */
    public getRpcUrl(network: SupportedNetworks) {
        // TODO: Create a RPC URL manager to rank the RPC URLs so the best one is always at index 0
        const rpcUrl = this.config.networks[network].rpcUrls?.[0];
        if (!rpcUrl) {
            throw new Error(`No RPC URL found for network ${network}`);
        }
        return rpcUrl;
    }

    /**
     * Creates or returns provider for specified network
     * @param network - Network to get provider for
     * @returns Provider instance for the network
     */
    public getProvider(network: SupportedNetworks) {
        this.provider = new ethers.JsonRpcProvider(this.getRpcUrl(network), this.config.networks[network].chainId);
        return this.provider;
    }
}
