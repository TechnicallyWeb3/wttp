#pragma once

#include <string>
#include <vector>
#include <memory>
#include <web3/Web3.h>
#include <web3/Contract.h>

struct RequestLine {
    std::string protocol;
    std::string path;
};

struct RequestHeader {
    std::vector<std::string> accept;
    std::vector<std::string> acceptCharset;
    std::vector<std::string> acceptLanguage;
    uint64_t ifModifiedSince;
    std::string ifNoneMatch;
};

struct GETRequest {
    std::string host;
    uint32_t rangeStart;
    uint32_t rangeEnd;
};

struct HeaderInfo {
    std::string cache;
    uint16_t methods;
    std::string redirect;
    std::string resourceAdmin;
};

struct ResponseLine {
    std::string protocol;
    uint16_t code;
};

struct DataStructure {
    uint64_t size;
    std::string mimeType;
    std::string charset;
    std::string location;
};

struct Metadata {
    uint64_t size;
    uint64_t version;
    uint64_t modifiedDate;
};

struct HEADResponse {
    ResponseLine responseLine;
    HeaderInfo headerInfo;
    Metadata metadata;
    DataStructure dataStructure;
    std::string etag;
};

struct GETResponse {
    HEADResponse head;
    std::string body;
};

class WTTPHandler {
public:
    WTTPHandler(
        std::shared_ptr<Web3::Contract> wttp,
        const std::string& contractAddress,
        const std::string& abi,
        std::shared_ptr<Web3::Signer> signer
    );

    GETResponse get(
        const std::string& path,
        uint32_t rangeStart = 0,
        uint32_t rangeEnd = 0,
        const std::string& ifNoneMatch = "",
        uint64_t ifModifiedSince = 0
    );

    void put(
        const std::string& path,
        const std::string& content,
        const std::string& mimeType = "TEXT_PLAIN",
        const std::string& charset = "UTF_8"
    );

    void patch(
        const std::string& path,
        const std::string& content,
        uint32_t chunkIndex
    );

    HEADResponse head(const std::string& path);

private:
    std::shared_ptr<Web3::Contract> wttp_;
    std::shared_ptr<Web3::Contract> contract_;
    std::shared_ptr<Web3::Signer> signer_;

    GETResponse processResponse(const Web3::Json& response);
    HEADResponse processHeadResponse(const Web3::Json& response);
    std::string decodeContent(const std::string& content, const std::string& charset);
    void validateResponse(const Web3::Json& response);
}; 