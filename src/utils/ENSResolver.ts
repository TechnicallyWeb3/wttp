// ENSResolver.ts
import { ethers } from 'ethers';
import { ProviderManager } from './ProviderManager';

export class ENSResolver {
    async resolve(host: string): Promise<string> {
        // If the host is already an address, return it
        if (host.startsWith('0x') && host.length === 42) {
            return host;
        }

        const providerManager = new ProviderManager();

        // If the host is an ENS name, resolve it
        if (host.endsWith('.eth')) {

            const rpcUrl = providerManager.getRpcUrl('ethereum');
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const resolved = await provider.resolveName(host);
            if (resolved) {
                return resolved;
            }
            throw new Error(`Failed to resolve ENS name ${host}`);
        }

        return host;
    }
}