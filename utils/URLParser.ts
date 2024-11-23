import { SUPPORTED_PROTOCOLS } from '../types/constants';
import { ParsedURL } from '../types/types';

export class URLParser {

    parse(url: string): ParsedURL {

        const supportedRegex = `^(${SUPPORTED_PROTOCOLS.join('|')}):\/\/`;
        
        // Remove protocol if present and ensure we have a string
        const hasProtocol = new RegExp(supportedRegex, 'i').test(url);
        const cleanUrl = hasProtocol 
            ? url.replace(new RegExp(supportedRegex, 'i'), '')
            : url;
        
        // Add logging to debug the value
        // console.log('cleanUrl:', cleanUrl, typeof cleanUrl);
        
        // Ensure we have a string and split into host and path
        if (typeof cleanUrl !== 'string') {
            throw new Error('URL parsing failed: Invalid URL format');
        }
        
        const [hostParts, ...pathParts] = cleanUrl.split('/');
        let host = hostParts;
        let networkName = undefined;
        
        if (hostParts.includes(':')) {
            const splitHost = hostParts.split(':');
            networkName = splitHost[1];
            host = splitHost[0];
        }
        const path = pathParts.length > 0 ? '/' + pathParts.join('/') : '/';
        
        return { host, path, networkName };
    }
} 