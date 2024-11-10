import { ethers } from 'ethers';
import { 
    RequestLine, 
    RequestHeader, 
    GETRequest, 
    GETResponse,
    HeaderInfo
} from '../../types/types';
import { WTTP } from '../../typechain-types';
import { MIME_TYPES, CHARSET_TYPES, LOCATION_TYPES } from '../../types/constants';

export class WTTPHandler {
    private wttp: WTTP;
    private contract: ethers.Contract;
    private signer: ethers.Signer;

    constructor(
        wttp: WTTP,
        contractAddress: string, 
        abi: ethers.InterfaceAbi,
        signer: ethers.Signer
    ) {
        this.wttp = wttp;
        this.contract = new ethers.Contract(contractAddress, abi, signer);
        this.signer = signer;
    }

    async get(path: string, options: {
        range?: { start: number; end: number };
        ifNoneMatch?: string;
        ifModifiedSince?: number;
    } = {}): Promise<GETResponse> {
        const requestLine: RequestLine = {
            protocol: "WTTP/2.0",
            path
        };

        const requestHeader: RequestHeader = {
            accept: [],
            acceptCharset: [],
            acceptLanguage: [],
            ifModifiedSince: options.ifModifiedSince || 0,
            ifNoneMatch: options.ifNoneMatch || ethers.ZeroHash
        };

        const getRequest: GETRequest = {
            host: await this.contract.getAddress(),
            rangeStart: options.range?.start || 0,
            rangeEnd: options.range?.end || 0
        };

        const response = await this.wttp.GET(
            requestLine,
            requestHeader,
            getRequest
        );

        return this.processResponse(response);
    }

    async put(
        path: string, 
        content: string | Uint8Array,
        mimeType: keyof typeof MIME_TYPES = 'TEXT_PLAIN',
        charset: keyof typeof CHARSET_TYPES = 'UTF_8'
    ): Promise<void> {
        const requestLine: RequestLine = {
            protocol: "WTTP/2.0",
            path
        };

        const contentBytes = typeof content === 'string' 
            ? ethers.toUtf8Bytes(content)
            : content;

        await this.contract.PUT(
            requestLine,
            MIME_TYPES[mimeType],
            CHARSET_TYPES[charset],
            LOCATION_TYPES.DATAPOINT_CHUNK,
            await this.signer.getAddress(),
            contentBytes
        );
    }

    async head(path: string): Promise<HEADResponse> {
        const requestLine: RequestLine = {
            protocol: "WTTP/2.0",
            path
        };
        
        const response = await this.contract.HEAD(requestLine);
        return this.processHeadResponse(response);
    }

    async patch(
        path: string,
        content: string | Uint8Array,
        chunkIndex: number
    ): Promise<void> {
        const requestLine: RequestLine = {
            protocol: "WTTP/2.0",
            path
        };

        const contentBytes = typeof content === 'string' 
            ? ethers.toUtf8Bytes(content)
            : content;

        await this.contract.PATCH(
            requestLine,
            contentBytes,
            chunkIndex,
            await this.signer.getAddress()
        );
    }

    private decodeContent(content: string | BytesLike | Uint8Array | Buffer, charset: string): string {
        console.log('Decoding content type:', typeof content);
        console.log('With charset:', charset);
        
        switch (charset) {
            case CHARSET_TYPES.UTF_8:
            case CHARSET_TYPES.UTF_16:
            case CHARSET_TYPES.UTF_32:
            case CHARSET_TYPES.UTF_32BE:
            case CHARSET_TYPES.UTF_7:
            case CHARSET_TYPES.ASCII:
            case CHARSET_TYPES.ISO_8859_1:
            case CHARSET_TYPES.LATIN1:
            case CHARSET_TYPES.UCS_2:
                return ethers.toUtf8String(content);
            
            case CHARSET_TYPES.BASE64:
                return Buffer.from(content, 'base64').toString('utf8');
            
            case CHARSET_TYPES.BASE64URL:
                const base64 = content.toString().replace(/-/g, '+').replace(/_/g, '/');
                return Buffer.from(base64, 'base64').toString('utf8');
            
            case CHARSET_TYPES.HEX:
                return ethers.toUtf8String(ethers.getBytes(content));
            
            default:
                console.log('Falling back to default UTF-8 decoding');
                return ethers.toUtf8String(content);
        }
    }

