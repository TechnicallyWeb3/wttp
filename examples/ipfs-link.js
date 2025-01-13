const { wttp } = require('../dist/src/WTTPHandler');
const { Wallet } = require('ethers');
const dotenv = require('dotenv');
dotenv.config();

// const site = "0x3ab97b45674f9765446D500108Aee044DF7934e6:sepolia";
// const site = "0x093C65296747E07196f7Fc1dF78A5Cf460Ba2072:sepolia";
// const site = "0xaEEa3DB3443882D882d033596adb927cc6EfB50a:sepolia";
// const site = "0xC92B7372D4048c48C6B03958b3f9D204B034aF87:sepolia";
// const site = "0x70f190FdA28dBE4934D27c931ba19e5E9b965273";
const site = "0x36199Defab23C24E265C7DFFad47E8d9E821Fd23";

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
            body: '<!doctype html><html lang="en"><head><meta charset="utf-8"/><link rel="icon" href="/favicon.ico"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="theme-color" content="#000000"/><meta name="description" content="Web site created using create-react-app"/><link rel="apple-touch-icon" href="/logo192.png"/><link rel="manifest" href="/manifest.json"/><title>React App</title><script defer="defer" src="wttp://0xaEEa3DB3443882D882d033596adb927cc6EfB50a/script.js"></script><link href="wttp://0xaEEa3DB3443882D882d033596adb927cc6EfB50a/styles.css" rel="stylesheet"></head><body><noscript>You need to enable JavaScript to run this app.</noscript><div id="root"></div></body></html>',
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

    // try {
    //     // write large file to site using PUT
    //     const response = await wttp.fetch(`wttp://${site}/large.html`, {
    //         method: "PUT",
    //         headers: {
    //             "Content-Type": "text/html; charset=utf-8",
    //             "Content-Location": "datapoint/chunk",
    //             "Publisher": signer.address
    //         },
    //         body: `<html><body><h1>A ${"really ".repeat(1000)}`,
    //         signer: signer
    //     });
    //     console.log();
    //     console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
    //     console.log();
    //     console.log("PUT response:", response);
        

    // } catch (error) {
    //     console.error("Error making large.html PUT request:");
    // }

    // try {
    //     // write large file to site using PATCH
    //     const patchResponse = await wttp.fetch(`wttp://${site}/large.html`, {
    //         method: "PATCH",
    //         headers: {
    //             "Content-Type": "text/html; charset=utf-8",
    //             "Content-Location": "datapoint/chunk",
    //             "Range": "chunks=1",
    //             "Publisher": signer.address
    //         },
    //         body: `${"really ".repeat(1000)} long file </h1></body></html>`,
    //         signer: signer
    //     });
    //     console.log();
    //     console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
    //     console.log();
    //     console.log("PATCH response:", patchResponse);
        
    // } catch (error) {
    //     console.error("Error making large.html PATCH request:");
    // }

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
        // PUT IPFS Links
        const response = await wttp.fetch(`wttp://${site}/styles.css`, {
            method: "PUT",
            headers: {
                "Content-Type": "text/css; charset=utf-8",
                "Content-Location": "ipfs/file",
                "Publisher": signer.address
            },
            body: "Qmcdy1aJwtEr96EvB7d7UhdpsWecZeuhy2kwxt8o62jqBH",
            signer: signer
        });
        console.log("PUT response:", response);
    } catch (error) {
        console.error("Error making styles.css PUT request:");
    }

    try {
        // Basic GET request
        const response = await wttp.fetch(`wttp://${site}/styles.css`);
        
        // Log the full response
        console.log();
        console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        console.log();
        console.log("Full styles.css response:", response);
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
        console.error("Error making style.css GET request:");
    }

    try {
        // PUT IPFS Links
        const response = await wttp.fetch(`wttp://${site}/script.js`, {
            method: "PUT",
            headers: {
                "Content-Type": "text/javascript; charset=utf-8",
                "Content-Location": "ipfs/file",
                "Publisher": signer.address
            },
            body: "QmURqptU2UgXLG9vX4fRoxBFHa1fHWdzQzhoMNmkNnJkQ9",
            signer: signer
        });
        console.log("PUT response:", response);
    } catch (error) {
        console.error("Error making script.js PUT request:");
    }

    try {
        // Basic GET request
        const response = await wttp.fetch(`wttp://${site}/script.js`);

        // Log the full response
        console.log();
        console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        console.log();
        console.log("Full script.js response:", response);
        console.log();
        console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        console.log();
        const data = await response.text();
        console.log("Response data:", data);
        
    } catch (error) {
        console.error("Error making script.js GET request:");
    }
}

// Run the example
main().catch(console.error);