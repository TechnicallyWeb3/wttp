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
            return JSON.parse(fs.readFileSync(path.join(__dirname, '../wttp.config.json'), 'utf8'));
        } catch {
            return {};
        }
    }

    private saveConfig() {
        fs.writeFileSync(
            path.join(__dirname, '../wttp.config.json'),
            JSON.stringify(this.config, null, 2)
        );
    }

    // private updateWttpConfig(networkName: string, addressKey: keyof NetworkConfig, address: string) {
    //     const wttpConfigPath = path.join(__dirname, '../wttp.config.ts');
    //     const wttpConfig = require(wttpConfigPath).default;

    //     if (!wttpConfig.networks[networkName]) {
    //         wttpConfig.networks[networkName] = {};
    //     }

    //     if (!wttpConfig.networks[networkName].contracts) {
    //         wttpConfig.networks[networkName].contracts = {};
    //     }

    //     wttpConfig.networks[networkName].contracts[addressKey] = address;

    //     fs.writeFileSync(
    //         wttpConfigPath,
    //         `export default ${JSON.stringify(wttpConfig, null, 2)};`
    //     );
    // }

    public getNetworkConfig(): NetworkConfig {
        const networkName = network.name;
        if (!this.config[networkName]) {
            this.config[networkName] = {};
        }
        return this.config[networkName];
    }

    public saveContract(
        contractName: 'dataPointStorage' | 'dataPointRegistry' | 'wttpPermissions' | 'wttpStorage' | 'wttpSite' | 'wttp',
        address: string
    ) {
        const networkName = network.name;
        if (networkName === 'hardhat') {
            return;
        }
        if (!this.config[networkName]) {
            this.config[networkName] = {};
        }

        const addressKey = `${contractName}Address` as keyof NetworkConfig;
        this.config[networkName][addressKey] = address;
        this.saveConfig();
        // this.updateWttpConfig(networkName, addressKey, address);
    }

    public getContractAddress(
        contractName: 'dataPointStorage' | 'dataPointRegistry' | 'wttpPermissions' | 'wttpStorage' | 'wttpSite' | 'wttp'
    ): string | undefined {
        const networkName = network.name;
        return this.config[networkName]?.[`${contractName}Address` as keyof NetworkConfig];
    }
}

// Export a single instance
export const contractManager = new ContractManager(); 