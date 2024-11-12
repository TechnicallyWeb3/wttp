import { Method } from '../types/types';
import { HTTP_STATUS_STRINGS, HTTP_STATUS } from '../types/constants';
import { Headers } from 'undici-types';

export class ResponseBuilder {
    build(method: Method, rawResponse: any): Response {
        const { head, body } = rawResponse;
        
        // Convert raw header info to Headers object
        const headers = new Headers(head.headerInfo);

        return new Response(body, {
            status: head.responseLine.code,
            statusText: this.getStatusText(head.responseLine.code),
            headers: headers
        });
    }

    private getStatusText(code: number): string {
        // Check if the code exists in our status codes
        if (code in HTTP_STATUS) {
            return HTTP_STATUS_STRINGS[code as keyof typeof HTTP_STATUS_STRINGS];
        }
        return 'Unknown Status';
    }
} 