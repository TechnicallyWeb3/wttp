import { ethers, Signer, Addressable, EventLog } from 'ethers';
import { WTTP, WTTP__factory, WTTPSite__factory, WTTPSite, DataPointRegistry__factory } from '../typechain-types';
import { Method, RequestOptions } from './types/types';
import { CHARSET_STRINGS, DEFAULT_HEADER, LANGUAGE_STRINGS, LOCATION_STRINGS, MIME_TYPE_STRINGS, MIME_TYPES, MASTER_NETWORK, SupportedNetworks, HTTP_STATUS_STRINGS } from './types/constants';
import { ENSResolver, RequestBuilder, ResponseBuilder, URLParser, ProviderManager } from './utils/WTTPUtils';
import fs from 'fs';
import path from 'path';

/**
 * Main handler class for interacting with the WTTP protocol
 * @remarks
 * This class provides a fetch-like interface for interacting with web resources stored on the blockchain
 * through the WTTP (Web3 Transfer Protocol) contract.
 */
export class WTTPHandler {
    /** Address of the main WTTP contract */
    public wttpAddress: string | Addressable;
    /** Instance of the WTTP contract */
    private wttp: WTTP;
    /** Default signer for transactions */
    public defaultSigner: Signer;
    /** Primary network for operations */
    public masterNetwork: SupportedNetworks;
    /** Configuration settings */
    public config: any;
    /** Ethereum provider instance */
    public provider: ethers.Provider;
    /** URL parsing utility */
    private urlParser: URLParser;
    /** Request building utility */
    private requestBuilder: RequestBuilder;
    /** Response building utility */
    private responseBuilder: ResponseBuilder;
    /** ENS resolution utility */
    private ensResolver: ENSResolver;
    /** Network provider management utility */
    private providerManager: ProviderManager;

    /**
     * Updates the WTTP contract instance
     * @param wttpAddress - Address of the WTTP contract
     */
    public setWTTP(wttpAddress: string | Addressable) {
        this.wttp = WTTP__factory.connect(String(wttpAddress), this.defaultSigner);
        this.wttpAddress = wttpAddress;
    }

    /**
     * Updates the signer used for transactions
     * @param signer - New signer to use
     */
    public setSigner(signer: Signer) {
        this.defaultSigner = signer.connect(this.provider);
    }

    /**
     * Changes the active network
     * @param networkName - Name of the network to switch to
     */
    public setNetwork(networkName: SupportedNetworks) {
        this.masterNetwork = networkName;
        this.switchNetwork(networkName);
    }

    /**
     * Creates a new WTTPHandler instance
     * @param wttpAddress - Optional address of the WTTP contract
     * @param signer - Optional signer for transactions
     * @param networkName - Optional network to connect to
     */
    constructor(
        wttpAddress?: string | Addressable,
        signer?: Signer,
        networkName?: SupportedNetworks
    ) {

        this.urlParser = new URLParser();
        this.requestBuilder = new RequestBuilder();
        this.responseBuilder = new ResponseBuilder();
        this.ensResolver = new ENSResolver();
        this.providerManager = new ProviderManager();

        this.config = JSON.parse(fs.readFileSync(path.join(__dirname, 'wttp.config.json'), 'utf8'));

        if (!networkName) {
            networkName = MASTER_NETWORK as SupportedNetworks;
        }

        if (!wttpAddress) {
            wttpAddress = this.getWTTPAddress(networkName);
        }

        this.provider = this.getProvider(networkName);
        // console.log(this.provider);

        if (!signer) {
            signer = ethers.Wallet.createRandom().connect(this.provider);
        } else if (!signer.provider) {
            signer = signer.connect(this.provider);
        }

        this.defaultSigner = signer;
        this.masterNetwork = networkName;
        this.wttpAddress = wttpAddress;
        this.wttp = WTTP__factory.connect(String(wttpAddress), signer);
        // // Initialize WTTP synchronously instead of asynchronously
        // try {
        //     // Remove network switching for testing
        //     this.wttp = WTTP__factory.connect(wttp, signer);
        //     console.log(`WTTPHandler initialized with WTTP at ${wttp}`);
        // } catch (error) {
        //     console.error('Failed to initialize WTTP:', error);
        //     throw error; // Re-throw to make initialization failures more visible
        // }
    }

