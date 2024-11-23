import { expect } from 'chai';
import { ethers } from 'ethers';
import { WTTPHandler } from '../handlers/typescript/WTTPHandler';
import { DataPointStorage, WTTP, WTTPSite } from '../typechain-types';
import { Method } from '../types/types';
import { 
    MIME_TYPE_STRINGS, 
    CHARSET_STRINGS, 
    LANGUAGE_STRINGS, 
    LOCATION_STRINGS 
} from '../types/constants';
import hre from 'hardhat';
import { contractManager } from './helpers/contractManager';

describe('WTTPHandler', () => {
    let handler: WTTPHandler;
    let wttp: any;
    let dataPointStorage: any;
    let dataPointRegistry: any;
    let site: any;
    let tw3: any;
    let user1: any;
    let user2: any;
    let gasPrice: any;

    async function estimateGas() {
        return await hre.ethers.provider.getFeeData();
    }

    // Helper function to create test content
    async function createTestResource(path: string, content: string) {
        gasPrice = await estimateGas();
        const tx = await site.PUT(
            { path, protocol: "WTTP/2.0" },
            ethers.hexlify("0x7468"), // text/html
            ethers.hexlify("0x7574"), // utf-8
            ethers.hexlify("0x0101"), // datapoint/chunk
            tw3.address,
            ethers.toUtf8Bytes(content),
            { 
                maxFeePerGas: gasPrice.maxFeePerGas, 
                maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas 
            }
        );
        await tx.wait();
    }

    before(async function() {
        this.timeout(60000);
        [tw3, user1, user2] = await hre.ethers.getSigners();

        // Deploy or load WTTP
        const WTTP = await hre.ethers.getContractFactory("WTTP");
        const existingWTTPAddress = contractManager.getContractAddress('wttp');
        
        if (existingWTTPAddress) {
            console.log("Loading existing WTTP at:", existingWTTPAddress);
            wttp = WTTP.attach(existingWTTPAddress) as WTTP;
        } else {
            gasPrice = await estimateGas();
            wttp = await WTTP.deploy({
                maxFeePerGas: gasPrice.maxFeePerGas,
                maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas
            }) as WTTP;
            await wttp.waitForDeployment();
            contractManager.saveContract('wttp', await wttp.getAddress());
            console.log("WTTP deployed at:", await wttp.getAddress());
        }

        // Load other necessary contracts
        const DataPointStorage = await hre.ethers.getContractFactory("DataPointStorage");
        const existingDPSAddress = contractManager.getContractAddress('dataPointStorage');
        
        if (existingDPSAddress) {
            console.log("Loading existing DataPointStorage at:", existingDPSAddress);
            dataPointStorage = DataPointStorage.attach(existingDPSAddress);
        } else {
            gasPrice = await estimateGas();
            dataPointStorage = await DataPointStorage.deploy({
                maxFeePerGas: gasPrice.maxFeePerGas,
                maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas
            });
            await dataPointStorage.waitForDeployment();
            contractManager.saveContract('dataPointStorage', await dataPointStorage.getAddress());
            console.log("DataPointStorage deployed at:", await dataPointStorage.getAddress());
        }

        const DataPointRegistry = await hre.ethers.getContractFactory("DataPointRegistry");
        const existingDPRAddress = undefined;

        if (existingDPRAddress) {
            console.log("Loading existing DataPointRegistry at:", existingDPRAddress);
            dataPointRegistry = DataPointRegistry.attach(existingDPRAddress);
        } else {
            gasPrice = await estimateGas();
            dataPointRegistry = await DataPointRegistry.deploy(dataPointStorage.target, tw3.address, {
                maxFeePerGas: gasPrice.maxFeePerGas,
                maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas
            });
            await dataPointRegistry.waitForDeployment();
            contractManager.saveContract('dataPointRegistry', await dataPointRegistry.getAddress());
            console.log("DataPointRegistry deployed at:", await dataPointRegistry.getAddress());
        }

        const WTTPSite = await hre.ethers.getContractFactory("MyFirstWTTPSite");
        const existingSiteAddress = undefined;

        if (existingSiteAddress) {
            console.log("Loading existing WTTPSite at:", existingSiteAddress);
            site = WTTPSite.attach(existingSiteAddress);
        } else {
            gasPrice = await estimateGas();
            site = await WTTPSite.deploy(dataPointRegistry.target, tw3.address, {
                maxFeePerGas: gasPrice.maxFeePerGas,
                maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas
            });
            await site.waitForDeployment();
            contractManager.saveContract('wttpSite', await site.getAddress());
            console.log("WTTPSite deployed at:", await site.getAddress());
        }

        // Initialize handler with deployed contracts
        handler = new WTTPHandler(wttp.target, tw3, hre.network.name);
    });

    describe('Header Parsing', () => {
        describe('Range Headers', () => {
            const testCases = [
                {
                    name: 'valid chunks range',
                    input: 'chunks=0-100',
                    expected: { start: 0, end: 100 }
                },
                {
                    name: 'single chunk range',
                    input: 'chunks=5-',
                    expected: { start: 5, end: 0 }
                },
                {
                    name: 'undefined input',
                    input: undefined,
                    expected: { start: 0, end: 0 }
                },
                {
                    name: 'invalid format',
                    input: 'invalid-range',
                    expected: { start: 0, end: 0 }
                },
                {
                    name: 'empty range',
                    input: '',
                    expected: { start: 0, end: 0 }
                },
                {
                    name: 'malformed chunks',
                    input: 'chunks=',
                    expected: { start: 0, end: 0 }
                }
            ];

            testCases.forEach(({ name, input, expected }) => {
                it(`should handle ${name}`, () => {
                    expect(handler.parseRange(input)).to.deep.equal(expected);
                });
            });
        });

        describe('MIME Type Parsing', () => {
            const mimeTests = [
                {
                    name: 'valid mime type',
                    input: 'text/html',
                    expected: MIME_TYPE_STRINGS['text/html']
                },
                {
                    name: 'invalid mime type',
                    input: 'invalid/type',
                    expected: undefined
                }
            ];

            mimeTests.forEach(({ name, input, expected }) => {
                it(`should handle ${name}`, () => {
                    expect(handler.parseMimeType(input)).to.equal(expected);
                });
            });
        });

        describe('Charset Parsing', () => {
            const charsetTests = [
                {
                    name: 'valid charset',
                    input: 'utf-8',
                    expected: CHARSET_STRINGS['utf-8']
                },
                {
                    name: 'invalid charset',
                    input: 'invalid',
                    expected: '0x0000'
                }
            ];

            charsetTests.forEach(({ name, input, expected }) => {
                it(`should handle ${name}`, () => {
                    expect(handler.parseCharset(input)).to.equal(expected);
                });
            });
        });

        describe('Accept Headers', () => {
            it('should parse multiple accept values', () => {
                const accepts = 'text/html,application/json';
                const expected = [
                    MIME_TYPE_STRINGS['text/html'],
                    MIME_TYPE_STRINGS['application/json']
                ];
                expect(handler.parseAccepts(accepts)).to.deep.equal(expected);
            });

            it('should handle empty accept header', () => {
                expect(handler.parseAccepts('')).to.deep.equal([]);
            });
        });

        describe('Accept-Language', () => {
            it('should parse multiple language values', () => {
                const languages = 'en-us,fr-fr';
                const expected = [
                    LANGUAGE_STRINGS['en-us'],
                    LANGUAGE_STRINGS['fr-fr']
                ];
                expect(handler.parseAcceptsLanguage(languages)).to.deep.equal(expected);
            });

            it('should handle empty language header', () => {
                expect(handler.parseAcceptsLanguage('')).to.deep.equal([]);
            });
        });
    });

    describe('URL Parsing', () => {
        const urlTests = [
            {
                name: 'valid URL',
                input: 'wttp://example.eth/index.html',
                expected: {
                    host: 'example.eth',
                    path: '/index.html'
                }
            },
            {
                name: 'URL with query params',
                input: 'wttp://example.eth/page.html?param=value',
                expected: {
                    host: 'example.eth',
                    path: '/page.html'
                }
            }
        ];

        urlTests.forEach(({ name, input, expected }) => {
            it(`should handle ${name}`, async () => {
                const result = handler.parseURL(input);
                expect(result).to.include(expected);
            });
        });
    });

    describe('Address Calculation', () => {
        const contentTests = [
            {
                name: 'simple content',
                content: 'Hello, World!',
                mimeType: 'text/plain',
                charset: 'utf-8',
                location: 'datapoint/chunk'
            },
            {
                name: 'HTML content',
                content: '<html><body>Test Content</body></html>',
                mimeType: 'text/html',
                charset: 'utf-8',
                location: 'datapoint/chunk'
            },
            {
                name: 'large content',
                content: 'A'.repeat(1000),
                mimeType: 'text/plain',
                charset: 'utf-8',
                location: 'datapoint/chunk'
            }
        ];

        contentTests.forEach(({ name, content, mimeType, charset, location }) => {
            it(`should match contract calculation for ${name}`, async function() {
                const mimeTypeHex = MIME_TYPE_STRINGS[mimeType as keyof typeof MIME_TYPE_STRINGS];
                const charsetHex = CHARSET_STRINGS[charset as keyof typeof CHARSET_STRINGS];
                const locationHex = LOCATION_STRINGS[location as keyof typeof LOCATION_STRINGS];

                const handlerAddress = handler.calculateDataPointAddress({
                    host: 'localhost',
                    path: '/',
                    data: ethers.toUtf8Bytes(content),
                    mimeType: mimeTypeHex,
                    charset: charsetHex,
                    location: locationHex
                });

                const contractAddress = await dataPointStorage.calculateAddress({
                    structure: {
                        mimeType: ethers.hexlify(mimeTypeHex),
                        charset: ethers.hexlify(charsetHex),
                        location: ethers.hexlify(locationHex)
                    },
                    data: ethers.toUtf8Bytes(content)
                });

                expect(handlerAddress).to.equal(contractAddress);
            });
        });

        it('should fail address calculation for empty content', async () => {
            try {
                handler.calculateDataPointAddress({
                    host: 'localhost',
                    path: '/',
                    data: ethers.toUtf8Bytes(''),
                    mimeType: MIME_TYPE_STRINGS['text/plain'],
                    charset: CHARSET_STRINGS['utf-8'],
                    location: LOCATION_STRINGS['datapoint/chunk']
                });
                // Should not reach here
                expect.fail('Expected error was not thrown');
            } catch (error: any) {
                expect(error.message).to.equal('Data is required to calculate data point address');
            }
        });
    });

    describe('Fetch Operations', () => {
        beforeEach(async function() {
            this.timeout(30000);
        });

        it('should fetch single data point resource', async function() {
            const content = "<html><body>More Test Content</body></html>";
            await handler.fetch(`wttp://${site.target}/test.html`, { 
                method: Method.PUT, 
                headers: {
                    'Content-Type': 'text/html',
                    'Content-Location': 'datapoint/chunk'
                },
                body: content 
            });

            const response = await handler.fetch(`wttp://${site.target}/test.html`);
            expect(response.status).to.equal(200);
            expect(await response.text()).to.equal(content);
        });

        it('should handle 404 for non-existent resources', async function() {
            const response = await handler.fetch(`wttp://${site.target}/nonexistent.html`);
            expect(response.status).to.equal(404);
        });
    });
});
