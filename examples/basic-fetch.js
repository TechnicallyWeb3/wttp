const { wttp } = require('../dist/src/WTTPHandler');
const { Wallet } = require('ethers');
const dotenv = require('dotenv');
dotenv.config();

const site = "0xF84468fc473c0FFBA6cf45b24Bd5e126FEB65F3f";
const signer = new Wallet(process.env.PRIVATE_KEY); // use private key from .env

async function main() {

    try {
        

        // write to site using PUT
        const response = await wttp.fetch(`wttp://${site}/index.html`, {
            method: "PUT",
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Content-Location": "datapoint/chunk",
                "Publisher": signer.address
            },
            body: "Hello World",
            signer: signer
        });
        console.log();
        console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        console.log();
        console.log("PUT response:", response);
    } catch (error) {
        console.error("Error making index.html PUT request:");
    }

    try {
        // write large file to site using PUT
        const response = await wttp.fetch(`wttp://${site}/large.html`, {
            method: "PUT",
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Content-Location": "datapoint/chunk",
                "Publisher": signer.address
            },
            body: `<html><body><h1>A ${"really ".repeat(1000)}`,
            signer: signer
        });
        console.log();
        console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        console.log();
        console.log("PUT response:", response);
        

    } catch (error) {
        console.error("Error making large.html PUT request:");
    }

    try {
        // write large file to site using PATCH
        const patchResponse = await wttp.fetch(`wttp://${site}/large.html`, {
            method: "PATCH",
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Content-Location": "datapoint/chunk",
                "Range": "chunks=1",
                "Publisher": signer.address
            },
            body: `${"really ".repeat(1000)} long file </h1></body></html>`,
            signer: signer
        });
        console.log();
        console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        console.log();
        console.log("PATCH response:", patchResponse);
        
    } catch (error) {
        console.error("Error making large.html PATCH request:");
    }

    try {
        // Basic GET request
        const response = await wttp.fetch(`wttp://${site}/index.html`);
        
        // Log the full response
        console.log();
        console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        console.log();
        console.log("Full index.html response:", response);
        console.log();
        console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        console.log();
        console.log(`Response status: ${response.status} - ${response.statusText}`);
        console.log();
        console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        console.log();
        const data = await response.text();
        console.log("Response data:", data);
        
        
    } catch (error) {
        console.error("Error making index.html GET request:");
    }

    try {
        // Basic GET request
        const response = await wttp.fetch(`wttp://${site}/large.html`);
        
        // Log the full response
        console.log();
        console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        console.log();
        console.log("Full large.html response:", response);
        console.log();
        console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        console.log();
        console.log(`Response status: ${response.status} - ${response.statusText}`);
        console.log();
        console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        console.log();
        const data = await response.text();
        console.log("Response data:", data);
        
        
    } catch (error) {
        console.error("Error making large.html GET request:");
    }
}

// Run the example
main().catch(console.error);