    /**
     * Fetches a resource from a WTTP site
     * @param url - URL of the resource to fetch
     * @param options - Request options similar to the Fetch API
     * @returns Promise<Response> - Response object similar to the Fetch API
     * 
     * @example
     * ```typescript
     * const response = await handler.fetch('wttp://site.eth/resource.html', {
     *   method: 'GET',
     *   headers: {
     *     'Accept': 'text/html'
     *   }
     * });
     * ```
     */
    async fetch(url: string, options: {
        method?: Method | string;
        headers?: {
            'If-None-Match'?: string;
            'If-Modified-Since'?: number;
            'Content-Type'?: string;
            'Content-Location'?: string;
            'Range'?: string;
            'Accept'?: string;
            'Accept-Charset'?: string;
            'Accept-Language'?: string;
            'Publisher'?: string;
            [key: string]: any;
        };
        body?: string | Uint8Array;
        signer?: Signer;
    } = {}): Promise<Response> {

        // const provider = this.providerManager.getProvider('seth');
        // console.log(await provider.getBlockNumber());

        const { host, path, networkName } = this.parseURL(url);
        // Convert string method to Method enum if needed
        let convertedMethod;
        if (typeof options.method === 'string') {
            convertedMethod = Method[options.method.toUpperCase() as keyof typeof Method];
            if (convertedMethod === undefined) {
                throw new Error(`Invalid HTTP method: ${options.method}`);
            }
        } else if (!options.method) {
            convertedMethod = Method.GET;
        } else {
            convertedMethod = options.method;
        }

        const request = this.buildRequest(
            {
                method: convertedMethod || Method.GET,
                host: host,
                path: path,
                content: options.body,
                ifNoneMatch: options.headers?.['If-None-Match'],
                ifModifiedSince: options.headers?.['If-Modified-Since'],
                range: this.parseRange(options.headers?.['Range']),
                mimeType: this.parseMimeType(options.headers?.['Content-Type']),
                charset: this.parseCharset(options.headers?.['Content-Type']),
                location: this.parseLocation(options.headers?.['Content-Location']),
                publisher: options.headers?.['Publisher'] || ethers.ZeroAddress,
                accepts: this.parseAccepts(options.headers?.['Accept']),
                acceptsCharset: this.parseAcceptsCharset(options.headers?.['Accept-Charset']),
                acceptsLocation: this.parseAcceptsLanguage(options.headers?.['Accept-Language']),
                chunkIndex: this.parseChunkIndex(options.headers?.['Range']),
                signer: options.signer || this.defaultSigner,
                networkName: networkName || this.masterNetwork
            }
        );

        // console.log(request);

        if (networkName && networkName !== this.masterNetwork) {
            // Switch networks if specified
            await this.switchNetwork(networkName as SupportedNetworks);
        }

        const response = this.executeRequest(await request).then((response) => {
            if (this.masterNetwork && networkName && networkName !== this.masterNetwork) {
                // Switch back to master network
                this.switchNetwork(this.masterNetwork);
            }
            return response;
        });

        return response;
    }

    /**
     * Parses range headers into start and end values
     * @param range - Range header string
     * @returns Object containing start and end values
     */
    public parseRange(range?: string) {
        if (!range) return { start: 0, end: 0 };
        let match = range.match(/chunks=(\d+)-(\d+)?/);
        if (!match) return { start: 0, end: 0 };
        return {
            start: parseInt(match[1]),
            end: match[2] ? parseInt(match[2]) : 0
        };
    }

    /**
     * Parses MIME type from Content-Type header
     * @param contentType - Content-Type header string
     * @returns MIME type bytes2 representation or undefined
     */
    public parseMimeType(contentType?: string) {
        if (!contentType) return undefined;
        contentType = contentType.includes(';') ? contentType.split(';')[0] : contentType.trim();
        if (contentType in MIME_TYPE_STRINGS) {
            return MIME_TYPE_STRINGS[contentType as keyof typeof MIME_TYPE_STRINGS];
        }
        return undefined;
    }

    /**
     * Parses charset from Content-Type header
     * @param contentType - Content-Type header string
     * @returns Charset bytes2 representation or default "0x0000"
     */
    public parseCharset(contentType?: string) {
        if (!contentType) return "0x0000";
        contentType = contentType.includes(';') ? contentType.split(';')[1].trim() : contentType.trim();
        contentType = contentType.includes('charset=') ? contentType.split('charset=')[1].trim() : contentType;
        if (contentType in CHARSET_STRINGS) {
            return CHARSET_STRINGS[contentType as keyof typeof CHARSET_STRINGS];
        }
        return "0x0000";
    }