    private processResponse(response: any): GETResponse {
        const [headArray, bodyHex] = [response['0'], response['1']];
        
        const head: HEADResponse = {
            responseLine: {
                protocol: headArray[0][0],
                code: Number(headArray[0][1])
            },
            headerInfo: {
                cache: headArray[1][0],
                methods: Number(headArray[1][1]),
                redirect: headArray[1][2],
                resourceAdmin: headArray[1][3]
            },
            metadata: {
                size: Number(headArray[2][0]),
                version: Number(headArray[2][1]),
                modifiedDate: Number(headArray[2][2])
            },
            dataStructure: {
                size: Number(headArray[3][0]),
                mimeType: headArray[3][1],
                charset: headArray[3][2],
                location: headArray[3][3]
            },
            etag: headArray[4]
        };

        console.log('Response Code:', head.responseLine.code);
        console.log('DataStructure:', head.dataStructure);

        if (head.responseLine.code === 200 || head.responseLine.code === 206) {
            const { mimeType, charset } = head.dataStructure;

            console.log('Charset:', charset);
            console.log('MIME Type:', mimeType);
            console.log('Raw Body:', bodyHex);

            const isTextBased = [
                MIME_TYPES.TEXT_PLAIN,
                MIME_TYPES.TEXT_HTML,
                MIME_TYPES.TEXT_CSS,
                MIME_TYPES.TEXT_JAVASCRIPT,
                MIME_TYPES.TEXT_XML,
                MIME_TYPES.APPLICATION_JSON,
                MIME_TYPES.APPLICATION_XML,
            ].includes(mimeType);

            console.log('Is Text Based:', isTextBased);

            if (isTextBased && bodyHex) {
                const decodedBody = this.decodeContent(bodyHex, charset);
                console.log('Decoded Body:', decodedBody);
                return {
                    head,
                    body: decodedBody
                };
            }
        }
        return {
            head,
            body: bodyHex
        };
    }

    private processHeadResponse(response: any): HEADResponse {
        // Similar structure to processResponse but only returns the head portion
        const headArray = response;
        return {
            responseLine: {
                protocol: headArray[0][0],
                code: Number(headArray[0][1])
            },
            headerInfo: {
                cache: headArray[1][0],
                methods: Number(headArray[1][1]),
                redirect: headArray[1][2],
                resourceAdmin: headArray[1][3]
            },
            metadata: {
                size: Number(headArray[2][0]),
                version: Number(headArray[2][1]),
                modifiedDate: Number(headArray[2][2])
            },
            dataStructure: {
                size: Number(headArray[3][0]),
                mimeType: headArray[3][1],
                charset: headArray[3][2],
                location: headArray[3][3]
            },
            etag: headArray[4]
        };
    }

    private validateResponse(response: any): void {
        if (!response || !response['0'] || !response['0'][0]) {
            throw new Error('Invalid response structure');
        }

        const code = Number(response['0'][0][1]);
        if (code >= 400) {
            throw new Error(`HTTP Error ${code}`);
        }
    }

    async getRange(
        path: string, 
        start: number, 
        end: number
    ): Promise<GETResponse> {
        return this.get(path, {
            range: { start, end }
        });
    }

    async locate(path: string): Promise<LOCATEResponse> {
        const requestLine: RequestLine = {
            protocol: "WTTP/2.0",
            path
        };
        
        return await this.contract.LOCATE(requestLine);
    }
} 