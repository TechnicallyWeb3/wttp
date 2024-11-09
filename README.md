# WTTP (Web3 Transfer Transport Protocol)

WTTP is a blockchain-based protocol that implements HTTP-like functionality for decentralized web resources. It provides a comprehensive system for storing, retrieving, and managing web resources on the blockchain with built-in content addressing and royalty mechanisms.

## Core Features

### Resource Management
- HTTP-like methods (GET, PUT, PATCH, HEAD, etc.)
- Multi-part resource support
- Content-type and charset handling
- Range requests for large resources
- ETags and conditional requests
- Cache control directives

### Storage System
- Content-addressed storage using DataPoints
- Collision-resistant addressing
- Chunked data storage for large resources
- Efficient data deduplication

### Permission System
- Role-based access control
- Site admin capabilities
- Resource-specific admin roles
- Granular permission management

### Royalty System
- Gas-based royalty calculations
- Publisher royalty collection
- TW3 fee distribution (10%)
- Royalty waiver options

## Getting Started

### Prerequisites
- Node.js
- npm/yarn
- Hardhat

### Installation

```
npm install
```


### Testing

Run the test suite:
```
npm test
```

## Protocol Specification

### Request Methods
- GET: Retrieve resources
- PUT: Create or replace resources
- PATCH: Update multi-part resources
- HEAD: Retrieve resource metadata
- LOCATE: Get resource location information

### Status Codes
- 200: OK
- 206: Partial Content
- 304: Not Modified
- 404: Not Found
- 405: Method Not Allowed
- 416: Range Not Satisfiable
- 505: WTTP Version Not Supported

### Data Structures
- DataPoints: Atomic storage units
- Resources: Composite data structures
- Headers: Resource metadata and control information

## Performance Metrics

Based on current testing:
- Average write time: 23ms per chunk
- Average read time: 24ms per chunk
- Average gas per chunk: 2.85M gas
- Tested chunk size: 16KB
- Maximum tested file size: 10MB

## License

AGPL-3.0