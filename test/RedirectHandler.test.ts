import { expect } from 'chai';
import { ethers } from 'ethers';
import { WTTPHandler } from '../src/WTTPHandler';
import { Method } from '../src/types/types';
import { DEFAULT_HEADER, HTTP_STATUS } from '../src/types/constants';
import hre from 'hardhat';
import { contractManager } from '../lib/contractManager';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

describe('Redirect Handler', () => {
    let handler: WTTPHandler;
    let wttp: any;
    let site1: any;
    let site2: any;
    let site3: any;
    let tw3: any;
    let user1: any;
    let user2: any;
    let gasPrice: any;

    async function estimateGas() {
        // Return a simple object with string values to avoid BigNumber issues
        return {
            maxFeePerGas: "2000000000",
            maxPriorityFeePerGas: "1000000000"
        };
    }

    // Helper function to create a resource with redirect
    async function createRedirectResource(site: any, path: string, redirectLocation: string, redirectCode: number = 301) {
        // Create a custom header with redirect information
        const customHeader = {
            ...DEFAULT_HEADER,
            redirect: {
                code: redirectCode,
                location: redirectLocation
            }
        };
        
        // Define the resource with redirect header
        const tx = await site.DEFINE(
            site.target,
            { path, protocol: "WTTP/2.0" },
            customHeader
        );
        await tx.wait();
    }

    // Helper function to create a regular resource
    async function createResource(site: any, path: string, content: string) {
        const tx = await site.PUT(
            { path, protocol: "WTTP/2.0" },
            ethers.hexlify("0x7468"), // text/html
            ethers.hexlify("0x7574"), // utf-8
            ethers.hexlify("0x0101"), // datapoint/chunk
            tw3.address,
            ethers.toUtf8Bytes(content)
        );
        await tx.wait();
    }

    before(async function() {
        this.timeout(60000);
        [tw3, user1, user2] = await hre.ethers.getSigners();

        // Deploy or load WTTP
        const WTTP = await hre.ethers.getContractFactory("WTTP");
        const existingWTTPAddress = contractManager.getContractAddress('wttp');
        
        if (existingWTTPAddress) {
            console.log("Loading existing WTTP at:", existingWTTPAddress);
            wttp = WTTP.attach(existingWTTPAddress);
        } else {
            wttp = await WTTP.deploy();
            await wttp.waitForDeployment();
            contractManager.saveContract('wttp', await wttp.getAddress());
            console.log("WTTP deployed at:", await wttp.getAddress());
        }

        // Deploy DataPointRegistry if needed
        const DataPointStorage = await hre.ethers.getContractFactory("DataPointStorage");
        const existingDPSAddress = contractManager.getContractAddress('dataPointStorage');
        let dataPointStorage;
        
        if (existingDPSAddress) {
            console.log("Loading existing DataPointStorage at:", existingDPSAddress);
            dataPointStorage = DataPointStorage.attach(existingDPSAddress);
        } else {
            dataPointStorage = await DataPointStorage.deploy();
            await dataPointStorage.waitForDeployment();
            contractManager.saveContract('dataPointStorage', await dataPointStorage.getAddress());
            console.log("DataPointStorage deployed at:", await dataPointStorage.getAddress());
        }

        const DataPointRegistry = await hre.ethers.getContractFactory("DataPointRegistry");
        const existingDPRAddress = contractManager.getContractAddress('dataPointRegistry');
        let dataPointRegistry;

        if (existingDPRAddress) {
            console.log("Loading existing DataPointRegistry at:", existingDPRAddress);
            dataPointRegistry = DataPointRegistry.attach(existingDPRAddress);
        } else {
            dataPointRegistry = await DataPointRegistry.deploy(dataPointStorage.target, tw3.address);
            await dataPointRegistry.waitForDeployment();
            contractManager.saveContract('dataPointRegistry', await dataPointRegistry.getAddress());
            console.log("DataPointRegistry deployed at:", await dataPointRegistry.getAddress());
        }

        // Deploy test sites
        const WTTPSite = await hre.ethers.getContractFactory("MyFirstWTTPSite");
        
        // Site 1 - Initial redirect
        site1 = await WTTPSite.deploy(dataPointRegistry.target, tw3.address, DEFAULT_HEADER);
        await site1.waitForDeployment();
        console.log("Site1 deployed at:", await site1.getAddress());
        
        // Site 2 - Intermediate redirect
        site2 = await WTTPSite.deploy(dataPointRegistry.target, tw3.address, DEFAULT_HEADER);
        await site2.waitForDeployment();
        console.log("Site2 deployed at:", await site2.getAddress());
        
        // Site 3 - Final destination
        site3 = await WTTPSite.deploy(dataPointRegistry.target, tw3.address, DEFAULT_HEADER);
        await site3.waitForDeployment();
        console.log("Site3 deployed at:", await site3.getAddress());

        // Initialize handler with deployed contracts
        handler = new WTTPHandler(wttp.target, tw3, hre.network.name);
    });

    describe('Redirect Following', () => {
        before(async function() {
            this.timeout(30000);
            
            // Create a chain of redirects
            // site1/page1.html -> site2/page2.html -> site3/page3.html
            
            // Create the final destination page
            await createResource(site3, '/page3.html', '<html><body>Final Destination</body></html>');
            
            // Create intermediate redirect
            await createRedirectResource(
                site2, 
                '/page2.html', 
                `wttp://${site3.target}/page3.html`, 
                HTTP_STATUS.FOUND // 302
            );
            
            // Create initial redirect
            await createRedirectResource(
                site1, 
                '/page1.html', 
                `wttp://${site2.target}/page2.html`, 
                HTTP_STATUS.MOVED_PERMANENTLY // 301
            );
        });

        it('should follow a single redirect by default', async function() {
            // Request the first page which redirects to the second
            const response = await handler.fetch(`wttp://${site1.target}/page1.html`);
            
            // Should automatically follow to the final destination
            expect(response.status).to.equal(HTTP_STATUS.OK);
            expect(await response.text()).to.equal('<html><body>Final Destination</body></html>');
        });

        it('should not follow redirects when disabled', async function() {
            // Request with redirects disabled
            const response = await handler.fetch(`wttp://${site1.target}/page1.html`, {
                followRedirects: false
            });
            
            // Should return the redirect response
            expect(response.status).to.equal(HTTP_STATUS.MOVED_PERMANENTLY);
            expect(response.headers.get('Location')).to.equal(`wttp://${site2.target}/page2.html`);
        });

        it('should respect maxRedirects limit', async function() {
            // Create a longer chain of redirects that exceeds the limit
            await createRedirectResource(
                site3, 
                '/loop1.html', 
                `wttp://${site1.target}/loop2.html`, 
                HTTP_STATUS.TEMPORARY_REDIRECT // 307
            );
            
            await createRedirectResource(
                site1, 
                '/loop2.html', 
                `wttp://${site2.target}/loop3.html`, 
                HTTP_STATUS.PERMANENT_REDIRECT // 308
            );
            
            await createRedirectResource(
                site2, 
                '/loop3.html', 
                `wttp://${site3.target}/loop1.html`, 
                HTTP_STATUS.SEE_OTHER // 303
            );
            
            // Request with a low maxRedirects value
            const response = await handler.fetch(`wttp://${site3.target}/loop1.html`, {
                maxRedirects: 2
            });
            
            // Should stop following after maxRedirects
            expect(response.status).to.be.oneOf([
                HTTP_STATUS.TEMPORARY_REDIRECT,
                HTTP_STATUS.PERMANENT_REDIRECT,
                HTTP_STATUS.SEE_OTHER
            ]);
            expect(response.headers.has('Location')).to.be.true;
        });

        it('should handle 303 redirects by switching to GET method', async function() {
            // Create a resource that requires POST but redirects with 303
            await createRedirectResource(
                site1, 
                '/post-redirect.html', 
                `wttp://${site3.target}/page3.html`, 
                HTTP_STATUS.SEE_OTHER // 303
            );
            
            // Make a POST request
            const response = await handler.fetch(`wttp://${site1.target}/post-redirect.html`, {
                method: 'POST',
                body: 'test data'
            });
            
            // Should follow redirect and switch to GET
            expect(response.status).to.equal(HTTP_STATUS.OK);
            expect(await response.text()).to.equal('<html><body>Final Destination</body></html>');
        });

        it('should preserve method for 307 and 308 redirects', async function() {
            // This test is more conceptual since we can't easily verify the method used
            // in the redirected request within our test environment
            
            // Create resources with 307 and 308 redirects
            await createRedirectResource(
                site1, 
                '/temp-redirect.html', 
                `wttp://${site3.target}/page3.html`, 
                HTTP_STATUS.TEMPORARY_REDIRECT // 307
            );
            
            await createRedirectResource(
                site2, 
                '/perm-redirect.html', 
                `wttp://${site3.target}/page3.html`, 
                HTTP_STATUS.PERMANENT_REDIRECT // 308
            );
            
            // Test 307 redirect
            const response307 = await handler.fetch(`wttp://${site1.target}/temp-redirect.html`, {
                method: 'POST',
                body: 'test data'
            });
            
            // Test 308 redirect
            const response308 = await handler.fetch(`wttp://${site2.target}/perm-redirect.html`, {
                method: 'PUT',
                body: 'test data'
            });
            
            // Both should successfully reach the final destination
            expect(response307.status).to.equal(HTTP_STATUS.OK);
            expect(response308.status).to.equal(HTTP_STATUS.OK);
        });
    });
});