// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract StatusMap is Ownable {
    // Mapping to store status codes and their reason phrases
    mapping(uint16 => string) private statusCodeToReasonPhrase;
    
    // Mapping to store reason phrases and their status codes
    mapping(string => uint16) private reasonPhraseToStatusCode;

    constructor() Ownable(msg.sender) {
        // 1xx Informational
        setStatus(100, "Continue");
        setStatus(101, "Switching Protocols");
        setStatus(102, "Processing");
        setStatus(103, "Early Hints");

        // 2xx Successful
        setStatus(200, "OK");
        setStatus(201, "Created");
        setStatus(202, "Accepted");
        setStatus(203, "Non-Authoritative Information");
        setStatus(204, "No Content");
        setStatus(205, "Reset Content");
        setStatus(206, "Partial Content");
        setStatus(207, "Multi-Status");
        setStatus(208, "Already Reported");
        setStatus(226, "IM Used");

        // 3xx Redirection
        setStatus(300, "Multiple Choices");
        setStatus(301, "Moved Permanently");
        setStatus(302, "Found");
        setStatus(303, "See Other");
        setStatus(304, "Not Modified");
        setStatus(305, "Use Proxy");
        setStatus(307, "Temporary Redirect");
        setStatus(308, "Permanent Redirect");
        setStatus(309, "Off-Chain Redirect");

        // 4xx Client Error
        setStatus(400, "Bad Request");
        setStatus(401, "Unauthorized");
        setStatus(402, "Payment Required");
        setStatus(403, "Forbidden");
        setStatus(404, "Not Found");
        setStatus(405, "Method Not Allowed");
        setStatus(406, "Not Acceptable");
        setStatus(407, "Proxy Authentication Required");
        setStatus(408, "Request Timeout");
        setStatus(409, "Conflict");
        setStatus(410, "Gone");
        setStatus(411, "Length Required");
        setStatus(412, "Precondition Failed");
        setStatus(413, "Payload Too Large");
        setStatus(414, "URI Too Long");
        setStatus(415, "Unsupported Media Type");
        setStatus(416, "Range Not Satisfiable");
        setStatus(417, "Expectation Failed");
        setStatus(418, "I'm a Teapot");
        setStatus(421, "Misdirected Request");
        setStatus(422, "Unprocessable Entity");
        setStatus(423, "Locked");
        setStatus(424, "Failed Dependency");
        setStatus(425, "Too Early");
        setStatus(426, "Upgrade Required");
        setStatus(428, "Precondition Required");
        setStatus(429, "Too Many Requests");
        setStatus(431, "Request Header Fields Too Large");
        setStatus(451, "Unavailable For Legal Reasons");

        // 5xx Server Error
        setStatus(500, "Internal Server Error");
        setStatus(501, "Not Implemented");
        setStatus(502, "Bad Gateway");
        setStatus(503, "Service Unavailable");
        setStatus(504, "Gateway Timeout");
        setStatus(505, "HTTP Version Not Supported");
        setStatus(506, "Variant Also Negotiates");
        setStatus(507, "Insufficient Storage");
        setStatus(508, "Loop Detected");
        setStatus(510, "Not Extended");
        setStatus(511, "Network Authentication Required");
    }

    /**
     * @dev Sets a status mapping for both status code to reason phrase and vice versa.
     * Callable only by the owner.
     * @param statusCode The uint16 status code.
     * @param reasonPhrase The string representation of the reason phrase.
     */
    function setStatus(
        uint16 statusCode,
        string memory reasonPhrase
    ) public onlyOwner {
        require(
            bytes(statusCodeToReasonPhrase[statusCode]).length == 0,
            "StatusMap: Status code already exists"
        );
        require(
            reasonPhraseToStatusCode[reasonPhrase] == 0,
            "StatusMap: Reason phrase already assigned"
        );
        statusCodeToReasonPhrase[statusCode] = reasonPhrase;
        reasonPhraseToStatusCode[reasonPhrase] = statusCode;
    }

    /**
     * @dev Retrieves the reason phrase for a given status code.
     * @param statusCode The uint16 status code.
     * @return The corresponding reason phrase.
     */
    function getReasonPhrase(uint16 statusCode) public view returns (string memory) {
        string memory reasonPhrase = statusCodeToReasonPhrase[statusCode];
        require(bytes(reasonPhrase).length != 0, "StatusMap: Status code not found");
        return reasonPhrase;
    }

    /**
     * @dev Retrieves the status code for a given reason phrase.
     * @param reasonPhrase The reason phrase string.
     * @return The corresponding uint16 status code.
     */
    function getStatusCode(string memory reasonPhrase) public view returns (uint16) {
        uint16 statusCode = reasonPhraseToStatusCode[reasonPhrase];
        require(statusCode != 0, "StatusMap: Reason phrase not found");
        return statusCode;
    }
}
