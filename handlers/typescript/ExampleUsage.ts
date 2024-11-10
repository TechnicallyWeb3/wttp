// this has been AI generated and has not been reviewed for correctness

import { ethers } from 'ethers';
import { WTTPHandler } from '../handlers/typescript/WTTPHandler';
import { 
    KEY_ADDRESSES, 
    MIME_TYPES,
    CHARSET_TYPES,
    LOCATION_TYPES 
} from '../types/constants';
import { WTTP__factory, WTTPBaseMethods__factory } from '../typechain-types';

async function main() {
    // Setup provider and signer
    const provider = new ethers.JsonRpcProvider('http://localhost:8545');
    const signer = await provider.getSigner();

    // Create contract instances
    const wttp = WTTP__factory.connect(
        KEY_ADDRESSES.WTTP_CONTRACT,
        signer
    );

    // Create WTTP Handler
    const handler = new WTTPHandler(
        wttp,
        KEY_ADDRESSES.DATA_POINT_STORAGE,
        wttpBaseMethods.interface,
        signer
    );

    // Example: Upload an HTML page
    console.log('Uploading HTML page...');
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>WTTP Demo</title>
        </head>
        <body>
            <h1>Hello WTTP!</h1>
        </body>
        </html>
    `;
    
    await handler.put(
        '/index.html',
        htmlContent,
        'TEXT_HTML',
        'UTF_8'
    );

    // Retrieve and verify content
    console.log('\nRetrieving content...');
    const response = await handler.get('/index.html');
    
    console.log('\nResponse:', {
        status: response.head.responseLine.code,
        mimeType: response.head.dataStructure.mimeType,
        size: response.head.dataStructure.size,
        content: response.body
    });
}

// Run the example
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });