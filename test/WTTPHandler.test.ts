import { expect } from "chai";
import { ethers } from "hardhat";
import { WTTPHandler } from "../handlers/typescript/WTTPHandler";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("WTTPHandler Integration Test", function () {
    async function deployFixture() {
        const [tw3, user1] = await ethers.getSigners();

        const DataPointStorage = await ethers.getContractFactory("DataPointStorage");
        const dataPointStorage = await DataPointStorage.deploy();

        const DataPointRegistry = await ethers.getContractFactory("DataPointRegistry");
        const dataPointRegistry = await DataPointRegistry.deploy(dataPointStorage.target, tw3.address);

        const WTTPBaseMethods = await ethers.getContractFactory("Dev_WTTPBaseMethods");
        const wttpBaseMethods = await WTTPBaseMethods.deploy(dataPointRegistry.target, tw3.address, {
            cache: {
                maxAge: 0,
                sMaxage: 0,
                noStore: false,
                noCache: false,
                immutableFlag: false,
                mustRevalidate: false,
                proxyRevalidate: false,
                staleWhileRevalidate: 0,
                staleIfError: 0,
                publicFlag: false,
                privateFlag: false
            },
            methods: 2913, // Default methods
            redirect: {
                code: 0,
                location: ""
            },
            resourceAdmin: ethers.ZeroHash
        });

        const WTTP = await ethers.getContractFactory("WTTP");
        const wttp = await WTTP.deploy();

        const webApp = new WTTPHandler(wttp, tw3);

        return { wttp, webApp, WTTPBaseMethods, wttpBaseMethods, dataPointStorage, dataPointRegistry, tw3, user1 };
    }

    it("Should create and retrieve a hello world webpage with JavaScript", async function () {
        const { webApp, wttpBaseMethods } = await loadFixture(deployFixture);

        // HTML content
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>WTTP Hello World</title>
</head>
<body>
    <h1>Hello WTTP!</h1>
    <p>Current time: <span id="time"></span></p>
    <script src="/script.js"></script>
</body>
</html>`;

        // JavaScript content
        const jsContent = `
function updateTime() {
    const timeElement = document.getElementById('time');
    timeElement.textContent = new Date().toLocaleTimeString();
}

updateTime();
setInterval(updateTime, 1000);`;

        // Put the HTML file
        await webApp.put(
            wttpBaseMethods.target,
            "/index.html",
            htmlContent,
            "TEXT_HTML",
            "UTF_8"
        );

        // Put the JavaScript file
        await webApp.put(
            wttpBaseMethods.target,
            "/script.js",
            jsContent,
            "TEXT_JAVASCRIPT",
            "UTF_8"
        );

        // Get and verify HTML content
        const htmlResponse = await webApp.get(wttpBaseMethods.target, "/index.html");
        expect(htmlResponse.head.responseLine.code).to.equal(200);
        expect(htmlResponse.body).to.equal(htmlContent);

        // Get and verify JavaScript content
        const jsResponse = await webApp.get(wttpBaseMethods.target, "/script.js");
        expect(jsResponse.head.responseLine.code).to.equal(200);
        expect(jsResponse.body).to.equal(jsContent);
    });

    it("Should handle royalties correctly when writing identical data", async function () {
        const { webApp, WTTPBaseMethods, wttpBaseMethods, dataPointRegistry, wttp, tw3, user1: publisher2 } = await loadFixture(deployFixture);

        const webContract2 = await WTTPBaseMethods.connect(publisher2).deploy(dataPointRegistry.target, publisher2.address);
        await webContract2.waitForDeployment();

        // Create a second handler with publisher2
        const webApp2 = new WTTPHandler(wttp, publisher2);

        const content = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Royalty Test</title>
            </head>
            <body>
                <h1>Testing Royalties</h1>
                <p>This is identical content that should trigger royalties.</p>
            </body>
            </html>
        `;

        // First publisher writes the content
        await webApp.put(
            wttpBaseMethods.target,
            "/royalty-test.html",
            content,
            "TEXT_HTML",
            "UTF_8"
        );

        // Get publisher's initial balance
        const tw3InitialBalance = await dataPointRegistry.royaltyBalance(tw3.address);

        // Second publisher writes the same content
        await webApp2.put(
            webContract2.target,
            "/different-path.html",
            content,
            "TEXT_HTML",
            "UTF_8"
        );

        // Check balances after second write
        const tw3FinalBalance = await dataPointRegistry.royaltyBalance(tw3.address);

        // Verify royalties were paid
        expect(tw3FinalBalance).to.be.gt(tw3InitialBalance);

        // Verify content was stored correctly for both
        const response1 = await webApp.get(wttpBaseMethods.target, "/royalty-test.html");
        const response2 = await webApp2.get(webContract2.target, "/different-path.html");

        expect(response1.body).to.equal(content);
        expect(response2.body).to.equal(content);
    });
}); 