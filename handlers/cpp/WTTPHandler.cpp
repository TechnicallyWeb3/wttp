#include "WTTPHandler.hpp"
#include <web3/Utils.h>
#include <stdexcept>

WTTPHandler::WTTPHandler(
    std::shared_ptr<Web3::Contract> wttp,
    const std::string& contractAddress,
    const std::string& abi,
    std::shared_ptr<Web3::Signer> signer
) : wttp_(wttp), signer_(signer) {
    contract_ = std::make_shared<Web3::Contract>(contractAddress, abi, signer);
}

GETResponse WTTPHandler::get(
    const std::string& path,
    uint32_t rangeStart,
    uint32_t rangeEnd,
    const std::string& ifNoneMatch,
    uint64_t ifModifiedSince
) {
    RequestLine requestLine{
        "WTTP/2.0",
        path
    };

    RequestHeader requestHeader{
        {},  // accept
        {},  // acceptCharset
        {},  // acceptLanguage
        ifModifiedSince,
        ifNoneMatch
    };

    GETRequest getRequest{
        contract_->address(),
        rangeStart,
        rangeEnd
    };

    auto response = wttp_->call("GET", {
        Web3::toJson(requestLine),
        Web3::toJson(requestHeader),
        Web3::toJson(getRequest)
    });

    return processResponse(response);
}

void WTTPHandler::put(
    const std::string& path,
    const std::string& content,
    const std::string& mimeType,
    const std::string& charset
) {
    RequestLine requestLine{
        "WTTP/2.0",
        path
    };

    auto result = contract_->send("PUT", {
        Web3::toJson(requestLine),
        Web3::toBytes(mimeType),
        Web3::toBytes(charset),
        Web3::toBytes("0x0101"),  // LOCATION_TYPES.DATAPOINT_CHUNK
        signer_->address(),
        Web3::toBytes(content)
    });

    validateResponse(result);
}

void WTTPHandler::patch(
    const std::string& path,
    const std::string& content,
    uint32_t chunkIndex
) {
    RequestLine requestLine{
        "WTTP/2.0",
        path
    };

    auto result = contract_->send("PATCH", {
        Web3::toJson(requestLine),
        Web3::toBytes(content),
        chunkIndex,
        signer_->address()
    });

    validateResponse(result);
}

HEADResponse WTTPHandler::head(const std::string& path) {
    RequestLine requestLine{
        "WTTP/2.0",
        path
    };

    auto response = contract_->call("HEAD", {Web3::toJson(requestLine)});
    return processHeadResponse(response);
}

GETResponse WTTPHandler::processResponse(const Web3::Json& response) {
    auto headArray = response[0];
    auto bodyHex = response[1];

    HEADResponse head{
        {headArray[0][0], std::stoi(headArray[0][1])},  // responseLine
        {headArray[1][0], std::stoi(headArray[1][1]), headArray[1][2], headArray[1][3]},  // headerInfo
        {std::stoul(headArray[2][0]), std::stoul(headArray[2][1]), std::stoul(headArray[2][2])},  // metadata
        {std::stoul(headArray[3][0]), headArray[3][1], headArray[3][2], headArray[3][3]},  // dataStructure
        headArray[4]  // etag
    };

    if (head.responseLine.code == 200 || head.responseLine.code == 206) {
        const auto& mimeType = head.dataStructure.mimeType;
        const auto& charset = head.dataStructure.charset;

        std::vector<std::string> textBasedTypes = {
            "TEXT_PLAIN", "TEXT_HTML", "TEXT_CSS", "TEXT_JAVASCRIPT",
            "TEXT_XML", "APPLICATION_JSON", "APPLICATION_XML"
        };

        bool isTextBased = std::find(textBasedTypes.begin(), textBasedTypes.end(), mimeType) != textBasedTypes.end();

        if (isTextBased && !bodyHex.empty()) {
            return {head, decodeContent(bodyHex, charset)};
        }
    }

    return {head, bodyHex};
}

// ... Additional implementation methods would go here ...
