import { expect } from 'chai';
import { ENSResolver } from '../src/utils/ENSResolver';

describe('ENSResolver', () => {
    let resolver: ENSResolver;

    beforeEach(() => {
        resolver = new ENSResolver();
    });

    it('should return unchanged Ethereum address', async () => {
        const address = '0x1234567890123456789012345678901234567890';
        const result = await resolver.resolve(address);
        expect(result).to.equal(address);
    });

    it('should resolve vitalik.eth', async () => {
        const result = await resolver.resolve('vitalik.eth');
        // This is Vitalik's actual ENS address as of March 2024
        expect(result).to.equal('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    });

    it('should return unchanged non-ENS strings', async () => {
        const host = 'example.com';
        const result = await resolver.resolve(host);
        expect(result).to.equal(host);
    });
}); 