    /**
     * Parses location from Content-Location header
     * @param contentLocation - Content-Location header string
     * @returns Location bytes2 representation or undefined
     */
    public parseLocation(contentLocation?: string) {
        if (!contentLocation) return undefined;
        if (contentLocation.trim() in LOCATION_STRINGS) {
            return LOCATION_STRINGS[contentLocation.trim() as keyof typeof LOCATION_STRINGS];
        }
        return undefined;
    }

    /**
     * Parses Accept header into array of MIME types
     * @param accept - Accept header string
     * @returns Array of accepted MIME type bytes2 representations
     */
    public parseAccepts(accept?: string) {
        if (!accept) return [];
        return accept.split(',')
            .map(s => s.trim())
            .map(type => MIME_TYPE_STRINGS[type as keyof typeof MIME_TYPE_STRINGS])
            .filter((type): type is typeof MIME_TYPES[keyof typeof MIME_TYPES] => type !== undefined);
    }

    /**
     * Parses Accept-Charset header into array of charsets
     * @param acceptCharset - Accept-Charset header string
     * @returns Array of accepted charset bytes2 representations
     */
    public parseAcceptsCharset(acceptCharset?: string) {
        if (!acceptCharset) return [];
        return acceptCharset.split(',')
            .map(s => s.trim())
            .map(type => CHARSET_STRINGS[type as keyof typeof CHARSET_STRINGS])
            .filter((type): type is typeof CHARSET_STRINGS[keyof typeof CHARSET_STRINGS] => type !== undefined);
    }

    /**
     * Parses Accept-Language header into array of languages
     * @param acceptLanguage - Accept-Language header string
     * @returns Array of accepted language bytes4 representations
     */
    public parseAcceptsLanguage(acceptLanguage?: string) {
        if (!acceptLanguage) return [];
        return acceptLanguage.split(',')
            .map(s => s.trim())
            .map(type => LANGUAGE_STRINGS[type as keyof typeof LANGUAGE_STRINGS])
            .filter((type): type is typeof LANGUAGE_STRINGS[keyof typeof LANGUAGE_STRINGS] => type !== undefined);
    }

    /**
     * Parses chunk index from Range header
     * @param range - Range header string
     * @returns Chunk index number or undefined
     */
    public parseChunkIndex(range?: string) {
        if (!range) return undefined;
        const matches = range.match(/^chunks=(\d+)/);
        return matches ? parseInt(matches[1]) : undefined;
    }

    /**
     * Converts request content to string if needed
     * @param request - Request object containing data
     * @returns String representation of content
     */
    public parseContent(request: any) {
        return request.data instanceof Uint8Array ? ethers.toUtf8String(request.data) : request.data;
    }

    /**
     * Loads or creates new WTTP contract instance
     * @param wttpAddress - Optional address of WTTP contract
     * @param signer - Optional signer for transactions
     * @param networkName - Optional network to use
     * @returns Promise<WTTP> - WTTP contract instance
     */
    public async loadWTTP(wttpAddress?: string, signer?: Signer, networkName?: SupportedNetworks) {

        if (!networkName) {
            networkName = this.masterNetwork;
        }

        if (networkName && networkName !== this.masterNetwork) {
            // Switch networks if specified
            await this.switchNetwork(networkName)
        }


        if (!wttpAddress) {
            wttpAddress = this.getWTTPAddress(networkName);
        }

        const wttp = WTTP__factory.connect(wttpAddress, signer || this.defaultSigner);

        // console.log(`WTTP loaded at ${wttp.target}`);

        if (this.masterNetwork && networkName && networkName !== this.masterNetwork) {
            // Switch back to master network
            await this.switchNetwork(this.masterNetwork);
        }

        return wttp;
    }

    /**
     * Switches the current network connection
     * @param networkName - Network to switch to
     * @private
     */
    private async switchNetwork(networkName: SupportedNetworks) {
        // console.log(`Switching to ${networkName} network`);
        // console.log((await this.provider.getNetwork()).name`);
        this.provider = this.getProvider(networkName);
        // console.log((await this.provider.getNetwork()).name);
        this.defaultSigner = this.defaultSigner.connect(this.provider);
        this.wttp = this.wttp.connect(this.defaultSigner);
        // console.log(`Switched to ${networkName} network`);
    }

