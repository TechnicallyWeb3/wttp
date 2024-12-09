# WTTP (Web3 Transfer Transport Protocol)

WTTP is a blockchain-based protocol that implements HTTP-like functionality for decentralized web resources. It provides a comprehensive system for storing, retrieving, and managing web resources on the blockchain with built-in content addressing and royalty mechanisms.

## Repository Structure

The WTTP protocol is implemented across three main packages:

- **Protocol Implementation**: [technicallyweb3/wttp](https://github.com/technicallyweb3/wttp)
  - Core protocol implementation
  - TypeScript handler
  - Documentation and examples

- **NPM Package**: [wttp-handler](https://www.npmjs.com/package/wttp-handler)
  - JavaScript/TypeScript client library
  - Fetch-like API for WTTP interactions
  - Ready-to-use examples

- **Smart Contracts**: [@tw3/solidity](https://www.npmjs.com/package/@tw3/solidity)
  - Solidity contract implementations
  - Base contracts for WTTP sites
  - Import path: `@tw3/solidity/contracts/wttp/TW3Site.sol`

## Quick Start

### 1. Deploy Your Site Contract
Using Remix IDE (recommended for beginners) or Hardhat, deploy this contract to Sepolia testnet:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@tw3/solidity/contracts/wttp/TW3Site.sol";

contract MyFirstSite is TW3Site {
    constructor(
        string memory _name, 
        string memory _description, 
        string memory _tags
    ) TW3Site(_name, _description, _tags) {}
}
```

### 2. Install WTTP Handler
```bash
npm install wttp-handler
```

### 3. Create Basic Script
Create a new file `my-site.js`:

```javascript
const { wttp } = require('wttp-handler');
const { Wallet } = require('ethers');
require('dotenv').config();

// Replace with your deployed contract address
const SITE_ADDRESS = "0x..."; 

// Create a new account for testing and add its private key to .env
const signer = new Wallet(process.env.PRIVATE_KEY);

async function main() {
    // Write content
    const putResponse = await wttp.fetch(`wttp://${SITE_ADDRESS}/index.html`, {
        method: "PUT",
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Location": "datapoint/chunk",
            "Publisher": signer.address
        },
        body: "<html><body>Hello Web3!</body></html>",
        signer: signer
    });
    console.log("PUT Response:", putResponse.status);

    // Read content
    const getResponse = await wttp.fetch(`wttp://${SITE_ADDRESS}/index.html`);
    const content = await getResponse.text();
    console.log("Content:", content);
}

main().catch(console.error);
```

### 4. Setup Environment
Create a `.env` file:
```bash
# ⚠️ Create a new account for testing! Don't use your main account
PRIVATE_KEY=your_private_key_here
```

### 5. Run Your Script
```bash
node my-site.js
```

> ⚠️ **Security Note**: Always create a new account for testing and never share or commit your private keys.

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
copy .env.template to .env and set the MNEMONIC environment variable


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