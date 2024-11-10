import { ethers } from "hardhat";
import { MIME_TYPES, CHARSET_TYPES, LOCATION_TYPES, WTTP_CONTRACT } from "../types/constants";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying example sites with account:", deployer.address);
    
    // Get WTTPBaseMethods contract
    const WTTPBaseMethods = await ethers.getContractFactory("Dev_WTTPBaseMethods");
    const wttpBaseMethods = WTTPBaseMethods.attach("BASEMETHODS_ADDRESS"); // You'll need to provide this

    // Get DPR and DPS addresses from WTTPBaseMethods
    const dprAddress = await wttpBaseMethods.DPR_();
    const dataPointRegistry = await ethers.getContractAt("DataPointRegistry", dprAddress);
    const dpsAddress = await dataPointRegistry.DPS_();

    console.log("Contract Addresses:");
    console.log("- WTTPBaseMethods:", wttpBaseMethods.target);
    console.log("- DataPointRegistry:", dprAddress);
    console.log("- DataPointStorage:", dpsAddress);
    console.log("- WTTP:", WTTP_CONTRACT);

    // Shared JavaScript file content
    const sharedScript = `
function updateTime() {
    const timeElement = document.getElementById('time');
    timeElement.textContent = new Date().toLocaleTimeString();
}

updateTime();
setInterval(updateTime, 1000);`;

    // Deploy Site 1: Basic Hello World
    const site1Html = `
<!DOCTYPE html>
<html>
<head>
    <title>WTTP Site 1</title>
</head>
<body>
    <h1>Hello from Site 1!</h1>
    <p>Current time: <span id="time"></span></p>
    <script src="/script.js"></script>
</body>
</html>`;

    await wttpBaseMethods.PUT(
        { path: "/site1/index.html", protocol: "WTTP/2.0" },
        ethers.hexlify(MIME_TYPES.TEXT_HTML),
        ethers.hexlify(CHARSET_TYPES.UTF_8),
        ethers.hexlify(LOCATION_TYPES.DATAPOINT_CHUNK),
        deployer.address,
        ethers.toUtf8Bytes(site1Html)
    );

    await wttpBaseMethods.PUT(
        { path: "/site1/script.js", protocol: "WTTP/2.0" },
        ethers.hexlify(MIME_TYPES.TEXT_JAVASCRIPT),
        ethers.hexlify(CHARSET_TYPES.UTF_8),
        ethers.hexlify(LOCATION_TYPES.DATAPOINT_CHUNK),
        deployer.address,
        ethers.toUtf8Bytes(sharedScript)
    );

    // Deploy Site 2: Blog-style site
    const site2Html = `
<!DOCTYPE html>
<html>
<head>
    <title>WTTP Blog</title>
</head>
<body>
    <h1>Welcome to my WTTP Blog</h1>
    <article>
        <h2>First Post</h2>
        <p>This is a blog post about WTTP...</p>
    </article>
    <p>Current time: <span id="time"></span></p>
    <script src="/script.js"></script>
</body>
</html>`;

    await wttpBaseMethods.PUT(
        { path: "/site2/index.html", protocol: "WTTP/2.0" },
        ethers.hexlify(MIME_TYPES.TEXT_HTML),
        ethers.hexlify(CHARSET_TYPES.UTF_8),
        ethers.hexlify(LOCATION_TYPES.DATAPOINT_CHUNK),
        deployer.address,
        ethers.toUtf8Bytes(site2Html)
    );

    await wttpBaseMethods.PUT(
        { path: "/site2/script.js", protocol: "WTTP/2.0" },
        ethers.hexlify(MIME_TYPES.TEXT_JAVASCRIPT),
        ethers.hexlify(CHARSET_TYPES.UTF_8),
        ethers.hexlify(LOCATION_TYPES.DATAPOINT_CHUNK),
        deployer.address,
        ethers.toUtf8Bytes(sharedScript)
    );

    // Deploy Site 3: Documentation site (with unique script)
    const site3Html = `
<!DOCTYPE html>
<html>
<head>
    <title>WTTP Documentation</title>
</head>
<body>
    <h1>WTTP Protocol Documentation</h1>
    <nav id="toc"></nav>
    <main>
        <section>
            <h2>Introduction</h2>
            <p>WTTP is a web protocol for the tokenized web...</p>
        </section>
    </main>
    <script src="/script.js"></script>
</body>
</html>`;

    const site3Script = `
document.addEventListener('DOMContentLoaded', function() {
    const toc = document.getElementById('toc');
    const headings = document.querySelectorAll('h2');
    const tocList = document.createElement('ul');
    
    headings.forEach(heading => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.textContent = heading.textContent;
        a.href = '#' + heading.textContent.toLowerCase().replace(/\s+/g, '-');
        heading.id = a.href.slice(1);
        li.appendChild(a);
        tocList.appendChild(li);
    });
    
    toc.appendChild(tocList);
});`;

    await wttpBaseMethods.PUT(
        { path: "/site3/index.html", protocol: "WTTP/2.0" },
        ethers.hexlify(MIME_TYPES.TEXT_HTML),
        ethers.hexlify(CHARSET_TYPES.UTF_8),
        ethers.hexlify(LOCATION_TYPES.DATAPOINT_CHUNK),
        deployer.address,
        ethers.toUtf8Bytes(site3Html)
    );

    await wttpBaseMethods.PUT(
        { path: "/site3/script.js", protocol: "WTTP/2.0" },
        ethers.hexlify(MIME_TYPES.TEXT_JAVASCRIPT),
        ethers.hexlify(CHARSET_TYPES.UTF_8),
        ethers.hexlify(LOCATION_TYPES.DATAPOINT_CHUNK),
        deployer.address,
        ethers.toUtf8Bytes(site3Script)
    );

    console.log("Deployed 3 example sites!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 