// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

enum TypeCategory {
    MIME_TYPE,
    CHARSET_TYPE,
    LOCATION_TYPE,
    LANGUAGE_TYPE
}

contract TypeMap is Ownable {
    // Unified mappings for type conversions
    mapping(TypeCategory => mapping(string => bytes2))
        private typeStringToBytes;
    mapping(TypeCategory => mapping(bytes2 => string))
        private typeBytesToString;
    
    mapping(TypeCategory => uint16) private typeEnumCount;
    mapping(TypeCategory => mapping(uint16 => bytes2))
        private typeEnumToBytes;

    constructor() Ownable(msg.sender) {
        // Initialize MIME types
        // Text types
        setType(TypeCategory.MIME_TYPE, "text/plain", 0x7470);
        setType(TypeCategory.MIME_TYPE, "text/html", 0x7468);
        setType(TypeCategory.MIME_TYPE, "text/css", 0x7463);
        setType(TypeCategory.MIME_TYPE, "text/javascript", 0x7473);
        setType(TypeCategory.MIME_TYPE, "text/markdown", 0x746D);
        setType(TypeCategory.MIME_TYPE, "text/xml", 0x7478);
        setType(TypeCategory.MIME_TYPE, "text/csv", 0x7467); // Added
        setType(TypeCategory.MIME_TYPE, "text/calendar", 0x7443); // Added

        // Application types
        setType(TypeCategory.MIME_TYPE, "application/json", 0x786A);
        setType(TypeCategory.MIME_TYPE, "application/xml", 0x7878);
        setType(TypeCategory.MIME_TYPE, "application/pdf", 0x7870); // Added
        setType(TypeCategory.MIME_TYPE, "application/zip", 0x787A); // Added
        setType(TypeCategory.MIME_TYPE, "application/octet-stream", 0x786F); // Added
        setType(
            TypeCategory.MIME_TYPE,
            "application/x-www-form-urlencoded",
            0x7877
        ); // Added
        setType(TypeCategory.MIME_TYPE, "application/vnd.ms-excel", 0x7865); // Added
        setType(
            TypeCategory.MIME_TYPE,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            0x7866
        ); // Added

        // Image types
        setType(TypeCategory.MIME_TYPE, "image/png", 0x6970);
        setType(TypeCategory.MIME_TYPE, "image/jpeg", 0x696A);
        setType(TypeCategory.MIME_TYPE, "image/gif", 0x6967);
        setType(TypeCategory.MIME_TYPE, "image/webp", 0x6977);
        setType(TypeCategory.MIME_TYPE, "image/svg+xml", 0x6973);
        setType(TypeCategory.MIME_TYPE, "image/bmp", 0x6962); // Added
        setType(TypeCategory.MIME_TYPE, "image/tiff", 0x6974); // Added
        setType(TypeCategory.MIME_TYPE, "image/ico", 0x6969); // Added

        // Audio types
        setType(TypeCategory.MIME_TYPE, "audio/mpeg", 0x616D); // Added
        setType(TypeCategory.MIME_TYPE, "audio/wav", 0x6177); // Added
        setType(TypeCategory.MIME_TYPE, "audio/ogg", 0x616F); // Added

        // Video types
        setType(TypeCategory.MIME_TYPE, "video/mp4", 0x766D); // Added
        setType(TypeCategory.MIME_TYPE, "video/webm", 0x7677); // Added
        setType(TypeCategory.MIME_TYPE, "video/ogg", 0x766F); // Added

        // Multipart types
        setType(TypeCategory.MIME_TYPE, "multipart/form-data", 0x7066); // Added
        setType(TypeCategory.MIME_TYPE, "multipart/byteranges", 0x7062);

        // Initialize encoding types
        setType(TypeCategory.CHARSET_TYPE, "utf-8", 0x7508);
        setType(TypeCategory.CHARSET_TYPE, "utf-16", 0x7516);
        setType(TypeCategory.CHARSET_TYPE, "utf-32", 0x7532);
        setType(TypeCategory.CHARSET_TYPE, "utf-32be", 0x7533);
        setType(TypeCategory.CHARSET_TYPE, "base64", 0x6264);
        setType(TypeCategory.CHARSET_TYPE, "base64url", 0x6265);
        setType(TypeCategory.CHARSET_TYPE, "base58", 0x6258);
        setType(TypeCategory.CHARSET_TYPE, "base32", 0x6232);
        setType(TypeCategory.CHARSET_TYPE, "hex", 0x6216);
        setType(TypeCategory.CHARSET_TYPE, "ascii", 0x6173); // Added
        setType(TypeCategory.CHARSET_TYPE, "iso-8859-1", 0x6973); // Added
        setType(TypeCategory.CHARSET_TYPE, "latin1", 0x6C31); // Added
        setType(TypeCategory.CHARSET_TYPE, "utf-7", 0x7507); // Added
        setType(TypeCategory.CHARSET_TYPE, "ucs-2", 0x7563); // Added

        // Initialize location types (unchanged from previous)
        setType(TypeCategory.LOCATION_TYPE, "datapoint/chunk", 0x0101);
        setType(TypeCategory.LOCATION_TYPE, "datapoint/collection", 0x0102);
        setType(TypeCategory.LOCATION_TYPE, "datapoint/file", 0x0103);
        setType(TypeCategory.LOCATION_TYPE, "datapoint/directory", 0x0104);
        setType(TypeCategory.LOCATION_TYPE, "datapoint/link", 0x0105);
        setType(TypeCategory.LOCATION_TYPE, "http/url", 0x0201);
        setType(TypeCategory.LOCATION_TYPE, "http/secure-url", 0x0202);
        setType(TypeCategory.LOCATION_TYPE, "ipfs/file-id", 0x0303);
        setType(TypeCategory.LOCATION_TYPE, "ipfs/folder-id", 0x0304);
        setType(TypeCategory.LOCATION_TYPE, "arweave/file-id", 0x0403);
        setType(TypeCategory.LOCATION_TYPE, "arweave/folder-id", 0x0404);
        setType(TypeCategory.LOCATION_TYPE, "ordinals/chunk-id", 0x0501);
        setType(TypeCategory.LOCATION_TYPE, "ordinals/collection-id", 0x0502);
        setType(TypeCategory.LOCATION_TYPE, "ordinals/file-id", 0x0503);
        setType(TypeCategory.LOCATION_TYPE, "ordinals/directory-id", 0x0504);
        setType(TypeCategory.LOCATION_TYPE, "icp/link", 0x0605);
    }

    /**
     * @dev Sets a type mapping for both string to bytes and bytes to string.
     * Callable only by the owner.
     * @param category The category of the type (MIME_TYPE, ENCODING_TYPE, LOCATION_TYPE).
     * @param typeName The string representation of the type.
     * @param typeValue The bytes2 representation of the type.
     */
    function setType(
        TypeCategory category,
        string memory typeName,
        bytes2 typeValue
    ) public onlyOwner {
        require(
            typeStringToBytes[category][typeName] == 0x0000,
            "MAP: Type already exists"
        );
        require(
            bytes(typeBytesToString[category][typeValue]).length == 0,
            "MAP: Byte value already assigned"
        );
        typeStringToBytes[category][typeName] = typeValue;
        typeBytesToString[category][typeValue] = typeName;
        typeEnumToBytes[category][typeEnumCount[category]] = typeValue;
        typeEnumCount[category]++;
    }

    /**
     * @dev Retrieves the bytes2 representation of a type given its string name.
     * @param category The category of the type.
     * @param typeName The string representation of the type.
     * @return The bytes2 representation of the type.
     */
    function getTypeBytes(
        TypeCategory category,
        string memory typeName
    ) public view returns (bytes2) {
        bytes2 value = typeStringToBytes[category][typeName];
        require(value != 0x0000, "MAP: Type bytes not found");
        return value;
    }

    /**
     * @dev Retrieves the string representation of a type given its bytes2 value.
     * @param category The category of the type.
     * @param typeValue The bytes2 representation of the type.
     * @return The string representation of the type.
     */
    function getTypeString(
        TypeCategory category,
        bytes2 typeValue
    ) public view returns (string memory) {
        string memory name = typeBytesToString[category][typeValue];
        require(bytes(name).length != 0, "MAP: Type string not found");
        return name;
    }

    function getTypeEnum(TypeCategory category, uint16 index) public view returns (bytes2) {
        require(index < typeEnumCount[category], "MAP: Invalid index");
        return typeEnumToBytes[category][index];
    }
}
