import { expect } from 'chai';
import { ethers } from 'ethers';
import { WTTPHandler } from '../handlers/typescript/WTTPHandler.alt';
import { WTTP } from '../typechain-types';
import { Method } from '../types/types';
import { MIME_TYPE_STRINGS, CHARSET_STRINGS, LANGUAGE_STRINGS, LOCATION_STRINGS } from '../types/constants';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import hre from 'hardhat';

describe('WTTPHandler', () => {
    let handler: WTTPHandler;
    let mockWTTP: WTTP;
    let mockSigner: ethers.Signer;

    beforeEach(() => {
        // Create mock WTTP contract and signer
        mockWTTP = {} as WTTP;
        mockSigner = {} as ethers.Signer;
        handler = new WTTPHandler(mockWTTP, mockSigner);
    });

    describe('Header Parsing Methods', () => {
        describe('parseRange', () => {
            it('should parse valid chunks range header', () => {
                expect(handler.parseRange('chunks=0-100')).to.deep.equal({
                    start: 0,
                    end: 100
                });
            });

            it('should parse single chunk range', () => {
                expect(handler.parseRange('chunks=5-')).to.deep.equal({
                    start: 5,
                    end: 0
                });
            });

            it('should return default range for undefined input', () => {
                expect(handler.parseRange(undefined)).to.deep.equal({
                    start: 0,
                    end: 0
                });
            });

            it('should handle invalid range format by returning default', () => {
                expect(handler.parseRange('invalid-range')).to.deep.equal({
                    start: 0,
                    end: 0
                });
            });

            it('should handle empty range by returning default', () => {
                expect(handler.parseRange('')).to.deep.equal({
                    start: 0,
                    end: 0
                });
            });

            it('should handle malformed chunks format', () => {
                expect(handler.parseRange('chunks=')).to.deep.equal({
                    start: 0,
                    end: 0
                });
            });
        });

        describe('parseMimeType', () => {
            it('should parse valid mime type', () => {
                expect(handler.parseMimeType('text/html'))
                    .to.equal(MIME_TYPE_STRINGS['text/html']);
            });

            it('should return undefined for invalid mime type', () => {
                expect(handler.parseMimeType('invalid/type')).to.be.undefined;
            });
        });

        describe('parseCharset', () => {
            it('should parse valid charset', () => {
                const charset = 'utf-8';
                expect(handler.parseCharset(charset))
                    .to.equal(CHARSET_STRINGS[charset]);
            });

            it('should return default for invalid charset', () => {
                expect(handler.parseCharset('invalid-charset'))
                    .to.equal('0x0000');
            });
        });

        describe('parseAccepts', () => {
            it('should parse multiple accept values', () => {
                const accepts = 'text/html,application/json';
                const expected = [
                    MIME_TYPE_STRINGS['text/html'],
                    MIME_TYPE_STRINGS['application/json']
                ];
                expect(handler.parseAccepts(accepts)).to.deep.equal(expected);
            });

            it('should return empty array for empty input', () => {
                expect(handler.parseAccepts('')).to.deep.equal([]);
            });
        });

        describe('parseAcceptsLanguage', () => {
            it('should parse multiple language values', () => {
                const languages = 'en-us,fr-fr';
                const expected = [
                    LANGUAGE_STRINGS['en-us'],
                    LANGUAGE_STRINGS['fr-fr']
                ];
                expect(handler.parseAcceptsLanguage(languages)).to.deep.equal(expected);
            });

            it('should return empty array for empty input', () => {
                expect(handler.parseAcceptsLanguage('')).to.deep.equal([]);
            });
        });

        describe('parseChunkIndex', () => {
            it('should parse valid chunk index', () => {
                expect(handler.parseChunkIndex('chunks=5-10')).to.equal(5);
            });

            it('should return undefined for invalid chunk index', () => {
                expect(handler.parseChunkIndex(undefined)).to.be.undefined;
            });
        });
    });

    describe('URL Parsing', () => {
        it('should parse valid URLs', async () => {
            const result = await handler.parseURL('wttp://example.eth/index.html');
            expect(result).to.have.property('host', 'example.eth');
            expect(result).to.have.property('path', '/index.html');
        });
    });

    async function deployFixture() {
        const [tw3, user1, user2] = await hre.ethers.getSigners();

        const DataPointStorage = await hre.ethers.getContractFactory("DataPointStorage");
        const dataPointStorage = await DataPointStorage.deploy();

        const DataPointRegistry = await hre.ethers.getContractFactory("DataPointRegistry");
        const dataPointRegistry = await DataPointRegistry.deploy(dataPointStorage.target, tw3.address);

        const WTTPBaseMethods = await hre.ethers.getContractFactory("Dev_WTTPBaseMethods");
        const site = await WTTPBaseMethods.deploy(dataPointRegistry.target, tw3.address, {
            cache: {
                maxAge: 0,
                sMaxage: 0,
                noStore: false,
                noCache: false,
                immutableFlag: false,
                mustRevalidate: false,
                proxyRevalidate: false,
                staleWhileRevalidate: 0,
                staleIfError: 0,
                publicFlag: false,
                privateFlag: false
            },
            methods: 2913, // Default methods
            redirect: {
                code: 0,
                location: ""
            },
            resourceAdmin: hre.ethers.ZeroHash
        });

        const WTTP = await hre.ethers.getContractFactory("WTTP");
        const wttp = await WTTP.deploy();

        const content = "<html><body>Hello World!</body></html>";
        const firstPut = await site.PUT(
            { path: "/test.html", protocol: "WTTP/2.0" },
            hre.ethers.hexlify("0x7468"), // text/html
            hre.ethers.hexlify("0x7574"), // utf-8
            hre.ethers.hexlify("0x0101"), // datapoint/chunk
            tw3.address,
            hre.ethers.toUtf8Bytes(content)
        );

        const secondPut = await site.PUT(
            { path: "/multifile.html", protocol: "WTTP/2.0" },
            hre.ethers.hexlify("0x7468"), // text/html
            hre.ethers.hexlify("0x7574"), // utf-8
            hre.ethers.hexlify("0x0101"), // datapoint/chunk
            tw3.address,
            hre.ethers.toUtf8Bytes("Chunk 1")
        );

        for (let i = 1; i < 10; i++) {
            await site.PATCH(
                { path: "/multifile.html", protocol: "WTTP/2.0" },
                hre.ethers.toUtf8Bytes(`Chunk ${i + 1}`),
                i,
                tw3.address
            );
        }

        await firstPut.wait();

        return { dataPointStorage, dataPointRegistry, site, wttp, tw3, user1, user2 };
    }

    describe('fetch', () => {
        let handler: WTTPHandler;

        beforeEach(async () => {
            const { wttp, tw3 } = await loadFixture(deployFixture);
            handler = new WTTPHandler(wttp, tw3);
        });

        it('should perform a basic GET request', async () => {
            const { site } = await loadFixture(deployFixture);
            const response = await handler.fetch(`wttp://${site.target}/test.html`);
            
            // Updated expectations to match actual Response object structure
            expect(response.status).to.equal(200);
            expect(await response.text()).to.equal("<html><body>Hello World!</body></html>");
        });

        it('should perform a GET request with headers', async () => {
            const { site } = await loadFixture(deployFixture);
            const response = await handler.fetch(`wttp://${site.target}/multifile.html`, {
                headers: {
                    'Accept': 'text/html',
                    'Range': 'chunks=0-9'
                }
            });
            
            // Updated expectations to match Response object
            expect(response.status).to.equal(200);

            // expect(response.headers.get('Content-Type')).to.contain('text/html');
        });

        it('should perform a PUT request', async () => {
            const { site } = await loadFixture(deployFixture);
            const response = await handler.fetch(`wttp://${site.target}/new.html`, {
                method: Method.PUT,
                headers: {
                    'Content-Type': 'text/html',
                    'Content-Location': 'datapoint/chunk'
                },
                body: 'Hello, WTTP!'
            });
            
            // Updated expectations to match Response object
            expect(response.status).to.equal(201);
        });

        it('should handle errors gracefully', async () => {
            const { site } = await loadFixture(deployFixture);
            
            // Mock a failing request
            const mockWTTP = {
                ...site,
                GET: async () => { throw new Error('Network error'); }
            };

            const [tw3] = await hre.ethers.getSigners();
            
            handler = new WTTPHandler(mockWTTP as any, tw3);

            try {
                await handler.fetch(`wttp://${site.target}/nonexistent.html`);
                expect.fail('Should have thrown an error');
            } catch (error: any) {
                expect(error).to.be.instanceOf(Error);
                expect(error.message).to.equal('Network error');
            }
        });

        it('should handle invalid URLs', async () => {
            try {
                await handler.fetch('invalid-url');
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.instanceOf(Error);
            }
        });
    });
});
