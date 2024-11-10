import { BytesLike } from "ethers";

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

export interface LOCATEResponse {
    dataPoints: string[];
} 