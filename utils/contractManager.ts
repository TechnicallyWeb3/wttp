import fs from 'fs';
import path from 'path';
import { network } from 'hardhat';

interface NetworkConfig {
    dataPointStorageAddress?: string;
    dataPointRegistryAddress?: string;
    wttpPermissionsAddress?: string;
    wttpStorageAddress?: string;
    wttpSiteAddress?: string;
}

interface Config {
    [network: string]: NetworkConfig;
}

class ContractManager {
    private config: Config;

    constructor() {
        this.config = this.loadConfig();
    }

    private loadConfig(): Config {
        try {
            return JSON.parse(fs.readFileSync(path.join(__dirname, '../test.wttp.config.json'), 'utf8'));
        } catch {
            return {};
        }
    }

    private saveConfig() {
        fs.writeFileSync(
            path.join(__dirname, '../test.wttp.config.json'), 
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

    public saveContract(contractName: string, address: string) {
        const networkName = network.name;
        if (networkName === 'hardhat') {
            return;
        }
        if (!this.config[networkName]) {
            this.config[networkName] = {};
        }
        
        const addressKey = `${contractName}Address`;
        this.config[networkName][addressKey] = address;
        this.saveConfig();
    }

    public getContractAddress(contractName: string): string | undefined {
        const networkName = network.name;
        return this.config[networkName]?.[`${contractName}Address`];
    }
}

// Export a single instance
export const contractManager = new ContractManager(); 