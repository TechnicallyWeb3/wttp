import { expect } from 'chai';
import { ethers } from 'ethers';
import { WTTPHandler } from '../handlers/typescript/WTTPHandler.alt';
import { DataPointStorage, WTTP, WTTPSite } from '../typechain-types';
import { Method } from '../types/types';
import { MIME_TYPE_STRINGS, CHARSET_STRINGS, LANGUAGE_STRINGS, LOCATION_STRINGS } from '../types/constants';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import hre from 'hardhat';
import { WTTPBaseMethods } from '../typechain-types';

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
                expect(handler.parseCharset('utf-invalid'))
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

        const WTTPSite = await hre.ethers.getContractFactory("MyFirstWTTPSite");
        const site = await WTTPSite.deploy(dataPointRegistry.target, tw3.address, {
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

        await firstPut.wait();
        await secondPut.wait();

        for (let i = 1; i < 10; i++) {
            await site.PATCH(
                { path: "/multifile.html", protocol: "WTTP/2.0" },
                hre.ethers.toUtf8Bytes(`Chunk ${i + 1}`),
                i,
                tw3.address
            );
        }

        return { dataPointStorage, dataPointRegistry, WTTPSite, site, wttp, tw3, user1, user2 };
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

    describe('multipart operations', () => {
        let handler: WTTPHandler;

        beforeEach(async () => {
            const { wttp, tw3 } = await loadFixture(deployFixture);
            handler = new WTTPHandler(wttp, tw3);
        });

        it('should create a multipart file using PUT and PATCH', async () => {
            const { site } = await loadFixture(deployFixture);
            
            // Initial content with PUT
            const part1 = '<html><head><title>Multipart Test</title></head>';
            const response1 = await handler.fetch(`wttp://${site.target}/multipart-test.html`, {
                method: Method.PUT,
                headers: {
                    'Content-Type': 'text/html',
                    'Content-Location': 'datapoint/chunk'
                },
                body: part1
            });
            expect(response1.status).to.equal(201);

            // Add second part with PATCH
            const part2 = '<body><h1>Part 2 Content</h1>';
            const response2 = await handler.fetch(`wttp://${site.target}/multipart-test.html`, {
                method: Method.PATCH,
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Content-Location': 'datapoint/chunk',
                    'Range': 'chunks=1'
                },
                body: part2
            });
            expect(response2.status).to.equal(200);

            // Add third part with PATCH
            const part3 = '</body></html>';
            const response3 = await handler.fetch(`wttp://${site.target}/multipart-test.html`, {
                method: Method.PATCH,
                headers: {
                    'Content-Type': 'text/html',
                    'Content-Location': 'datapoint/chunk',
                    'Range': 'chunks=2'
                },
                body: part3
            });
            expect(response3.status).to.equal(200);

            // Verify complete content
            const getResponse = await handler.fetch(`wttp://${site.target}/multipart-test.html`, {
                headers: {
                    'Range': 'chunks=0-2'
                }
            });
            
            expect(getResponse.status).to.equal(200);
            expect(await getResponse.text()).to.equal(part1 + part2 + part3);
        });

        // it('should handle invalid PATCH requests', async () => {
        //     const { site } = await loadFixture(deployFixture);
            
        //     // Try to PATCH non-existent file
        //     const response = await handler.fetch(`wttp://${site.target}/nonexistent.html`, {
        //         method: Method.PATCH,
        //         headers: {
        //             'Content-Type': 'text/html',
        //             'Content-Location': 'datapoint/chunk',
        //             'Range': 'chunks=0'
        //         },
        //         body: 'Some content'
        //     });
            
        // });
    });

    describe('royalty handling', () => {
        let handler: WTTPHandler;
        let site1: WTTPSite;
        let site2: WTTPSite;

        async function setupSites() {
            const { wttp, WTTPSite, dataPointRegistry, user1, user2 } = await loadFixture(deployFixture);
            handler = new WTTPHandler(wttp, user1);

            const defaultHeader = {
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
            };

            site1 = await WTTPSite.connect(user1).deploy(dataPointRegistry.target, user1.address, defaultHeader);
            site2 = await WTTPSite.connect(user2).deploy(dataPointRegistry.target, user2.address, defaultHeader);

            await site1.waitForDeployment();
            await site2.waitForDeployment();

            // Initial content with first user
            const content = '<html><body>Test Content</body></html>';

            // First user writes content
            const response1 = await handler.fetch(`wttp://${site1.target}/royalty-test.html`, {
                method: Method.PUT,
                headers: {
                    'Content-Type': 'text/html',
                    'Content-Location': 'datapoint/chunk'
                },
                body: content,
                signer: user1
            });

            return { dataPointRegistry, user1, user2, site1, site2, content, response1 };
        };

        it('should handle royalties when multiple users write the same chunk', async () => {
            const { dataPointRegistry, user1, user2, site1, site2, content, response1 } = await loadFixture(setupSites);
            
            // Get initial balances
            const user1InitialBalance = await dataPointRegistry.royaltyBalance(user1.address);
            const user2InitialBalance = await dataPointRegistry.royaltyBalance(user2.address);
            
            expect(response1.status).to.equal(201);

            console.log("First PUT done");
            // console.log(response1);

            // Second user writes the same content to a different path
            const response2 = await handler.fetch(`wttp://${site2.target}/royalty-test2.html`, {
                method: Method.PUT,
                headers: {
                    'Content-Type': 'text/html',
                    'Content-Location': 'datapoint/chunk'
                },
                body: content,
                signer: user2
            });
            expect(response2.status).to.equal(201);

            console.log("Second PUT done");
            // console.log(response2);

            // Get final balances
            const user1FinalBalance = await dataPointRegistry.royaltyBalance(user1.address);
            const user2FinalBalance = await dataPointRegistry.royaltyBalance(user2.address);

            // First user should receive royalty for the reused chunk
            expect(user1FinalBalance).to.be.gt(user1InitialBalance, "First user should receive royalty");
            expect(user2FinalBalance).to.equal(user2InitialBalance, "Second user should not receive royalty for reused chunk");

            // Verify both paths return the same content
            const getResponse1 = await handler.fetch(`wttp://${site1.target}/royalty-test.html`);
            const getResponse2 = await handler.fetch(`wttp://${site2.target}/royalty-test2.html`);
            
            expect(await getResponse1.text()).to.equal(content);
            expect(await getResponse2.text()).to.equal(content);
        });

        it('should handle royalties for multipart content', async () => {
            const { site, dataPointRegistry, user1, user2 } = await loadFixture(deployFixture);
            const { site1, site2, content, response1 } = await loadFixture(setupSites);
            
            const part1 = '<html><head><title>Royalty Test</title></head>';
            const part2 = '<body><h1>Test Content</h1></body></html>';

            // Get initial balances
            const user1InitialBalance = await dataPointRegistry.royaltyBalance(user1.address);
            const user2InitialBalance = await dataPointRegistry.royaltyBalance(user2.address);

            // First user creates multipart file
            await handler.fetch(`wttp://${site1.target}/multipart1.html`, {
                method: Method.PUT,
                headers: {
                    'Content-Type': 'text/html',
                    'Content-Location': 'datapoint/chunk'
                },
                body: part1,
                signer: user1
            });

            await handler.fetch(`wttp://${site1.target}/multipart1.html`, {
                method: Method.PATCH,
                headers: {
                    'Content-Type': 'text/html',
                    'Content-Location': 'datapoint/chunk',
                    'Range': 'chunks=1'
                },
                body: part2,
                signer: user1
            });

            // Second user creates file with same content
            await handler.fetch(`wttp://${site2.target}/multipart2.html`, {
                method: Method.PUT,
                headers: {
                    'Content-Type': 'text/html',
                    'Content-Location': 'datapoint/chunk'
                },
                body: part1,
                signer: user2
            });

            await handler.fetch(`wttp://${site2.target}/multipart2.html`, {
                method: Method.PATCH,
                headers: {
                    'Content-Type': 'text/html',
                    'Content-Location': 'datapoint/chunk',
                    'Range': 'chunks=1'
                },
                body: part2,
                signer: user2
            });

            // Get final balances
            const user1FinalBalance = await dataPointRegistry.royaltyBalance(user1.address);
            const user2FinalBalance = await dataPointRegistry.royaltyBalance(user2.address);

            // First user should receive royalties for both reused chunks
            expect(user1FinalBalance).to.be.gt(user1InitialBalance, "First user should receive royalties");
            expect(user2FinalBalance).to.equal(user2InitialBalance, "Second user should not receive royalties for reused chunks");

            // Verify content
            const getResponse1 = await handler.fetch(`wttp://${site1.target}/multipart1.html`);
            const getResponse2 = await handler.fetch(`wttp://${site2.target}/multipart2.html`);

            const getResponse1Text = await getResponse1.text();
            const getResponse2Text = await getResponse2.text();
            
            console.log(`GET 1: ${getResponse1Text}`);
            console.log(`GET 2: ${getResponse2Text}`);

            expect(getResponse1Text).to.equal(part1 + part2);
            expect(getResponse2Text).to.equal(part1 + part2);
        });
    });

    describe('address calculation', () => {
        let handler: WTTPHandler;
        let dataPointStorage: DataPointStorage;

        beforeEach(async () => {
            const { wttp, dataPointStorage: dps } = await loadFixture(deployFixture);
            handler = new WTTPHandler(wttp, mockSigner);
            dataPointStorage = dps;
        });

        async function compareAddresses(content: string, mimeType: string, charset: string, location: string) {
            const mimeTypeHex = MIME_TYPE_STRINGS[mimeType as keyof typeof MIME_TYPE_STRINGS];
            const charsetHex = CHARSET_STRINGS[charset as keyof typeof CHARSET_STRINGS];
            const locationHex = LOCATION_STRINGS[location as keyof typeof LOCATION_STRINGS];

            // console.log("mimeType", mimeType);
            // console.log("charset", charset);
            // console.log("location", location);

            // console.log("mimeTypeHex", mimeTypeHex);
            // console.log("charsetHex", charsetHex);
            // console.log("locationHex", locationHex);

            // Calculate address using WTTPHandler
            const handlerAddress = handler.calculateDataPointAddress({
                host: 'localhost',
                path: '/',
                data: ethers.toUtf8Bytes(content),
                mimeType: mimeTypeHex,
                charset: charsetHex,
                location: locationHex
            });

            // Calculate address using contract
            const contractAddress = await dataPointStorage.calculateAddress({
                structure: {
                    mimeType: ethers.hexlify(MIME_TYPE_STRINGS[mimeType as keyof typeof MIME_TYPE_STRINGS]),
                    charset: ethers.hexlify(CHARSET_STRINGS[charset as keyof typeof CHARSET_STRINGS] || '0x0000'),
                    location: ethers.hexlify(LOCATION_STRINGS[location as keyof typeof LOCATION_STRINGS])
                },
                data: ethers.toUtf8Bytes(content)
            });

            expect(handlerAddress).to.equal(contractAddress);
        }

        it('should match contract address calculation for simple content', async () => {
            await compareAddresses(
                'Hello, World!',
                'text/plain',
                'utf-8',
                'datapoint/chunk'
            );
        });

        it('should match contract address calculation for HTML content', async () => {
            await compareAddresses(
                '<html><body>Test Content</body></html>',
                'text/html',
                'utf-8',
                'datapoint/chunk'
            );
        });

        it('should fail address calculation for empty content', async () => {
            try {
                await compareAddresses(
                '',
                'text/plain',
                'utf-8',
                'datapoint/chunk'
                );
            } catch (error) {
                expect(error).to.be.an.instanceOf(Error);
                expect(error.message).to.equal('Data is required to calculate data point address');
            }
        });

        it('should match contract address calculation for binary content', async () => {
            // Create some binary content
            const binaryContent = String.fromCharCode(...Array(256).keys());
            await compareAddresses(
                binaryContent,
                'application/octet-stream',
                'utf-8',
                'datapoint/chunk'
            );
        });

        it('should match contract address calculation for large content', async () => {
            // Create a large string
            const largeContent = 'A'.repeat(10000);
            await compareAddresses(
                largeContent,
                'text/plain',
                'utf-8',
                'datapoint/chunk'
            );
        });
    });
});