    /**
     * Gets the WTTP contract address for a specific network from config
     * @param networkName - Network to get address for
     * @returns Contract address string
     * @throws Error if address not found in config
     * @private
     */
    private getWTTPAddress(networkName: string): string {
        const configPath = path.join(__dirname, 'wttp.config.json');
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            const networkConfig = config.networks[networkName];
            if (networkConfig && networkConfig.contracts.wttpAddress) {
                return networkConfig.contracts.wttpAddress;
            } else {
                throw new Error(`WTTP address not found for network: ${networkName}`);
            }
        } catch (error) {
            if (error instanceof Error) {
                console.error('Error reading WTTP address:', error.message);
                throw error;
            } else {
                console.error('Error reading WTTP address:', error);
                throw error;
            }
        }
    }

    /**
     * Loads a WTTP site contract instance
     * @param host - Address of the site contract
     * @param signer - Optional signer for transactions
     * @returns Promise<WTTPSite> - Site contract instance
     */
    public async loadSite(
        host: string,
        signer?: Signer
    ): Promise<WTTPSite> {
        const site = WTTPSite__factory.connect(host, signer || this.defaultSigner);
        return site;
    }

    /**
     * Calculates the address of a data point based on its content and metadata
     * @param request - Request containing data and metadata
     * @returns string - Address of the data point
     * @throws Error if required fields are missing
     */
    public calculateDataPointAddress(request: any): string {
        if (!request.data || request.data.length === 0) {
            throw new Error("Data is required to calculate data point address");
        }
        if (!request.mimeType || request.mimeType === '0x0000') {
            throw new Error("MIME type is required to calculate data point address");
        }
        if (!request.location || request.location === '0x0000') {
            throw new Error("Location is required to calculate data point address");
        }

        const data = request.data instanceof Uint8Array
            ? request.data
            : ethers.toUtf8Bytes(request.data);

        const mimeType = request.mimeType;
        const charset = request.charset || "0x0000";
        const location = request.location;

        const packed = ethers.concat([
            ethers.getBytes(mimeType),  // already bytes2
            ethers.getBytes(charset),   // already bytes2
            ethers.getBytes(location),  // already bytes2
            data
        ]);

        return ethers.keccak256(packed);
    }

    /**
     * Loads royalty information for a request
     * @param request - Request to check royalty for
     * @returns Promise<BigNumber> - Amount of royalty required
     */
    public async loadRoyalty(request: any) {
        // console.log(`request for ${request.host}:`);
        // console.log(request);
        const site = await this.loadSite(request.host);
        // console.log(`Site ${site.target}:`);
        // console.log(site);
        const dprAddress = await site?.DPR_();
        // console.log(`DPR: ${dprAddress}`);

        // Connect to DPR using the factory
        const dprFactory = DataPointRegistry__factory;
        const dpr = dprFactory.connect(dprAddress, this.defaultSigner);

        const dataPointAddress = this.calculateDataPointAddress(request);

        // const actualDataPointAddress = await site?.LOCATE({ protocol: "WTTP/2.0", path: request.path });
        // console.log(`Request path: ${request.path}`);
        // console.log(`Data point address: ${dataPointAddress}`);
        // console.log(`Actual data point address: ${actualDataPointAddress}`);
        const royalty = await dpr.getRoyalty(dataPointAddress);
        // console.log(`Royalty: ${royalty}`);
        // console.log(`Publisher: ${request.publisher}`);
        // console.log(`Data point address: ${dataPointAddress}`);
        return royalty;
    }

    /**
     * Executes a WTTP request
     * @param request - Prepared request object
     * @returns Promise<Response> - Response from the WTTP site
     */
    public async executeRequest(request: any) {
        // console.log(`Executing request...`);

        let rawResponse;
        if (request.error) {
            rawResponse = {
                head: {
                    responseLine: {
                        protocol: "WTTP/2.0",
                        code: request.error.code
                    },
                    headerInfo: DEFAULT_HEADER
                },
                body: ethers.toUtf8Bytes(request.error.message)
            };
            return this.buildResponse(request, rawResponse);
        }

        try {
            switch (request.method) {
                case Method.GET:
                    rawResponse = await this.wttp.GET(
                        request.requestLine,
                        request.requestHeader,
                        request.getRequest
                    );
                    break;

                case Method.HEAD:
                    rawResponse = await this.wttp.HEAD(
                        request.host,
                        request.requestLine
                    );
                    break;

                case Method.LOCATE:
                    rawResponse = await this.wttp.LOCATE(
                        request.host,
                        request.requestLine
                    );
                    break;

                case Method.PUT: {

                    if (!request.mimeType) {
                        rawResponse = {
                            head: {
                                responseLine: {
                                    protocol: "WTTP/2.0",
                                    code: 400
                                },
                                headerInfo: DEFAULT_HEADER
                            },
                            body: ethers.toUtf8Bytes("Client Error: MIME type is required for PUT requests")
                        };
                        return this.buildResponse(request, rawResponse);
                    }

                    if (!request.location) {
                        rawResponse = {
                            head: {
                                responseLine: {
                                    protocol: "WTTP/2.0",
                                    code: 400
                                },
                                headerInfo: DEFAULT_HEADER
                            },
                            body: ethers.toUtf8Bytes("Client Error: Content-Location is required for PUT requests")
                        };
                        return this.buildResponse(request, rawResponse);
                    }
                    // console.log(`Loading site ${request.host} on ${(await this.provider.getNetwork()).name}.`);
                    const site = await this.loadSite(request.host);
                    // console.log(`Site loaded`);
                    const royalty = await this.loadRoyalty(request);
                    // console.log(`Royalty: ${royalty}`);

                    try {
                        const tx = await site.connect(request.signer.connect(this.provider) || this.defaultSigner).PUT(
                            request.requestLine,
                            request.mimeType,
                            request.charset,
                            request.location,
                            request.publisher,
                            request.data,
                            { value: royalty }
                        );
                        // console.log(`Transaction sent: ${tx.hash}`);

                        const receipt = await tx.wait();

                        // Check if transaction was successful
                        if (receipt?.status === 0) {
                            throw new Error('Transaction failed');
                        }

                        // console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);

                        // Verify we have the expected event
                        const putSuccessEvent = receipt?.logs?.find(
                            (log: any) => log.fragment?.name === 'PUTSuccess'
                        ) as EventLog;

                        if (!putSuccessEvent) {
                            throw new Error('PUTSuccess event not found in transaction logs');
                        }

                        rawResponse = putSuccessEvent.args?.putResponse;
                    } catch (error) {

                        console.error('PUT transaction failed:', error);
                        let body;
                        if (error instanceof Error) {
                            body = error.message;
                        } else {
                            body = error;
                        }
                        rawResponse = {
                            head: {
                                responseLine: {
                                    protocol: "WTTP/2.0",
                                    code: 500
                                },
                                headerInfo: DEFAULT_HEADER
                            },
                            body: ethers.toUtf8Bytes(`Transaction failed: ${body}`)
                        };
                    }

                    // console.log(`Raw response:`);
                    // console.log(rawResponse);

                    // const event = (receipt?.logs?.find((e: any) => e.fragment?.name === 'PUTSuccess') as EventLog);
                    // rawResponse = event?.args?.putResponse;

                    // console.log(`Event:`);
                    // console.log(event);
                    // console.log(`Receipt Log 0 Data:`);
                    // const logs = receipt?.logs || [];
                    // const log = logs[0] || { topics: [], data: '' };
                    // console.log(log);

                    // const decoded = site.interface.parseLog(logs[0])?.fragment;
                    // const decoded1 = site.interface.parseLog(logs[1])?.fragment;
                    // console.log(`Decoded event:`);
                    // console.log(decoded);
                    // console.log(`Decoded event 1:`);
                    // console.log(decoded1);


                    break;
                }

                case Method.PATCH: {

                    if (!request.data) {
                        rawResponse = {
                            head: {
                                responseLine: {
                                    protocol: "WTTP/2.0",
                                    code: 400
                                },
                                headerInfo: DEFAULT_HEADER
                            },
                            body: ethers.toUtf8Bytes("Client Error: Data is required for PATCH requests")
                        };
                        return this.buildResponse(request, rawResponse);
                    }

                    if (!request.chunk) {
                        rawResponse = {
                            head: {
                                responseLine: {
                                    protocol: "WTTP/2.0",
                                    code: 400
                                },
                                headerInfo: DEFAULT_HEADER
                            },
                            body: ethers.toUtf8Bytes("Client Error: Chunk is required for PATCH requests")
                        };
                        return this.buildResponse(request, rawResponse);
                    }

                    const site = await this.loadSite(request.host);
                    const royalty = await this.loadRoyalty(request);
                    // console.log(`Request Signer: ${request.signer.connect(this.provider)}`);
                    // console.log(`Chunk: ${request.chunk}`);
                    // console.log(`Publisher: ${request.publisher}`);
                    const tx = await site.connect(request.signer.connect(this.provider) || this.defaultSigner).PATCH(
                        request.requestLine,
                        request.data,
                        request.chunk,
                        request.publisher,
                        { value: royalty }
                    );
                    const receipt = await tx.wait();
                    const event = receipt?.logs?.find((e: any) => e.fragment?.name === 'PATCHSuccess') as EventLog;
                    rawResponse = event?.args?.patchResponse;
                    break;
                }

                case Method.DEFINE: {
                    const site = await this.loadSite(request.host);
                    const tx = await site.connect(request.signer.connect(this.provider) || this.defaultSigner).DEFINE(
                        request.host,
                        request.requestLine,
                        request.header
                    );
                    const receipt = await tx.wait();
                    const event = receipt?.logs?.find((e: any) => e.fragment?.name === 'DEFINESuccess') as EventLog;
                    rawResponse = event?.args?.defineResponse;
                    break;
                }

                case Method.DELETE: {
                    const site = await this.loadSite(request.host);
                    const tx = await site.connect(request.signer.connect(this.provider) || this.defaultSigner).DELETE(
                        request.host,
                        request.requestLine
                    );
                    const receipt = await tx.wait();
                    const event = receipt?.logs?.find((e: any) => e.fragment?.name === 'DELETESuccess') as EventLog;
                    rawResponse = event?.args?.deleteResponse;
                    break;
                }

                default:
                    rawResponse = {
                        head: {
                            responseLine: {
                                protocol: "WTTP/2.0",
                                code: 501
                            },
                            headerInfo: DEFAULT_HEADER
                        },
                        body: ethers.toUtf8Bytes(`Client Error: Unsupported method: ${request.method}`)
                    };
            }
        } catch (error: any) {
            // Check if this is our custom HTTPError
            if (error?.message?.includes('HTTPError')) {
                // Extract code and details from the error message
                const errorMatch = error.message.match(/HTTPError\((\d+),\s*"(.*)"\)/);
                if (errorMatch) {
                    const [, code, details] = errorMatch;
                    rawResponse = {
                        head: {
                            responseLine: {
                                protocol: "WTTP/2.0",
                                code: parseInt(code)
                            },
                            headerInfo: DEFAULT_HEADER
                        },
                        body: ethers.toUtf8Bytes(details || 
                        HTTP_STATUS_STRINGS[parseInt(code) as keyof typeof HTTP_STATUS_STRINGS] || 
                        "No additional details provided")
                    };
                }
            } else {
                // Handle other types of errors
                console.error('Unexpected error:', error);
                rawResponse = {
                    head: {
                        responseLine: {
                            protocol: "WTTP/2.0",
                            code: 500
                        },
                        headerInfo: DEFAULT_HEADER
                    },
                    body: ethers.toUtf8Bytes(`Internal Server Error: ${error.message}`)
                };
            }
        }

        return rawResponse ? this.buildResponse(request, rawResponse) :
            new Response("Internal Server Error: The request was correctly formatted but the smart contract failed to produce any expected responses.", { status: 500, statusText: "Internal Server Error" });
    }

    /**
     * Builds a WTTP request object
     * @param request - Request options
     * @returns Promise of prepared request object
     */
    public buildRequest(request: RequestOptions) {
        return this.requestBuilder.build(request);
    }

    /**
     * Builds a Response object from raw WTTP response
     * @param request - Original request object
     * @param rawResponse - Raw response from WTTP contract
     * @returns Response object similar to Fetch API
     */
    public buildResponse(request: any, rawResponse: any) {
        return this.responseBuilder.build(request, rawResponse);
    }

    /**
     * Parses WTTP URLs into components
     * @param url - WTTP URL string
     * @returns Object containing host, path, and network information
     */
    public parseURL(url: string) {
        return this.urlParser.parse(url);
    }

    /**
     * Resolves ENS names to addresses
     * @param host - ENS name or address
     * @returns Promise<string> - Resolved address
     */
    public async resolveHost(host: string) {
        return this.ensResolver.resolve(host);
    }

    /**
     * Gets provider for specified network
     * @param networkName - Name of the network
     * @returns Promise<ethers.Provider> - Network provider
     */
    public getProvider(networkName: SupportedNetworks) {
        return this.providerManager.getProvider(networkName);
    }
}

/** Default instance of WTTPHandler */
export const wttp = new WTTPHandler();
