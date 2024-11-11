import { ethers } from "hardhat";
import { MIME_TYPES, CHARSET_TYPES, LOCATION_TYPES, WTTP_CONTRACT, DATAPOINT_REGISTRY, DEFAULT_HEADER } from "../types/constants";

async function main() {
    // Get multiple signers, skip the first one (deployer)
    const signers = await ethers.getSigners();
    const [_, creator1, creator2, creator3] = signers;
    console.log("Deploying example sites with accounts:");
    console.log("- Site 1 Creator:", creator1.address);
    console.log("- Site 2 Creator:", creator2.address);
    console.log("- Site 3 Creator:", creator3.address);
    
    // Get WTTPBaseMethods contract
    const WTTPBaseMethods = await ethers.getContractFactory("Dev_WTTPBaseMethods");
    const site1 = await WTTPBaseMethods.deploy(
        DATAPOINT_REGISTRY,  // Use the saved registry address
        creator1.address,
        DEFAULT_HEADER
    );
    const site2 = await WTTPBaseMethods.deploy(
        DATAPOINT_REGISTRY,  // Use the saved registry address
        creator2.address,
        DEFAULT_HEADER
    );
    const site3 = await WTTPBaseMethods.deploy(
        DATAPOINT_REGISTRY,  // Use the saved registry address
        creator3.address,
        DEFAULT_HEADER
    );
    await site1.waitForDeployment(); // Wait for deployment to complete
    await site2.waitForDeployment(); // Wait for deployment to complete
    await site3.waitForDeployment(); // Wait for deployment to complete

    // Get DPR and DPS addresses from WTTPBaseMethods
    const dataPointRegistry = await ethers.getContractAt("DataPointRegistry", DATAPOINT_REGISTRY);
    const dpsAddress = await dataPointRegistry.DPS_();

    console.log("Contract Addresses:");
    console.log("- DataPointRegistry:", DATAPOINT_REGISTRY);
    console.log("- DataPointStorage:", dpsAddress);
    console.log("- WTTP:", WTTP_CONTRACT);
    console.log("- Site 1:", site1.target);
    console.log("- Site 2:", site2.target);
    console.log("- Site 3:", site3.target);

    // Shared JavaScript file content
    const sharedScript = `
function updateTime() {
    const timeElement = document.getElementById('time');
    timeElement.textContent = new Date().toLocaleTimeString();
}

updateTime();
setInterval(updateTime, 1000);`;

    // Deploy Site 1 with creator1
    console.log("\nDeploying Site 1 with:", creator1.address);
    const wttpBaseMethods1 = site1.connect(creator1);
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

    await wttpBaseMethods1.PUT(
        { path: "/site1/index.html", protocol: "WTTP/2.0" },
        ethers.hexlify(MIME_TYPES.TEXT_HTML),
        ethers.hexlify(CHARSET_TYPES.UTF_8),
        ethers.hexlify(LOCATION_TYPES.DATAPOINT_CHUNK),
        creator1.address,
        ethers.toUtf8Bytes(site1Html)
    );

    await wttpBaseMethods1.PUT(
        { path: "/site1/script.js", protocol: "WTTP/2.0" },
        ethers.hexlify(MIME_TYPES.TEXT_JAVASCRIPT),
        ethers.hexlify(CHARSET_TYPES.UTF_8),
        ethers.hexlify(LOCATION_TYPES.DATAPOINT_CHUNK),
        creator1.address,
        ethers.toUtf8Bytes(sharedScript)
    );

    // Deploy Site 2 with creator2
    console.log("\nDeploying Site 2 with:", creator2.address);
    const wttpBaseMethods2 = site2.connect(creator2);
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

    await wttpBaseMethods2.PUT(
        { path: "/site2/index.html", protocol: "WTTP/2.0" },
        ethers.hexlify(MIME_TYPES.TEXT_HTML),
        ethers.hexlify(CHARSET_TYPES.UTF_8),
        ethers.hexlify(LOCATION_TYPES.DATAPOINT_CHUNK),
        creator2.address,
        ethers.toUtf8Bytes(site2Html)
    );

    await wttpBaseMethods2.PUT(
        { path: "/site2/script.js", protocol: "WTTP/2.0" },
        ethers.hexlify(MIME_TYPES.TEXT_JAVASCRIPT),
        ethers.hexlify(CHARSET_TYPES.UTF_8),
        ethers.hexlify(LOCATION_TYPES.DATAPOINT_CHUNK),
        creator2.address,
        ethers.toUtf8Bytes(sharedScript)
    );

    // Deploy Site 3 with creator3
    console.log("\nDeploying Site 3 with:", creator3.address);
    const wttpBaseMethods3 = site3.connect(creator3);
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

    await wttpBaseMethods3.PUT(
        { path: "/site3/index.html", protocol: "WTTP/2.0" },
        ethers.hexlify(MIME_TYPES.TEXT_HTML),
        ethers.hexlify(CHARSET_TYPES.UTF_8),
        ethers.hexlify(LOCATION_TYPES.DATAPOINT_CHUNK),
        creator3.address,
        ethers.toUtf8Bytes(site3Html)
    );

    await wttpBaseMethods3.PUT(
        { path: "/site3/script.js", protocol: "WTTP/2.0" },
        ethers.hexlify(MIME_TYPES.TEXT_JAVASCRIPT),
        ethers.hexlify(CHARSET_TYPES.UTF_8),
        ethers.hexlify(LOCATION_TYPES.DATAPOINT_CHUNK),
        creator3.address,
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