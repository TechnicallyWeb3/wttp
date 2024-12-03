const { wttp } = require('../dist/src/WTTPHandler');

async function main() {
    try {
        // Basic GET request
        const response = await wttp.fetch("wttp://0x3B370D271344d0C4d5DCbd80Bfe714C0e1ED648a");
        
        // Log the full response
        console.log("Full response:", response);
        
        // If you want to see the response data
        const data = await response.text();
        console.log("Response data:", data);
        
        // You can also check response status
        console.log("Status:", response.status);
        console.log("Status text:", response.statusText);
        
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

// Run the example
main().catch(console.error);

// Alternative using .then() syntax as requested
wttp.fetch("wttp://0x3B370D271344d0C4d5DCbd80Bfe714C0e1ED648a")
    .then((response) => {
        console.log(response);
    })
    .catch((error) => {
        console.error("Error:", error);
    }); 