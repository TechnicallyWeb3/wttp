// ENSResolver.ts
import { ethers } from 'ethers';

export class ENSResolver {
    async resolve(host: string): Promise<string> {
        // If the host is already an address, return it
        if (host.startsWith('0x') && host.length === 42) {
            return host;
        }

        // If the host is an ENS name, resolve it
        if (host.endsWith('.eth')) {
            const provider = new ethers.JsonRpcProvider('https://eth.public-rpc.com');
            return await provider.resolveName(host) || host;
        }

        return host;
    }
}