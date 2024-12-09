# WTTP (Web3 Transfer Protocol) Specification
Version 2.0

## Overview
WTTP is a blockchain-based protocol that implements HTTP-like functionality for decentralized web resources. It provides a standardized way to store, retrieve, and manage web content on the blockchain with built-in content addressing and royalty mechanisms.

## Protocol Structure

### URL Format
```
wttp://<host>[:<network>]/<path>[?<query>]
```
- `host`: Contract address or ENS name
- `network`: Optional network identifier (e.g., mainnet, sepolia)
- `path`: Resource path
- `query`: Optional query parameters

### Request Methods

#### GET
Retrieves a resource from a WTTP site.
```
GET {
    requestLine: { protocol: "WTTP/2.0", path: string },
    requestHeader: {
        accept: bytes2[],
        acceptCharset: bytes2[],
        acceptLanguage: bytes4[],
        ifModifiedSince: uint256,
        ifNoneMatch: bytes32
    },
    getRequest: {
        host: address,
        rangeStart: uint32,
        rangeEnd: uint32
    }
}
```

#### HEAD
Retrieves resource metadata without content.
```
HEAD {
    host: address,
    requestLine: { protocol: "WTTP/2.0", path: string }
}
```

#### PUT
Creates or replaces a resource.
```
PUT {
    requestLine: { protocol: "WTTP/2.0", path: string },
    mimeType: bytes2,
    charset: bytes2,
    location: bytes2,
    publisher: address,
    data: bytes
}
```

#### PATCH
Updates a multi-part resource.
```
PATCH {
    requestLine: { protocol: "WTTP/2.0", path: string },
    data: bytes,
    chunk: uint256,
    publisher: address
}
```

#### LOCATE
Gets resource location information.
```
LOCATE {
    host: address,
    requestLine: { protocol: "WTTP/2.0", path: string }
}
```

#### DEFINE
Sets resource metadata and permissions.
```
DEFINE {
    host: address,
    requestLine: { protocol: "WTTP/2.0", path: string },
    header: HeaderInfo
}
```

### Response Structure

#### Standard Response
```
{
    head: {
        responseLine: {
            protocol: "WTTP/2.0",
            code: number
        },
        headerInfo: {
            cache: CacheControl,
            methods: uint16,
            redirect: Redirect,
            resourceAdmin: address
        },
        metadata: {
            size: number,
            version: number,
            modifiedDate: number
        },
        dataStructure: {
            mimeType: string,
            charset: string
        },
        etag: bytes32
    },
    body: bytes
}
```

### Status Codes

#### 2xx Success
- 200: OK
- 201: Created
- 204: No Content
- 206: Partial Content

#### 3xx Redirection
- 301: Moved Permanently
- 302: Found
- 304: Not Modified
- 307: Temporary Redirect
- 308: Permanent Redirect

#### 4xx Client Errors
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 405: Method Not Allowed
- 413: Payload Too Large
- 415: Unsupported Media Type
- 416: Range Not Satisfiable

#### 5xx Server Errors
- 500: Internal Server Error
- 501: Not Implemented
- 505: WTTP Version Not Supported

### Headers

#### Request Headers
- `Accept`: Acceptable MIME types
- `Accept-Charset`: Acceptable character sets
- `Accept-Language`: Acceptable languages
- `Content-Type`: Resource MIME type and charset
- `Content-Location`: Resource location type
- `If-None-Match`: Conditional request based on ETag
- `If-Modified-Since`: Conditional request based on timestamp
- `Range`: Request specific chunks
- `Publisher`: Resource publisher address

#### Response Headers
- `Content-Type`: Resource MIME type and charset
- `Content-Length`: Resource size in bytes
- `ETag`: Resource identifier
- `Last-Modified`: Last modification timestamp
- `Cache-Control`: Caching directives
- `Allow`: Allowed methods
- `Location`: Redirect location
- `Registry-Address`: DataPoint registry address

### Data Structures

#### DataPoints
Atomic storage units containing:
- Content data
- MIME type
- Charset
- Location type
- Publisher address

#### Resources
Composite structures containing:
- Metadata
- DataPoint references
- Version information
- Access controls

## Royalty System

### Calculation
```
royalty = baseRate * dataSize + publisherFee
```

### Distribution
- 90% to content publisher
- 10% to protocol (TW3)

### Deduplication
Identical content shares the same DataPoint to reduce storage costs.

## Performance Considerations

### Chunking
- Recommended chunk size: 16KB
- Maximum tested file size: 10MB
- Average operations:
  - Write: 23ms per chunk
  - Read: 24ms per chunk
  - Gas: 2.85M per chunk

### Caching
Supports standard HTTP caching mechanisms:
- `max-age`
- `s-maxage`
- `no-store`
- `no-cache`
- `must-revalidate`
- `immutable`

## Security

### Access Control
- Site-level administration
- Resource-level permissions
- Publisher verification
- Method restrictions

### Content Verification
- ETag-based integrity checking
- Content addressing
- Publisher signatures

## Implementation Guidelines

### Client Implementation
1. Parse WTTP URL
2. Build appropriate request structure
3. Handle network switching if specified
4. Execute request through WTTP contract
5. Process response according to status code

### Site Implementation
1. Implement required WTTP methods
2. Handle DataPoint storage
3. Manage access controls
4. Process royalty payments
5. Maintain resource metadata

## References
- [WTTP GitHub Repository](https://github.com/TechnicallyWeb3/WTTP)
- [HTTP/1.1 Specification (RFC 2616)](https://tools.ietf.org/html/rfc2616)
