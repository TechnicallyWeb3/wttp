import { SUPPORTED_PROTOCOLS, SupportedNetworks } from '../types/constants';
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
        const urlParts = cleanUrl.split('?');
        const queryParams = urlParts[1] ? urlParts[1].split('&') : [];
        const [hostParts, ...pathParts] = urlParts[0].split('/');
        let host = hostParts;
        let networkName: SupportedNetworks | undefined = undefined;

        if (hostParts.includes(':')) {
            const splitHost = hostParts.split(':');
            networkName = splitHost[1] as SupportedNetworks;
            host = splitHost[0];
        }
        const path = pathParts.length > 0 ? '/' + pathParts.join('/') : '/';
        
        return { host, path, queryParams, networkName };
    }
} 