import { BytesLike, Signer } from "ethers";
import { LOCATEResponseStructOutput } from "../../typechain-types/contracts/WebContract.sol/WTTPSite";
import { SupportedNetworks } from "./constants";

export enum Method {
    GET = 'GET',
    HEAD = 'HEAD',
    PUT = 'PUT',
    PATCH = 'PATCH',
    DELETE = 'DELETE',
    LOCATE = 'LOCATE',
    DEFINE = 'DEFINE'
}

export interface RequestLine {
    protocol: string;
    path: string;
}

export interface CacheControl {
    maxAge: number;
    sMaxage: number;
    noStore: boolean;
    noCache: boolean;
    immutableFlag: boolean;
    mustRevalidate: boolean;
    proxyRevalidate: boolean;
    staleWhileRevalidate: number;
    staleIfError: number;
    publicFlag: boolean;
    privateFlag: boolean;
}

export interface Redirect {
    code: number;
    location: string;
}

export interface HeaderInfo {
    cache: CacheControl;
    methods: number;
    redirect: Redirect;
    resourceAdmin: string;
}

export interface ResourceMetadata {
    size: number;
    version: number;
    modifiedDate: number;
}

export interface DataPointStructure {
    size: number;
    mimeType: string;
    charset: string;
    location: string;
}

export interface RequestHeader {
    accept: BytesLike[];
    acceptCharset: BytesLike[];
    acceptLanguage: BytesLike[];
    ifModifiedSince: number;
    ifNoneMatch: string;
}

export interface GETRequest {
    host: string;
    rangeStart: number;
    rangeEnd: number;
}

export interface HEADResponse {
    responseLine: {
        protocol: string;
        code: number;
    };
    headerInfo: HeaderInfo;
    metadata: ResourceMetadata;
    dataStructure: DataPointStructure;
    etag: string;
}

export interface GETResponse {
    head: HEADResponse;
    body: string | BytesLike;
}

export type LOCATEResponse = LOCATEResponseStructOutput;

export interface RequestOptions {
    host: string;
    path: string;
    method: Method;
    content?: string | Uint8Array;
    ifNoneMatch?: string;
    ifModifiedSince?: number;
    range?: { 
        start: number; 
        end: number; 
    };
    mimeType?: string;
    charset?: string;
    location?: string;
    publisher?: string;
    accepts?: string[];
    acceptsCharset?: string[];
    acceptsLocation?: string[];
    chunkIndex?: number;
    header?: HeaderInfo;
    signer?: Signer;
    networkName?: SupportedNetworks;
}

export interface ParsedURL {
    host: string;
    path: string;
    queryParams?: string[];
    networkName?: SupportedNetworks;
}

