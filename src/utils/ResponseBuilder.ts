import { HEADResponse, Method } from '../types/types';
import { HTTP_STATUS_STRINGS, HTTP_STATUS } from '../types/constants';
import { toUtf8String } from 'ethers';

export class ResponseBuilder {
    private buildHeaders(headResponse: HEADResponse): Headers {
        const headers = new Headers();

        // console.log(headResponse);

        // Content Type and Charset
        if (headResponse.dataStructure.mimeType && headResponse.dataStructure.charset) {
            headers.set('Content-Type', 
                `${headResponse.dataStructure.mimeType}; charset=${headResponse.dataStructure.charset}`);
        }

        // Content Length
        if (headResponse.metadata.size > 0) {
            headers.set('Content-Length', headResponse.metadata.size.toString());
        }

        // ETag
        if (headResponse.etag && headResponse.etag !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
            headers.set('ETag', headResponse.etag);
        }

        // Last Modified
        if (headResponse.metadata.modifiedDate > 0) {
            headers.set('Last-Modified', new Date(Number(headResponse.metadata.modifiedDate) * 1000).toUTCString());
        }

        // Cache Control
        const cacheDirectives: string[] = [];
        const cache = headResponse.headerInfo.cache;
        
        if (cache.maxAge > 0) cacheDirectives.push(`max-age=${cache.maxAge}`);
        if (cache.sMaxage > 0) cacheDirectives.push(`s-maxage=${cache.sMaxage}`);
        if (cache.noStore) cacheDirectives.push('no-store');
        if (cache.noCache) cacheDirectives.push('no-cache');
        if (cache.immutableFlag) cacheDirectives.push('immutable');
        if (cache.mustRevalidate) cacheDirectives.push('must-revalidate');
        if (cache.proxyRevalidate) cacheDirectives.push('proxy-revalidate');
        if (cache.staleWhileRevalidate > 0) cacheDirectives.push(`stale-while-revalidate=${cache.staleWhileRevalidate}`);
        if (cache.staleIfError > 0) cacheDirectives.push(`stale-if-error=${cache.staleIfError}`);
        if (cache.publicFlag) cacheDirectives.push('public');
        if (cache.privateFlag) cacheDirectives.push('private');

        if (cacheDirectives.length > 0) {
            headers.set('Cache-Control', cacheDirectives.join(', '));
        }

        // Allow header (based on methods bitmask)
        const allowedMethods: string[] = [];
        const methodsBitmask = Number(headResponse.headerInfo.methods);
        
        if (methodsBitmask & (1 << 0)) allowedMethods.push('GET');
        if (methodsBitmask & (1 << 1)) allowedMethods.push('POST');
        if (methodsBitmask & (1 << 2)) allowedMethods.push('PUT');
        if (methodsBitmask & (1 << 3)) allowedMethods.push('DELETE');
        if (methodsBitmask & (1 << 4)) allowedMethods.push('PATCH');
        if (methodsBitmask & (1 << 5)) allowedMethods.push('HEAD');
        if (methodsBitmask & (1 << 6)) allowedMethods.push('OPTIONS');
        if (methodsBitmask & (1 << 7)) allowedMethods.push('CONNECT');
        if (methodsBitmask & (1 << 8)) allowedMethods.push('TRACE');
        if (methodsBitmask & (1 << 9)) allowedMethods.push('LOCATE');
        if (methodsBitmask & (1 << 10)) allowedMethods.push('DEFINE');

        if (allowedMethods.length > 0) {
            headers.set('Allow', allowedMethods.join(', '));
        }

        // Location header for redirects
        if (headResponse.headerInfo.redirect.code > 0) {
            headers.set('Location', headResponse.headerInfo.redirect.location);
        }

        return headers;
    }

    build(request: any, rawResponse: any): Response {
        const { head } = rawResponse;
        let body = rawResponse.body;

        // console.log(body);
        // Use the new buildHeaders method
        const headers = head ? this.buildHeaders(head) : new Headers();
        let statusCode = head ? head.responseLine.code : 500;

        switch (request.method) {
            case Method.GET:
                body = body ? toUtf8String(body) : ''
                break;

            case Method.LOCATE:
                body = {
                    "Registry-Address": rawResponse.dprAddress,
                    "DataPoint-Addresses": rawResponse.dataPoints
                }
            case Method.PUT:
            case Method.PATCH:
                // console.log(`DataPoint Address: ${rawResponse.dataPointAddress}`);
                headers.set('Registry-Address', rawResponse.dprAddress);
                headers.set('ETag', rawResponse.dataPointAddress);
                body = request.data ? toUtf8String(request.data) : ''
                break;
            default:
                body = "Method Not Allowed";
                statusCode = 405;
        } 

        return new Response(
            body,
            {
                status: statusCode,
                statusText: this.getStatusText(statusCode),
                headers: headers
            }
        );
    }

    private getStatusText(code: number): string {
        // Check if the code exists in our status codes
        if (code in HTTP_STATUS) {
            return HTTP_STATUS_STRINGS[code as keyof typeof HTTP_STATUS_STRINGS];
        }
        return 'Unknown Status';
    }
} 