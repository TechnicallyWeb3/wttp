import { ethers } from 'ethers';
import { WTTP, WTTPBaseMethods__factory, DataPointRegistry__factory } from '../../typechain-types';   
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
        const request = await this.prepareRequest(
            options.method || Method.GET,
            url,
            {
                content: options.body,
                ifNoneMatch: options.headers?.['If-None-Match'],
                ifModifiedSince: options.headers?.['If-Modified-Since'],
                range: this.parseRange(options.headers?.['Range']),
                mimeType: this.parseMimeType(options.headers?.['Content-Type']),
                charset: this.parseCharset(options.headers?.['Content-Type']),
                location: this.parseLocation(options.headers?.['Content-Location']),
                publisher: options.headers?.['Publisher'],
                accepts: this.parseAccepts(options.headers?.['Accept']),
                acceptsCharset: this.parseAcceptsCharset(options.headers?.['Accept-Charset']),
                acceptsLocation: this.parseAcceptsLanguage(options.headers?.['Accept-Language']),
                chunkIndex: this.parseChunkIndex(options.headers?.['Range'])
            }, 
            options.signer || this.defaultSigner
        );

        return this.executeRequest(request);
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
        if (contentType.trim() in MIME_TYPE_STRINGS) {
            return MIME_TYPE_STRINGS[contentType.trim() as keyof typeof MIME_TYPE_STRINGS];
        }
        return undefined;
    }

    public parseCharset(contentType?: string) {
        if (!contentType) return "0x0000";
        if (contentType.trim() in CHARSET_STRINGS) {
            return CHARSET_STRINGS[contentType.trim() as keyof typeof CHARSET_STRINGS];
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

    // Private helper methods
    public async prepareRequest(method: Method, url: string, options: any = {}) {
        const { host, path } = await this.parseURL(url);
        const resolvedHost = await this.resolveHost(host);

        const requestLine: RequestLine = {
            protocol: "WTTP/2.0",
            path
        };

        switch (method) {
            case Method.GET: {
                const requestHeader: RequestHeader = {
                    accept: options.accepts,
                    acceptCharset: options.acceptsCharset,
                    acceptLanguage: options.acceptsLocation,
                    ifModifiedSince: options.ifModifiedSince || 0,
                    ifNoneMatch: options.ifNoneMatch || ethers.ZeroHash
                };

                const getRequest: GETRequest = {
                    host: resolvedHost,
                    rangeStart: options.range?.start || 0,
                    rangeEnd: options.range?.end || 0
                };

                return { method, requestLine, requestHeader, getRequest };
            }

            case Method.HEAD:
            case Method.LOCATE:
            case Method.DELETE:
                return { method, host: resolvedHost, requestLine };

            case Method.PUT: {
                const content = options.content instanceof Uint8Array
                    ? options.content
                    : ethers.toUtf8Bytes(options.content);

                return {
                    method,
                    host: resolvedHost,
                    requestLine,
                    mimeType: ethers.hexlify(options.mimeType || "0x7468"), // default text/html
                    charset: ethers.hexlify(options.charset || "0x7574"),    // default utf-8
                    location: ethers.hexlify(options.location || "0x0101"), // default datapoint/chunk
                    publisher: options.publisher || this.defaultSigner,
                    data: content
                };
            }

            case Method.PATCH: {
                const content = options.content instanceof Uint8Array
                    ? options.content
                    : ethers.toUtf8Bytes(options.content);

                return {
                    method,
                    host: resolvedHost,
                    requestLine,
                    data: content,
                    chunk: options.chunkIndex,
                    publisher: options.publisher || await this.defaultSigner.getAddress()
                };
            }

            case Method.DEFINE: {
                return {
                    method,
                    host: resolvedHost,
                    requestLine,
                    header: options.header
                };
            }

            default: {
                return {
                    method,
                    host: resolvedHost,
                    requestLine,
                    error: {
                        code: 501,
                        message: `Client Error: Unsupported method: ${method}`
                    }
                };
            }
        }
    }

    public async loadSite(host: string, signer: ethers.Signer = this.defaultSigner) {
        return WTTPBaseMethods__factory.connect(host, signer);
    }

    public calculateDataPointAddress(request: RequestOptions): string {
        // Convert content to bytes if it's a string
        const content = request.content instanceof Uint8Array
            ? request.content
            : ethers.toUtf8Bytes(request.content || '');
    
        // Get the hex values for mime type, charset, and location
        const mimeType = ethers.hexlify(request.mimeType || "0x7468"); // default text/html
        const charset = ethers.hexlify(request.charset || "0x7574");   // default utf-8
        const location = ethers.hexlify(request.location || "0x0101"); // default datapoint/chunk
    
        // Pack and hash the values in the same order as the smart contract
        const packed = ethers.concat([
            ethers.toBeArray(mimeType).slice(-2),  // bytes2
            ethers.toBeArray(charset).slice(-2),   // bytes2
            ethers.toBeArray(location).slice(-2),  // bytes2
            content
        ]);
    
        return ethers.keccak256(packed);
    }

    public async loadRoyalty(request: RequestOptions) {
        const site = await this.loadSite(request.host);
        const dprAddress = await site.DPR_();
        
        // Connect to DPR using the factory
        const dpr = DataPointRegistry__factory.connect(dprAddress, this.defaultSigner);
        
        const dataPointAddress = this.calculateDataPointAddress(request);
        const royalty = await dpr.getRoyalty(dataPointAddress);
        console.log(`Royalty: ${royalty}`);
        return royalty;
    }

    public async executeRequest(request: any) {
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
            return this.buildResponse(request.method, rawResponse);
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
                const site = await this.loadSite(request.host);
                const royalty = await this.loadRoyalty(request);
                const tx = await site.PUT(
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
                break;
            }

            case Method.PATCH: {
                const site = await this.loadSite(request.host);
                const royalty = await this.loadRoyalty(request);
                const tx = await site.PATCH(
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
                const tx = await site.DEFINE(
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
                const tx = await site.DELETE(
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

        return rawResponse ? this.buildResponse(request.method, rawResponse) : 
               new Response("Internal Server Error", { status: 500 });
    }

    public buildRequest(method: Method, request: RequestOptions) {
        return this.requestBuilder.build(method, request);
    }

    public buildResponse(method: Method, rawResponse: any) {
        return this.responseBuilder.build(method, rawResponse);
    }

    public parseURL(url: string) {
        return this.urlParser.parse(url);
    }

    public async resolveHost(host: string) {
        return this.ensResolver.resolve(host);
    }
}
