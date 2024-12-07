import { ethers, Signer, Addressable, EventLog } from 'ethers';
import { WTTP, WTTP__factory,  WTTPSite__factory, WTTPSite, DataPointRegistry__factory } from '../typechain-types';
import { Method, RequestOptions } from './types/types';
import { CHARSET_STRINGS, DEFAULT_HEADER, LANGUAGE_STRINGS, LOCATION_STRINGS, MIME_TYPE_STRINGS, MIME_TYPES, MASTER_NETWORK, SupportedNetworks } from './types/constants';
import { ENSResolver, RequestBuilder, ResponseBuilder, URLParser, ProviderManager } from './utils/WTTPUtils';
import fs from 'fs';
import path from 'path';

export class WTTPHandler {
    public wttpAddress: string | Addressable;
    private wttp: WTTP;
    public defaultSigner: Signer;
    public masterNetwork: SupportedNetworks;
    public config: any;
    public provider: ethers.Provider;
    private urlParser: URLParser;
    private requestBuilder: RequestBuilder;
    private responseBuilder: ResponseBuilder;
    private ensResolver: ENSResolver;
    private providerManager: ProviderManager;

    public setWTTP(wttpAddress: string | Addressable) {
        this.wttp = WTTP__factory.connect(String(wttpAddress), this.defaultSigner);
        this.wttpAddress = wttpAddress;
    }

    public setSigner(signer: Signer) {
        this.defaultSigner = signer.connect(this.provider);
    }

    public setNetwork(networkName: SupportedNetworks) {
        this.masterNetwork = networkName;
        this.switchNetwork(networkName);
    }

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

        const provider = this.providerManager.getProvider(networkName);
        
        if (!signer) {
            signer = ethers.Wallet.createRandom().connect(provider);
        } else if (!signer.provider) {
            signer = signer.connect(provider);
        }

        this.defaultSigner = signer;
        this.masterNetwork = networkName;
        this.wttpAddress = wttpAddress;
        this.wttp = WTTP__factory.connect(String(wttpAddress), signer);
        this.provider = provider;
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

        const response = this.executeRequest(await request);

        if (this.masterNetwork && networkName && networkName !== this.masterNetwork) {
            // Switch back to master network
            await this.switchNetwork(this.masterNetwork);
        }

