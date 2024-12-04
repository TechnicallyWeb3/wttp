import fs from 'fs';
import path from 'path';
import hre from 'hardhat';

export function getDeploymentAddress(contractName: string): string {
    const configPath = path.join(__dirname, '../wttp.config.json');
    
    if (!fs.existsSync(configPath)) {
        throw new Error('wttp.config.json not found');
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const networkName = hre.network.name;
    
    if (!config.networks?.[networkName]?.contracts?.[contractName + 'Address']) {
        throw new Error(`Address not found for contract ${contractName} on network ${networkName}`);
    }

    return config.networks[networkName].contracts[contractName + 'Address'];
} 