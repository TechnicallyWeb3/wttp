import { ethers } from 'hardhat';
import { WTTP, DataPointRegistry__factory, WTTPSite__factory } from '../../typechain-types';
import { RequestLine, RequestHeader, GETRequest, Method, RequestOptions } from '../../types/types';
import { CHARSET_STRINGS, DEFAULT_HEADER, LANGUAGE_STRINGS, LOCATION_STRINGS, MIME_TYPE_STRINGS, MIME_TYPES } from '../../types/constants';
import { ENSResolver, RequestBuilder, ResponseBuilder, URLParser } from '../../utils/WTTPUtils';

export class WTTPHandler {
    private wttp: WTTP;
    private defaultSigner: ethers.Signer;
    private urlParser: URLParser;
    private requestBuilder: RequestBuilder;
    private responseBuilder: ResponseBuilder;
    private ensResolver: ENSResolver;

    constructor(
        wttp: WTTP,
        signer: ethers.Signer
    ) {
        this.wttp = wttp;
        this.defaultSigner = signer;
        this.urlParser = new URLParser();
        this.requestBuilder = new RequestBuilder();
        this.responseBuilder = new ResponseBuilder();
        this.ensResolver = new ENSResolver();
    }

    async fetch(url: string, options: {
        method?: Method;
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
        signer?: ethers.Signer;
    } = {}): Promise<Response> {
        const { host, path } = this.parseURL(url);
        const request = this.buildRequest(
            {
                method: options.method || Method.GET,
                host: host,
                path: path,
                content: options.body,
                ifNoneMatch: options.headers?.['If-None-Match'],
                ifModifiedSince: options.headers?.['If-Modified-Since'],
                range: this.parseRange(options.headers?.['Range']),
                mimeType: this.parseMimeType(options.headers?.['Content-Type']),
                charset: this.parseCharset(options.headers?.['Content-Type']),
                location: this.parseLocation(options.headers?.['Content-Location']),
                publisher: options.headers?.['Publisher'] || this.defaultSigner.address,
                accepts: this.parseAccepts(options.headers?.['Accept']),
                acceptsCharset: this.parseAcceptsCharset(options.headers?.['Accept-Charset']),
                acceptsLocation: this.parseAcceptsLanguage(options.headers?.['Accept-Language']),
                chunkIndex: this.parseChunkIndex(options.headers?.['Range']),
                signer: options.signer || this.defaultSigner
            }
        );

        // console.log(request);

        return this.executeRequest(await request);
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
        contentType = contentType.includes('charset') ? contentType.split('=')[1].trim() : contentType;
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

    // // Private helper methods
    // public async prepareRequest(method: Method, url: string, options: any = {}) {
    //     const { host, path } = this.parseURL(url);
    //     const resolvedHost = await this.resolveHost(host);

    //     const requestLine: RequestLine = {
    //         protocol: "WTTP/2.0",
    //         path
    //     };

    //     switch (method) {
    //         case Method.GET: {
    //             const requestHeader: RequestHeader = {
    //                 accept: options.accepts,
    //                 acceptCharset: options.acceptsCharset,
    //                 acceptLanguage: options.acceptsLocation,
    //                 ifModifiedSince: options.ifModifiedSince || 0,
    //                 ifNoneMatch: options.ifNoneMatch || ethers.ZeroHash
    //             };

    //             const getRequest: GETRequest = {
    //                 host: resolvedHost,
    //                 rangeStart: options.range?.start || 0,
    //                 rangeEnd: options.range?.end || 0
    //             };

    //             return { method, requestLine, requestHeader, getRequest, signer: options.signer || this.defaultSigner };
    //         }

    //         case Method.HEAD:
    //         case Method.LOCATE:
    //         case Method.DELETE:
    //             return { method, host: resolvedHost, requestLine, signer: options.signer || this.defaultSigner };

    //         case Method.PUT: {
    //             const content = options.content instanceof Uint8Array
    //                 ? options.content
    //                 : ethers.toUtf8Bytes(options.content);

    //             return {
    //                 method,
    //                 host: resolvedHost,
    //                 requestLine,
    //                 mimeType: ethers.hexlify(options.mimeType || "0x7468"), // default text/html
    //                 charset: ethers.hexlify(options.charset || "0x7574"),    // default utf-8
    //                 location: ethers.hexlify(options.location || "0x0101"), // default datapoint/chunk
    //                 publisher: options.publisher || this.defaultSigner,
    //                 data: content,
    //                 signer: options.signer || this.defaultSigner
    //             };
    //         }

    //         case Method.PATCH: {
    //             const content = options.content instanceof Uint8Array
    //                 ? options.content
    //                 : ethers.toUtf8Bytes(options.content);

    //             return {
    //                 method,
    //                 host: resolvedHost,
    //                 requestLine,
    //                 data: content,
    //                 chunk: options.chunkIndex,
    //                 publisher: options.publisher || this.defaultSigner,
    //                 signer: options.signer || this.defaultSigner
    //             };
    //         }

    //         case Method.DEFINE: {
    //             return {
    //                 method,
    //                 host: resolvedHost,
    //                 requestLine,
    //                 header: options.header,
    //                 signer: options.signer || this.defaultSigner
    //             };
    //         }

    //         default: {
    //             return {
    //                 method,
    //                 host: resolvedHost,
    //                 requestLine,
    //                 error: {
    //                     code: 501,
    //                     message: `Client Error: Unsupported method: ${method}`
    //                 },
    //                 signer: options.signer || this.defaultSigner
    //             };
    //         }
    //     }
    // }

    public async loadSite(host: string, signer: ethers.Signer = this.defaultSigner) {
        return WTTPSite__factory.connect(host, signer);
    }

    public calculateDataPointAddress(request: any): string {
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
        const dprFactory = await ethers.getContractFactory("DataPointRegistry");
        const dpr = dprFactory.attach(dprAddress);

        const dataPointAddress = this.calculateDataPointAddress(request);

        // const actualDataPointAddress = await site?.LOCATE({ protocol: "WTTP/2.0", path: request.path });
        // console.log(`Request path: ${request.path}`);
        // console.log(`Data point address: ${dataPointAddress}`);
        // console.log(`Actual data point address: ${actualDataPointAddress}`);
        const royalty = await dpr.getRoyalty(dataPointAddress);
        // console.log(`Royalty: ${royalty}`);
        return royalty;
    }

    public async executeRequest(request: any) {
        // console.log(`Executing request:`);
        // console.log(request);

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

                const tx = await site.connect(request.signer || this.defaultSigner).PUT(
                    request.requestLine,
                    request.mimeType,
                    request.charset,
                    request.location,
                    request.publisher,
                    request.data,
                    { value: royalty }
                );

                const receipt = await tx.wait();
                const event = receipt.logs?.find((e: any) => e.fragment.name === 'PUTSuccess');
                rawResponse = event?.args?.putResponse;
                // console.log(rawResponse);
                // console.log(`Event args:`);
                // console.log(event?.args);
                break;
            }

            case Method.PATCH: {
                const site = await this.loadSite(request.host);
                const royalty = await this.loadRoyalty(request);
                const tx = await site.connect(request.signer || this.defaultSigner).PATCH(
                    request.requestLine,
                    request.data,
                    request.chunk,
                    request.publisher,
                    { value: royalty }
                );
                const receipt = await tx.wait();
                const event = receipt.logs?.find((e: any) => e.fragment.name === 'PATCHSuccess');
                rawResponse = event?.args?.patchResponse;
                break;
            }

            case Method.DEFINE: {
                const site = await this.loadSite(request.host);
                const tx = await site.connect(request.signer || this.defaultSigner).DEFINE(
                    request.host,
                    request.requestLine,
                    request.header
                );
                const receipt = await tx.wait();
                const event = receipt.logs?.find((e: any) => e.fragment.name === 'DEFINESuccess');
                rawResponse = event?.args?.defineResponse;
                break;
            }

            case Method.DELETE: {
                const site = await this.loadSite(request.host);
                const tx = await site.connect(request.signer || this.defaultSigner).DELETE(
                    request.host,
                    request.requestLine
                );
                const receipt = await tx.wait();
                const event = receipt.logs?.find((e: any) => e.fragment.name === 'DELETESuccess');
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
}
