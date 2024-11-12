import { ethers } from 'ethers';
import { WTTP } from '../../typechain-types';
import { URLParser, RequestBuilder, ENSResolver, ResponseBuilder } from '../../utils';
import { RequestLine, RequestHeader, GETRequest, HEADResponse, GETResponse, LOCATEResponse, Method } from '../../types/types';
import { CHARSET_STRINGS, DEFAULT_HEADER, LANGUAGE_STRINGS, LOCATION_STRINGS, MIME_TYPE_STRINGS, MIME_TYPES } from '../../types/constants';
import { HEADResponseStructOutput } from '../../typechain-types/contracts/WTTP';

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
    } = {}): Promise<Response> {
        const request = await this.prepareRequest(
            options.method || Method.GET,
            await this.parseURL(url), // breaks the url into host and path
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
            }
        );

        return this.executeRequest(request);
    }

    // Helper methods for parsing headers
    private parseRange(range?: string) {
        if (!range) return undefined;
        const match = range.match(/bytes=(\d+)-(\d+)?/);
        if (!match) return undefined;
        return {
            start: parseInt(match[1]),
            end: match[2] ? parseInt(match[2]) : 0
        };
    }

    private parseMimeType(contentType?: string) {
        if (!contentType) return undefined;
        if (contentType.trim() in MIME_TYPE_STRINGS) {
            return MIME_TYPE_STRINGS[contentType.trim() as keyof typeof MIME_TYPE_STRINGS];
        }
        return undefined;
    }

    private parseCharset(contentType?: string) {
        if (!contentType) return "0x0000";
        if (contentType.trim() in CHARSET_STRINGS) {
            return CHARSET_STRINGS[contentType.trim() as keyof typeof CHARSET_STRINGS];
        }
        return "0x0000";
    }

    private parseLocation(contentLocation?: string) {
        if (!contentLocation) return undefined;
        if (contentLocation.trim() in LOCATION_STRINGS) {
            return LOCATION_STRINGS[contentLocation.trim() as keyof typeof LOCATION_STRINGS];
        }
        return undefined;
    }

    private parseAccepts(accept?: string) {
        if (!accept) return [];
        return accept.split(',')
            .map(s => s.trim())
            .map(type => MIME_TYPE_STRINGS[type as keyof typeof MIME_TYPE_STRINGS])
            .filter((type): type is typeof MIME_TYPES[keyof typeof MIME_TYPES] => type !== undefined);
    }

    private parseAcceptsCharset(acceptCharset?: string) {
        if (!acceptCharset) return [];
        return acceptCharset.split(',')
            .map(s => s.trim())
            .map(type => CHARSET_STRINGS[type as keyof typeof CHARSET_STRINGS])
            .filter((type): type is typeof CHARSET_STRINGS[keyof typeof CHARSET_STRINGS] => type !== undefined);
    }

    private parseAcceptsLanguage(acceptLanguage?: string) {
        if (!acceptLanguage) return [];
        return acceptLanguage.split(',')
            .map(s => s.trim())
            .map(type => LANGUAGE_STRINGS[type as keyof typeof LANGUAGE_STRINGS])
            .filter((type): type is typeof LANGUAGE_STRINGS[keyof typeof LANGUAGE_STRINGS] => type !== undefined);
    }

    private parseChunkIndex(range?: string) {
        return range ? parseInt(range.split('-')[0]) : undefined;
    }

    // Private helper methods
    private async prepareRequest(method: Method, url: string, options: any = {}) {
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
                    publisher: options.publisher || await this.defaultSigner.getAddress(),
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

    private async executeRequest(request: any) {
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
        }

        switch (request.method) {
            case Method.GET:
                rawResponse = await this.wttp.GET(
                    request.requestLine,
                    request.requestHeader,
                    request.getRequest
                );

            case Method.HEAD:
                rawResponse = await this.wttp.HEAD(
                    request.host,
                    request.requestLine
                );

            case Method.LOCATE:
                rawResponse = await this.wttp.LOCATE(
                    request.host,
                    request.requestLine
                );

            case Method.PUT:
                rawResponse = await this.wttp.PUT(
                    request.host,
                    request.requestLine,
                    request.mimeType,
                    request.charset,
                    request.location,
                    request.publisher,
                    request.data,
                    { value: 0 } // Add payment options if needed
                );

            case Method.PATCH:
                rawResponse = await this.wttp.PATCH(
                    request.host,
                    request.requestLine,
                    request.data,
                    request.chunk,
                    request.publisher,
                    { value: 0 } // Add payment options if needed
                );

            case Method.DEFINE:
                rawResponse = await this.wttp.DEFINE(
                    request.host,
                    request.requestLine,
                    request.header
                );

            case Method.DELETE:
                rawResponse = await this.wttp.DELETE(
                    request.host,
                    request.requestLine
                );

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

        return this.buildResponse(request.method, rawResponse);
    }

    private buildRequest(request: any) {
        return this.requestBuilder.build(request.method, request);
    }

    private buildResponse(method: Method, rawResponse: any) {
        return this.responseBuilder.build(method, rawResponse);
    }

    private async parseURL(url: string) {
        return this.urlParser.parse(url);
    }

    private async resolveHost(host: string) {
        return this.ensResolver.resolve(host);
    }
}
