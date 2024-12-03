import { ethers, Provider } from "ethers";
import fs from 'fs';
import path from 'path';
import { SupportedNetworks } from "../types/constants";

export class ProviderManager {
    private provider: Provider;
    private config: any;

    constructor() {
        this.loadConfig();
        this.provider = this.getProvider(this.config.masterNetwork);
        // console.log(await this.provider.getBlockNumber());
    }

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

    public getRpcUrl(network: SupportedNetworks) {
        // TODO: Create a RPC URL manager to rank the RPC URLs so the best one is always at index 0
        const rpcUrl = this.config.networks[network].rpcUrls?.[0];
        if (!rpcUrl) {
            throw new Error(`No RPC URL found for network ${network}`);
        }
        return rpcUrl;
    }

    public getProvider(network: SupportedNetworks) {
        this.provider = new ethers.JsonRpcProvider(this.getRpcUrl(network), this.config.networks[network].chainId);
        return this.provider;
    }
}
