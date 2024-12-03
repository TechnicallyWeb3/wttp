import fs from 'fs';
import path from 'path';
import { network } from 'hardhat';
import { SupportedNetworks } from '../src/types/constants';

interface NetworkConfig {
    chainId?: number;
    rpcUrls?: string[];
    contracts?: {
        dataPointStorageAddress?: string;
        dataPointRegistryAddress?: string;
        wttpPermissionsAddress?: string;
        wttpStorageAddress?: string;
        wttpSiteAddress?: string;
        wttpAddress?: string;
    };
}

interface Config {
    masterNetwork: SupportedNetworks;
    networks: {
        [network: string]: NetworkConfig;
    };
}

class ContractManager {
    private config: Config;

    constructor() {
        this.loadConfig();
    }

    private loadConfig(): Config {
        try {
            this.config = JSON.parse(fs.readFileSync(path.join(__dirname, '../wttp.config.json'), 'utf8'));
        } catch {
            this.config = {
                masterNetwork: network.name as SupportedNetworks || 'localhost',
                networks: {}
            };
        }

        return this.config;
    }

    private saveConfig() {
        fs.writeFileSync(
            path.join(__dirname, '../wttp.config.json'),
            JSON.stringify(this.config, null, 2)
        );
    }

    public getNetworkConfig(): NetworkConfig {
        const networkName = network.name;
        if (!this.config[networkName]) {
            this.config[networkName] = {};
        }
        return this.config[networkName];
    }

    public async saveContract(
        contractName: 'dataPointStorage' | 'dataPointRegistry' | 'wttpPermissions' | 'wttpStorage' | 'wttpSite' | 'wttp',
        address: string
    ) {
        const networkName = network.name;
        if (networkName === 'hardhat') {
            return;
        }

        if (!this.config.networks) {
            this.config.masterNetwork = networkName as SupportedNetworks;
            this.config.networks = {};
        }

        if (!this.config.networks[networkName]) {
            this.config.networks[networkName] = {};
        }

        // Ensure contracts object exists
        if (!this.config.networks[networkName].contracts) {
            this.config.networks[networkName].contracts = {};
        }

        // console.log(network.provider);


        // Update network configuration
        this.config.networks[networkName] = {
            chainId: network.config.chainId,
            rpcUrls: this.config.networks[networkName].rpcUrls || [], // TODO: Add rpcUrls to config, use a trusted rpc list file.
            contracts: {
                ...this.config.networks[networkName].contracts,
                [`${contractName}Address`]: address
            }
        };

        this.saveConfig();
    }

    public getContractAddress(
        contractName: 'dataPointStorage' | 'dataPointRegistry' | 'wttpPermissions' | 'wttpStorage' | 'wttpSite' | 'wttp'
    ): string | undefined {
        const networkName = network.name;
        return this.config.networks[networkName]?.contracts?.[`${contractName}Address`];
    }
}

// Export a single instance
export const contractManager = new ContractManager(); 