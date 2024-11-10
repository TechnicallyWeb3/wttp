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

        const webApp = new WTTPHandler(
            wttp,
            wttpBaseMethods.target,
            wttpBaseMethods.interface,
            tw3
        );

        return { wttp, webApp, wttpBaseMethods, dataPointStorage, tw3, user1 };
    }

    it("Should create and retrieve a hello world webpage with JavaScript", async function () {
        const { webApp } = await loadFixture(deployFixture);

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
            "/index.html",
            htmlContent,
            "TEXT_HTML",
            "UTF_8"
        );

        // Put the JavaScript file
        await webApp.put(
            "/script.js",
            jsContent,
            "TEXT_JAVASCRIPT",
            "UTF_8"
        );

        // Get and verify HTML content
        const htmlResponse = await webApp.get("/index.html");
        console.log(htmlResponse);
        console.log(htmlResponse.head);
        expect(htmlResponse.head.responseLine.code).to.equal(200);
        expect(htmlResponse.body).to.equal(htmlContent);

        // Get and verify JavaScript content
        const jsResponse = await webApp.get("/script.js");
        expect(jsResponse.head.responseLine.code).to.equal(200);
        expect(jsResponse.body).to.equal(jsContent);
    });

    it("Should allow admin to PUT then PATCH multi-part resources", async function () {
        const { wttpBaseMethods, dataPointStorage, tw3 } = await loadFixture(deployFixture);

        const part1 = "<html><body>First part";
        const part2 = " Second part";
        const part3 = " Third part</body></html>";

        // Add debug output for initial PUT
        await wttpBaseMethods.PUT(
            { path: "/multipart.html", protocol: "WTTP/2.0" },
            ethers.hexlify("0x7468"),
            ethers.hexlify("0x7574"),
            ethers.hexlify("0x0101"),
            tw3.address,
            ethers.toUtf8Bytes(part1)
        );

        let headResponse = await wttpBaseMethods.HEAD({ path: "/multipart.html", protocol: "WTTP/2.0" });
        // console.log("\nAfter PUT:", {
        //     size: headResponse.metadata.size,
        //     version: headResponse.metadata.version
        // });

        // PATCH chunk 1
        await wttpBaseMethods.PATCH(
            { path: "/multipart.html", protocol: "WTTP/2.0" },
            ethers.toUtf8Bytes(part2),
            1,
            tw3.address
        );

        headResponse = await wttpBaseMethods.HEAD({ path: "/multipart.html", protocol: "WTTP/2.0" });
        // console.log("\nAfter PATCH 1:", {
        //     size: headResponse.metadata.size,
        //     version: headResponse.metadata.version
        // });

        // PATCH chunk 2
        await wttpBaseMethods.PATCH(
            { path: "/multipart.html", protocol: "WTTP/2.0" },
            ethers.toUtf8Bytes(part3),
            2,
            tw3.address
        );
        headResponse = await wttpBaseMethods.HEAD({ path: "/multipart.html", protocol: "WTTP/2.0" });
        // console.log("\nAfter PATCH 2:", {
        //     size: headResponse.metadata.size,
        //     version: headResponse.metadata.version
        // });

        let  locations = await wttpBaseMethods.LOCATE({ path: "/multipart.html", protocol: "WTTP/2.0" });
        // console.log("\nFinal locations:", locations);
        // console.log("Locations length:", locations.dataPoints.length);
        
        // Verify final state
        headResponse = await wttpBaseMethods.HEAD({ path: "/multipart.html", protocol: "WTTP/2.0" });
        expect(headResponse.metadata.size).to.equal(part1.length + part2.length + part3.length);
        expect(headResponse.metadata.version).to.equal(3);

        // Verify all chunks are present
        locations = await wttpBaseMethods.LOCATE({ path: "/multipart.html", protocol: "WTTP/2.0" });
        expect(locations.dataPoints.length).to.equal(3);

        // Verify data integrity
        let result = "";
        for (let i = 0; i < 3; i++) {
            const data = await dataPointStorage.readDataPoint(locations.dataPoints[i]);
            result += ethers.toUtf8String(data.data);
        }
        expect(result).to.equal(part1 + part2 + part3);
    });

    it("Should successfully GET ranges from a 20-part resource", async function () {
        const { wttpBaseMethods, wttp, tw3 } = await loadFixture(deployFixture);
        // Create a 20-part text file, each part containing a number
        const parts = Array.from({ length: 20 }, (_, i) => `Part ${i + 1}\n`);
        const fullContent = parts.join("");

        // PUT first part
        await wttpBaseMethods.PUT(
            { path: "/large.txt", protocol: "WTTP/2.0" },
            ethers.hexlify("0x7474"), // text/plain
            ethers.hexlify("0x7574"), // utf-8
            ethers.hexlify("0x0101"), // datapoint/chunk
            tw3.address,
            ethers.toUtf8Bytes(parts[0])
        );

        // PATCH remaining parts
        for (let i = 1; i < 20; i++) {
            await wttpBaseMethods.PATCH(
                { path: "/large.txt", protocol: "WTTP/2.0" },
                ethers.toUtf8Bytes(parts[i]),
                i,
                tw3.address
            );
        }

        // Test different ranges
        const ranges = [
            { start: 0, end: 4 },    // First 5 parts
            { start: 10, end: 14 },  // Middle 5 parts
            { start: 15, end: 19 }   // Last 5 parts
        ];

        for (const range of ranges) {
            const getResponse = await wttp.GET(
                { path: "/large.txt", protocol: "WTTP/2.0" },
                {
                    accept: [],
                    acceptCharset: [],
                    acceptLanguage: [],
                    ifModifiedSince: 0,
                    ifNoneMatch: ethers.ZeroHash
                },
                {
                    host: wttpBaseMethods.target,
                    rangeStart: range.start,
                    rangeEnd: range.end
                }
            );

            expect(getResponse.head.responseLine.code).to.equal(206); // Partial Content
            const expectedContent = parts.slice(range.start, range.end + 1).join("");
            expect(ethers.toUtf8String(getResponse.body)).to.equal(expectedContent);
        }
        // Verify complete content with a full GET
        const fullGetResponse = await wttp.GET(
            { path: "/large.txt", protocol: "WTTP/2.0" },
            {
                accept: [],
                acceptCharset: [],
                acceptLanguage: [],
                ifModifiedSince: 0,
                ifNoneMatch: ethers.ZeroHash
            },
            {
                host: wttpBaseMethods.target,
                rangeStart: 0,
                rangeEnd: 19
            }
        );

        expect(fullGetResponse.head.responseLine.code).to.equal(200);
        expect(ethers.toUtf8String(fullGetResponse.body)).to.equal(fullContent);
    });
}); 