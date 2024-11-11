import { ethers } from 'ethers';
import { 
    RequestLine, 
    RequestHeader, 
    GETRequest, 
    GETResponse,
    HEADResponse,
    LOCATEResponse
} from '../../types/types';
import { WTTP, WTTPBaseMethods } from '../../typechain-types';
import { MIME_TYPES, CHARSET_TYPES, LOCATION_TYPES } from '../../types/constants';

export class WTTPHandler {
    private wttpContract: WTTP;
    private signer: ethers.Signer;

    constructor(
        wttp: WTTP,
        signer: ethers.Signer
    ) {
        this.wttpContract = wttp;
        this.signer = signer;
    }

    private async getWebHost(host: ethers.Addressable): Promise<WTTPBaseMethods> {
        
        // Create a new contract instance for the WTTPBaseMethods at the given address
        const webHost = new ethers.Contract(
            host,
            [
                // Core methods needed for WTTP functionality
                "function HEAD(tuple(string protocol, string path)) view returns (tuple(tuple(string protocol, uint16 code), tuple(tuple(uint256 maxAge, uint256 sMaxage, bool noStore, bool noCache, bool immutableFlag, bool mustRevalidate, bool proxyRevalidate, uint256 staleWhileRevalidate, uint256 staleIfError, bool publicFlag, bool privateFlag) cache, uint16 methods, tuple(uint16 code, string location) redirect, bytes32 resourceAdmin) headerInfo, tuple(uint256 size, uint256 version, uint256 modifiedDate) metadata, tuple(uint256 size, bytes2 mimeType, bytes2 charset, bytes2 location) dataStructure, bytes32 etag))",
                "function LOCATE(tuple(string protocol, string path)) view returns (tuple(tuple(tuple(string protocol, uint16 code), tuple(tuple(uint256 maxAge, uint256 sMaxage, bool noStore, bool noCache, bool immutableFlag, bool mustRevalidate, bool proxyRevalidate, uint256 staleWhileRevalidate, uint256 staleIfError, bool publicFlag, bool privateFlag) cache, uint16 methods, tuple(uint16 code, string location) redirect, bytes32 resourceAdmin) headerInfo, tuple(uint256 size, uint256 version, uint256 modifiedDate) metadata, tuple(uint256 size, bytes2 mimeType, bytes2 charset, bytes2 location) dataStructure, bytes32 etag) head, bytes32[] dataPoints))",
                "function DPR_() view returns (address)",
                "function PUT(tuple(string protocol, string path), bytes2 mimeType, bytes2 charset, bytes2 location, address publisher, bytes data) payable returns (tuple(tuple(tuple(string protocol, uint16 code), tuple(tuple(uint256 maxAge, uint256 sMaxage, bool noStore, bool noCache, bool immutableFlag, bool mustRevalidate, bool proxyRevalidate, uint256 staleWhileRevalidate, uint256 staleIfError, bool publicFlag, bool privateFlag) cache, uint16 methods, tuple(uint16 code, string location) redirect, bytes32 resourceAdmin) headerInfo, tuple(uint256 size, uint256 version, uint256 modifiedDate) metadata, tuple(uint256 size, bytes2 mimeType, bytes2 charset, bytes2 location) dataStructure, bytes32 etag) head, bytes32 dataPointAddress))",
                "function PATCH(tuple(string protocol, string path), bytes data, uint256 chunk, address publisher) payable returns (tuple(tuple(tuple(string protocol, uint16 code), tuple(tuple(uint256 maxAge, uint256 sMaxage, bool noStore, bool noCache, bool immutableFlag, bool mustRevalidate, bool proxyRevalidate, uint256 staleWhileRevalidate, uint256 staleIfError, bool publicFlag, bool privateFlag) cache, uint16 methods, tuple(uint16 code, string location) redirect, bytes32 resourceAdmin) headerInfo, tuple(uint256 size, uint256 version, uint256 modifiedDate) metadata, tuple(uint256 size, bytes2 mimeType, bytes2 charset, bytes2 location) dataStructure, bytes32 etag) head, bytes32 dataPointAddress))"
            ],
            this.signer
        ) as unknown as WTTPBaseMethods;

        return webHost;
    }

    async get(host: ethers.Addressable, path: string, options: {
        range?: { start: number; end: number };
        ifNoneMatch?: string;
        ifModifiedSince?: number;
    } = {}): Promise<GETResponse> {
        const webHost = await this.getWebHost(host);
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
            host: host,
            rangeStart: options.range?.start || 0,
            rangeEnd: options.range?.end || 0
        };

        const response = await this.wttpContract.GET(
            requestLine,
            requestHeader,
            getRequest
        );