        return response;
    }

    // Helper methods for parsing headers
    public parseRange(range?: string) {
        if (!range) return { start: 0, end: 0 };
        let match = range.match(/chunks=(\d+)-(\d+)?/);
        if (!match) return { start: 0, end: 0 };
        return {
            start: parseInt(match[1]),
            end: match[2] ? parseInt(match[2]) : 0
        };
    }

    public parseMimeType(contentType?: string) {
        if (!contentType) return undefined;
        contentType = contentType.includes(';') ? contentType.split(';')[0] : contentType.trim();
        if (contentType in MIME_TYPE_STRINGS) {
            return MIME_TYPE_STRINGS[contentType as keyof typeof MIME_TYPE_STRINGS];
        }
        return undefined;
    }

    public parseCharset(contentType?: string) {
        if (!contentType) return "0x0000";
        contentType = contentType.includes(';') ? contentType.split(';')[1].trim() : contentType.trim();
        contentType = contentType.includes('charset=') ? contentType.split('charset=')[1].trim() : contentType;
        if (contentType in CHARSET_STRINGS) {
            return CHARSET_STRINGS[contentType as keyof typeof CHARSET_STRINGS];
        }
        return "0x0000";
    }

    public parseLocation(contentLocation?: string) {
        if (!contentLocation) return undefined;
        if (contentLocation.trim() in LOCATION_STRINGS) {
            return LOCATION_STRINGS[contentLocation.trim() as keyof typeof LOCATION_STRINGS];
        }
        return undefined;
    }

    public parseAccepts(accept?: string) {
        if (!accept) return [];
        return accept.split(',')
            .map(s => s.trim())
            .map(type => MIME_TYPE_STRINGS[type as keyof typeof MIME_TYPE_STRINGS])
            .filter((type): type is typeof MIME_TYPES[keyof typeof MIME_TYPES] => type !== undefined);
    }

    public parseAcceptsCharset(acceptCharset?: string) {
        if (!acceptCharset) return [];
        return acceptCharset.split(',')
            .map(s => s.trim())
            .map(type => CHARSET_STRINGS[type as keyof typeof CHARSET_STRINGS])
            .filter((type): type is typeof CHARSET_STRINGS[keyof typeof CHARSET_STRINGS] => type !== undefined);
    }

    public parseAcceptsLanguage(acceptLanguage?: string) {
        if (!acceptLanguage) return [];
        return acceptLanguage.split(',')
            .map(s => s.trim())
            .map(type => LANGUAGE_STRINGS[type as keyof typeof LANGUAGE_STRINGS])
            .filter((type): type is typeof LANGUAGE_STRINGS[keyof typeof LANGUAGE_STRINGS] => type !== undefined);
    }

    public parseChunkIndex(range?: string) {
        if (!range) return undefined;
        const matches = range.match(/^chunks=(\d+)/);
        return matches ? parseInt(matches[1]) : undefined;
    }

    public parseContent(request: any) {
        return request.data instanceof Uint8Array ? ethers.toUtf8String(request.data) : request.data;
    }

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

    private async switchNetwork(networkName: SupportedNetworks) {
        const provider = this.providerManager.getProvider(networkName);
        this.defaultSigner = this.defaultSigner.connect(provider);
        this.wttp = this.wttp.connect(this.defaultSigner);
    }

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

    public async loadSite(
        host: string,
        signer?: Signer
    ): Promise<WTTPSite> {
        const site = WTTPSite__factory.connect(host, signer || this.defaultSigner);
        return site;
    }

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

    public async executeRequest(request: any) {
        // console.log(`Executing request:`);
        // console.log(request);

        if (request.networkName && request.networkName !== this.masterNetwork) {
            // Switch networks if specified
            await this.switchNetwork(request.networkName);
        }

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
                body: request.error.message
            };
            return this.buildResponse(request, rawResponse);
        }

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
                        body: "Client Error: MIME type is required for PUT requests"
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
                        body: "Client Error: Content-Location is required for PUT requests"
                    };
                    return this.buildResponse(request, rawResponse);
                }

                const site = await this.loadSite(request.host);
                const royalty = await this.loadRoyalty(request);

                const tx = await site.connect(request.signer.connect(this.provider) || this.defaultSigner).PUT(
                    request.requestLine,
                    request.mimeType,
                    request.charset,
                    request.location,
                    request.publisher,
                    request.data,
                    { value: royalty }
                );

                const receipt = await tx.wait();
                const event = receipt?.logs?.find((e: any) => e.fragment?.name === 'PUTSuccess') as EventLog;
                rawResponse = event?.args?.putResponse;
                // console.log(rawResponse);
                // console.log(`Event args:`);
                // console.log(event?.args);
                break;
            }

            case Method.PATCH: {
                const site = await this.loadSite(request.host);
                const royalty = await this.loadRoyalty(request);
                console.log(`Request Signer: ${request.signer.connect(this.provider)}`);
                console.log(`Chunk: ${request.chunk}`);
                console.log(`Publisher: ${request.publisher}`);
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
                    body: `Client Error: Unsupported method: ${request.method}`
                };
        }

        // console.log(`Request:`);
        // console.log(request.method);

        // console.log(`Raw response:`);
        // console.log(rawResponse);

        rawResponse = rawResponse ? this.buildResponse(request, rawResponse) :
            new Response("Internal Server Error", { status: 500 })

        return rawResponse;
    }

    public buildRequest(request: RequestOptions) {
        return this.requestBuilder.build(request);
    }

    public buildResponse(request: any, rawResponse: any) {
        return this.responseBuilder.build(request, rawResponse);
    }

    public parseURL(url: string) {
        return this.urlParser.parse(url);
    }

    public async resolveHost(host: string) {
        return this.ensResolver.resolve(host);
    }

    public async getProvider(networkName: SupportedNetworks) {
        return this.providerManager.getProvider(networkName);
    }
}

export const wttp = new WTTPHandler();

