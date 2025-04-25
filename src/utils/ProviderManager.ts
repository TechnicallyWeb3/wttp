import { ethers, Provider } from "ethers";
import fs from 'fs';
import path from 'path';
import { NETWORK_ALIASES } from "../types/constants";

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
    /** Map of chain IDs to network names */
    private chainIdToNetwork: Map<string, string> = new Map();

    /**
     * Initializes the ProviderManager with default network configuration
     */
    constructor() {
        this.loadConfig();
        this.buildChainIdMap();
        this.provider = this.getProvider(this.config.masterNetwork);
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
     * Builds a map of chain IDs to network names for quick lookup
     * @private
     */
    private buildChainIdMap() {
        this.chainIdToNetwork = new Map();
        for (const [networkName, networkConfig] of Object.entries(this.config.networks)) {
            if (networkConfig && typeof networkConfig === 'object' && 'chainId' in networkConfig) {
                this.chainIdToNetwork.set(String(networkConfig.chainId), networkName);
            }
        }
    }

    /**
     * Resolves a network identifier (name, alias, or chain ID) to a network name
     * @param networkIdentifier - Network identifier to resolve
     * @returns Resolved network name
     * @throws Error if network identifier cannot be resolved
     */
    public resolveNetworkName(networkIdentifier: string): string {
        // Check if it's already a valid network name
        if (this.config.networks[networkIdentifier]) {
            return networkIdentifier;
        }

        // Check if it's a network alias
        if (networkIdentifier in NETWORK_ALIASES) {
            const resolvedName = NETWORK_ALIASES[networkIdentifier as keyof typeof NETWORK_ALIASES];
            if (this.config.networks[resolvedName]) {
                return resolvedName;
            }
        }

        // Check if it's a chain ID
        if (this.chainIdToNetwork.has(networkIdentifier)) {
            return this.chainIdToNetwork.get(networkIdentifier) as string;
        }

        // If we get here, we couldn't resolve the network
        throw new Error(`Unknown network identifier: ${networkIdentifier}`);
    }

    /**
     * Gets RPC URL for specified network
     * @param networkIdentifier - Network identifier to get RPC URL for
     * @returns RPC URL string
     * @throws Error if no RPC URL is configured for network
     */
    public getRpcUrl(networkIdentifier: string) {
        const networkName = this.resolveNetworkName(networkIdentifier);
        const rpcUrl = this.config.networks[networkName].rpcUrls?.[0];
        if (!rpcUrl) {
            throw new Error(`No RPC URL found for network ${networkName}`);
        }
        return rpcUrl;
    }

    /**
     * Creates or returns provider for specified network
     * @param networkIdentifier - Network identifier to get provider for
     * @returns Provider instance for the network
     */
    public getProvider(networkIdentifier: string) {
        const networkName = this.resolveNetworkName(networkIdentifier);
        const networkConfig = this.config.networks[networkName];
        this.provider = new ethers.JsonRpcProvider(
            networkConfig.rpcUrls[0], 
            networkConfig.chainId
        );
        return this.provider;
    }
}
