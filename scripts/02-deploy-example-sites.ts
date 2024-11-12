import { ethers } from "hardhat";
import { MIME_TYPES, CHARSET_TYPES, LOCATION_TYPES, WTTP_CONTRACT_ADDRESS, DATAPOINT_REGISTRY_ADDRESS, DEFAULT_HEADER } from "../types/constants";
import { WTTPHandler } from "../handlers/typescript/WTTPHandler";
import { WTTP } from "../typechain-types";

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
    const site1 = await WTTPBaseMethods.connect(creator1).deploy(
        DATAPOINT_REGISTRY_ADDRESS,
        creator1.address,
        DEFAULT_HEADER
    );
    const site2 = await WTTPBaseMethods.connect(creator2).deploy(
        DATAPOINT_REGISTRY_ADDRESS,
        creator2.address,
        DEFAULT_HEADER
    );
    const site3 = await WTTPBaseMethods.connect(creator3).deploy(
        DATAPOINT_REGISTRY_ADDRESS,
        creator3.address,
        DEFAULT_HEADER
    );
    await site1.waitForDeployment();
    await site2.waitForDeployment();
    await site3.waitForDeployment();

    // Get DPR and DPS addresses from WTTPBaseMethods
    const dataPointRegistry = await ethers.getContractAt("DataPointRegistry", DATAPOINT_REGISTRY_ADDRESS);
    const dpsAddress = await dataPointRegistry.DPS_();
    const wttp = await ethers.getContractAt("WTTP", WTTP_CONTRACT_ADDRESS) as WTTP;

    console.log("Contract Addresses:");
    console.log("- DataPointRegistry:", DATAPOINT_REGISTRY_ADDRESS);
    console.log("- DataPointStorage:", dpsAddress);
    console.log("- WTTP:", WTTP_CONTRACT_ADDRESS);
    console.log("- Site 1:", site1.target);
    console.log("- Site 2:", site2.target);
    console.log("- Site 3:", site3.target);

    // Create handlers for each site
    const handler1 = new WTTPHandler(wttp, creator1);
    const handler2 = new WTTPHandler(wttp, creator2);
    const handler3 = new WTTPHandler(wttp, creator3);

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

    await handler1.put(
        site1.target,
        "/site1/index.html",
        site1Html,
        'TEXT_HTML',
        'UTF_8'
    );

    await handler1.put(
        site1.target,
        "/site1/script.js",
        sharedScript,
        'TEXT_JAVASCRIPT',
        'UTF_8'
    );

    // Deploy Site 2 with creator2
    console.log("\nDeploying Site 2 with:", creator2.address);
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

    await handler2.put(
        site2.target,
        "/site2/index.html",
        site2Html,
        'TEXT_HTML',
        'UTF_8'
    );

    await handler2.put(
        site2.target,
        "/site2/script.js",
        sharedScript,
        'TEXT_JAVASCRIPT',
        'UTF_8'
    );

    // Deploy Site 3 with creator3
    console.log("\nDeploying Site 3 with:", creator3.address);
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

    await handler3.put(
        site3.target,
        "/site3/index.html",
        site3Html,
        'TEXT_HTML',
        'UTF_8'
    );

    await handler3.put(
        site3.target,
        "/site3/script.js",
        site3Script,
        'TEXT_JAVASCRIPT',
        'UTF_8'
    );

    console.log("Deployed 3 example sites!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 