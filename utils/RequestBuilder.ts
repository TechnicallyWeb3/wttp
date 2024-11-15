import { ethers } from 'ethers';
import { 
    Method, 
    RequestLine, 
    RequestHeader, 
    GETRequest,
    RequestOptions 
} from '../types/types';

export class RequestBuilder {

    build(method: Method, options: RequestOptions) {
        const requestLine: RequestLine = {
            protocol: "WTTP/2.0",
            path: options.path
        };

        switch (method) {
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

                return { method, requestLine, requestHeader, getRequest };
            }

            case Method.HEAD:
            case Method.LOCATE:
            case Method.DELETE:
                return { method, host: options.host, requestLine };

            case Method.PUT: {
                const content = options.content instanceof Uint8Array
                    ? options.content
                    : ethers.toUtf8Bytes(options.content || '');

                return {
                    method,
                    host: options.host,
                    requestLine,
                    mimeType: ethers.hexlify(options.mimeType || "0x7468"), // default text/html
                    charset: ethers.hexlify(options.charset || "0x7574"),    // default utf-8
                    location: ethers.hexlify(options.location || "0x0101"), // default datapoint/chunk
                    publisher: options.publisher,
                    data: content
                };
            }

            case Method.PATCH: {
                const content = options.content instanceof Uint8Array
                    ? options.content
                    : ethers.toUtf8Bytes(options.content || '');

                return {
                    method,
                    host: options.host,
                    requestLine,
                    data: content,
                    chunk: options.chunkIndex,
                    publisher: options.publisher
                };
            }

            case Method.DEFINE: {
                return {
                    method,
                    host: options.host,
                    requestLine,
                    header: options.header
                };
            }

            default: {
                return {
                    method,
                    host: options.host,
                    requestLine,
                    error: {
                        code: 501,
                        message: `Client Error: Unsupported method: ${method}`
                    }
                };
            }
        }
    }
} 