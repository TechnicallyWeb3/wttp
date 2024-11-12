import { SUPPORTED_PROTOCOLS } from '../types/constants';
import { ParsedURL } from '../types/types';

export class URLParser {

    parse(url: string): ParsedURL {
        
        // Remove protocol if present
        const hasProtocol = SUPPORTED_PROTOCOLS.some(protocol => url.startsWith(protocol));
        const cleanUrl = hasProtocol 
            ? url.replace(new RegExp(`^(${SUPPORTED_PROTOCOLS.join('|')})`), '')
            : url;
        
        // Split into host and path
        const [host, ...pathParts] = cleanUrl.split('/');
        const path = pathParts.length > 0 ? '/' + pathParts.join('/') : '/';
        
        return { host, path };
    }
} 