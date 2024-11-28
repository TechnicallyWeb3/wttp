import { ethers } from 'ethers';
import { 
    Method, 
    RequestLine, 
    RequestHeader, 
    GETRequest,
    RequestOptions 
} from '../types/types';

export class RequestBuilder {
    async build(options: RequestOptions) {
        const requestLine: RequestLine = {
            protocol: "WTTP/2.0",
            path: options.path
        };

        switch (options.method) {
            case Method.GET: {
                const requestHeader: RequestHeader = {
                    accept: options.accepts || [],
                    acceptCharset: options.acceptsCharset || [],
                    acceptLanguage: options.acceptsLocation || [],
                    ifModifiedSince: options.ifModifiedSince || 0,
                    ifNoneMatch: options.ifNoneMatch || ethers.ZeroHash
                };

                const getRequest: GETRequest = {
                    host: options.host,
                    rangeStart: options.range?.start || 0,
                    rangeEnd: options.range?.end || 0
                };

                return { method: options.method, requestLine, requestHeader, getRequest, signer: options.signer };
            }

            case Method.HEAD:
            case Method.LOCATE:
            case Method.DELETE:
                return { method: options.method, host: options.host, requestLine, signer: options.signer };

            case Method.PUT: {

                if (!options.content) {
                    return {
                        method: options.method,
                        host: options.host,
                        requestLine,
                        error: {
                            code: 400,
                            message: 'Client Error: Content is required for PUT requests'
                        }
                    };
                }
                const content = options.content instanceof Uint8Array
                    ? options.content
                    : ethers.toUtf8Bytes(options.content);

                if (!options.mimeType) {
                    return {
                        method: options.method,
                        host: options.host,
                        requestLine,
                        error: {
                            code: 400,
                            message: 'Client Error: MIME type is required for PUT requests'
                        }
                    };
                }

                if (!options.location) {
                    return {
                        method: options.method,
                        host: options.host,
                        requestLine,
                        error: {
                            code: 400,
                            message: 'Client Error: Content-Location is required for PUT requests'
                        }
                    };
                }

                return {
                    method: options.method,
                    host: options.host,
                    requestLine,
                    mimeType: ethers.hexlify(options.mimeType),
                    charset: ethers.hexlify(options.charset || "0x0000"),
                    location: ethers.hexlify(options.location),
                    publisher: options.publisher,
                    data: content,
                    signer: options.signer
                };
            }

            case Method.PATCH: {

                if (!options.content) {
                    return {
                        method: options.method,
                        host: options.host,
                        requestLine,
                        error: {
                            code: 400,
                            message: 'Client Error: Content is required for PATCH requests'
                        }
                    };
                }

                const content = options.content instanceof Uint8Array
                    ? options.content
                    : ethers.toUtf8Bytes(options.content || '');

                if (!options.mimeType) {
                    return {
                        method: options.method,
                        host: options.host,
                        requestLine,
                        error: {
                            code: 400,
                            message: 'Client Error: MIME type is required for PATCH requests'
                        }
                    };
                }

                if (!options.location) {
                    return {
                        method: options.method,
                        host: options.host,
                        requestLine,
                        error: {
                            code: 400,
                            message: 'Client Error: Content-Location is required for PATCH requests'
                        }
                    };
                }

                return {
                    method: options.method,
                    host: options.host,
                    requestLine,
                    mimeType: ethers.hexlify(options.mimeType),
                    charset: ethers.hexlify(options.charset || "0x0000"),
                    location: ethers.hexlify(options.location),
                    data: content,
                    chunk: options.chunkIndex,
                    publisher: options.publisher,
                    signer: options.signer
                };
            }

            case Method.DEFINE: {
                if (!options.header) {
                    return {
                        method: options.method,
                        host: options.host,
                        requestLine,
                        error: {
                            code: 400,
                            message: 'Client Error: Header is required for DEFINE requests'
                        }
                    };
                }
                return {
                    method: options.method,
                    host: options.host,
                    requestLine,
                    header: options.header,
                    signer: options.signer
                };
            }

            default: {
                return {
                    method: options.method,
                    host: options.host,
                    requestLine,
                    error: {
                        code: 501,
                        message: `Request Error: Unsupported method: ${options.method}`
                    },
                    signer: options.signer
                };
            }
        }
    }
} 