        return this.processResponse(response);
    }

    async put(
        host: ethers.Addressable,
        path: string, 
        content: string | Uint8Array,
        mimeType: keyof typeof MIME_TYPES = 'TEXT_PLAIN',
        charset: keyof typeof CHARSET_TYPES = 'UTF_8',
        signer: ethers.Signer = this.signer
    ): Promise<void> {
        const webHost = await this.getWebHost(host);
        const requestLine: RequestLine = {
            protocol: "WTTP/2.0",
            path
        };

        const contentBytes = typeof content === 'string' 
            ? ethers.toUtf8Bytes(content)
            : content;

        // Calculate royalties upfront
        const dprAddress = await webHost.DPR_();
        const dpr = new ethers.Contract(
            dprAddress,
            [
                "function DPS_() view returns (address)",
                "function getRoyalty(bytes32) view returns (uint256)"
            ],
            signer
        );

        const dpsAddress = await dpr.DPS_();
        const dps = new ethers.Contract(
            dpsAddress,
            ["function calculateAddress(tuple(tuple(bytes2 mimeType, bytes2 charset, bytes2 location) structure, bytes data)) view returns (bytes32)"],
            signer
        );

        const dataPoint = {
            structure: {
                mimeType: MIME_TYPES[mimeType],
                charset: CHARSET_TYPES[charset],
                location: LOCATION_TYPES.DATAPOINT_CHUNK
            },
            data: contentBytes
        };
        
        const dataPointAddress = await dps.calculateAddress(dataPoint);
        const royaltyAmount = await dpr.getRoyalty(dataPointAddress);

        // Always include royalty amount (will be 0 if no royalty required)
        await webHost.PUT(
            requestLine,
            MIME_TYPES[mimeType],
            CHARSET_TYPES[charset],
            LOCATION_TYPES.DATAPOINT_CHUNK,
            await this.signer.getAddress(),
            contentBytes,
            { value: royaltyAmount }
        );
    }

    async patch(
        host: ethers.Addressable,
        path: string,
        content: string | Uint8Array,
        chunkIndex: number
    ): Promise<void> {
        const webHost = await this.getWebHost(host);
        const requestLine: RequestLine = {
            protocol: "WTTP/2.0",
            path
        };

        const contentBytes = typeof content === 'string' 
            ? ethers.toUtf8Bytes(content)
            : content;

        // Get existing datapoint structure
        const locateResponse = await this.locate(path);
        
        // Calculate royalties upfront
        const dprAddress = await webHost.DPR_();
        const dpr = new ethers.Contract(
            dprAddress,
            ['function calculateAddress(tuple(tuple(bytes2 mimeType, bytes2 charset, bytes2 location) structure, bytes data) memory _dataPoint) public view returns (bytes32)', 'function getRoyalty(bytes32) public view returns (uint256)'],
            this.signer
        );
        
        const dataPoint = {
            structure: {
                mimeType: locateResponse.head.dataStructure.mimeType,
                charset: locateResponse.head.dataStructure.charset,
                location: locateResponse.head.dataStructure.location
            },
            data: contentBytes
        };
        
        const dataPointAddress = await dpr.calculateAddress(dataPoint);
        const royaltyAmount = await dpr.getRoyalty(dataPointAddress);

        // Always include royalty amount
        await webHost.PATCH(
            requestLine,
            contentBytes,
            chunkIndex,
            await this.signer.getAddress(),
            { value: royaltyAmount }
        );
    }

    
    async head(host: ethers.Addressable, path: string): Promise<HEADResponse> {
        const webHost = await this.getWebHost(host);
        const requestLine: RequestLine = {
            protocol: "WTTP/2.0",
            path
        };
        
        const response = await webHost.HEAD(requestLine);
        return this.processHeadResponse(response);
    }

    
    async locate(host: ethers.Addressable, path: string): Promise<LOCATEResponse> {
        const webHost = await this.getWebHost(host);
        const requestLine: RequestLine = {
            protocol: "WTTP/2.0",
            path
        };
        
        return await webHost.LOCATE(requestLine);
    }

    private decodeContent(content: string | BytesLike | Uint8Array | Buffer, charset: string): string {
        // console.log('Decoding content type:', typeof content);
        // console.log('With charset:', charset);
        
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
                // console.log('Falling back to default UTF-8 decoding');
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

        // console.log('Response Code:', head.responseLine.code);
        // console.log('DataStructure:', head.dataStructure);

        if (head.responseLine.code === 200 || head.responseLine.code === 206) {
            const { mimeType, charset } = head.dataStructure;

            // console.log('Charset:', charset);
            // console.log('MIME Type:', mimeType);
            // console.log('Raw Body:', bodyHex);

            const isTextBased = [
                MIME_TYPES.TEXT_PLAIN,
                MIME_TYPES.TEXT_HTML,
                MIME_TYPES.TEXT_CSS,
                MIME_TYPES.TEXT_JAVASCRIPT,
                MIME_TYPES.TEXT_XML,
                MIME_TYPES.APPLICATION_JSON,
                MIME_TYPES.APPLICATION_XML,
            ].includes(mimeType);

            // console.log('Is Text Based:', isTextBased);

            if (isTextBased && bodyHex) {
                const decodedBody = this.decodeContent(bodyHex, charset);
                // console.log('Decoded Body:', decodedBody);
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
} 