#include <gtest/gtest.h>
#include "../WTTPHandler.hpp"
#include <web3cpp/Web3.h>
#include <memory>

class WTTPHandlerTest : public ::testing::Test {
protected:
    void SetUp() override {
        // Setup provider and signer
        provider = std::make_shared<Web3::Provider>("http://localhost:8545");
        signer = std::make_shared<Web3::Signer>(provider);

        // Deploy contracts (similar to deployFixture in TypeScript)
        auto dataPointStorage = deployContract("DataPointStorage");
        auto dataPointRegistry = deployContract("DataPointRegistry", 
            dataPointStorage->address(), signer->address());
        
        auto wttpBaseMethods = deployContract("Dev_WTTPBaseMethods",
            dataPointRegistry->address(), 
            signer->address(),
            createDefaultHeader());

        auto wttp = deployContract("WTTP");

        // Create handler
        handler = std::make_unique<WTTPHandler>(
            wttp,
            wttpBaseMethods->address(),
            wttpBaseMethods->interface(),
            signer
        );
    }

    HeaderInfo createDefaultHeader() {
        return HeaderInfo{
            /* cache */ "",
            /* methods */ 2913,  // Default methods
            /* redirect */ "",
            /* resourceAdmin */ "0x0000000000000000000000000000000000000000"
        };
    }

    std::shared_ptr<Web3::Contract> deployContract(
        const std::string& name,
        const std::string& arg1 = "",
        const std::string& arg2 = "",
        const HeaderInfo& header = HeaderInfo()
    ) {
        // Implementation would use Web3 C++ library to deploy contracts
        return std::make_shared<Web3::Contract>("address", "abi", signer);
    }

    std::shared_ptr<Web3::Provider> provider;
    std::shared_ptr<Web3::Signer> signer;
    std::unique_ptr<WTTPHandler> handler;
};

TEST_F(WTTPHandlerTest, CreateAndRetrieveHelloWorld) {
    // HTML content
    std::string htmlContent = R"(
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
</html>)";

    // JavaScript content
    std::string jsContent = R"(
function updateTime() {
    const timeElement = document.getElementById('time');
    timeElement.textContent = new Date().toLocaleTimeString();
}

updateTime();
setInterval(updateTime, 1000);)";

    // Put the HTML file
    handler->put("/index.html", htmlContent, "TEXT_HTML", "UTF_8");

    // Put the JavaScript file
    handler->put("/script.js", jsContent, "TEXT_JAVASCRIPT", "UTF_8");

    // Get and verify HTML content
    auto htmlResponse = handler->get("/index.html");
    EXPECT_EQ(htmlResponse.head.responseLine.code, 200);
    EXPECT_EQ(htmlResponse.body, htmlContent);

    // Get and verify JavaScript content
    auto jsResponse = handler->get("/script.js");
    EXPECT_EQ(jsResponse.head.responseLine.code, 200);
    EXPECT_EQ(jsResponse.body, jsContent);
}

TEST_F(WTTPHandlerTest, MultiPartResource) {
    std::string part1 = "<html><body>First part";
    std::string part2 = " Second part";
    std::string part3 = " Third part</body></html>";

    // Initial PUT
    handler->put("/multipart.html", part1, "TEXT_HTML", "UTF_8");

    // PATCH remaining parts
    handler->patch("/multipart.html", part2, 1);
    handler->patch("/multipart.html", part3, 2);

    // Get and verify complete content
    auto response = handler->get("/multipart.html");
    EXPECT_EQ(response.head.responseLine.code, 200);
    EXPECT_EQ(response.body, part1 + part2 + part3);
} 