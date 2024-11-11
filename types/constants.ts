// MIME Types
export const MIME_TYPES = {
    // Text types
    TEXT_PLAIN: '0x7470',
    TEXT_HTML: '0x7468',
    TEXT_CSS: '0x7463',
    TEXT_JAVASCRIPT: '0x7473',
    TEXT_MARKDOWN: '0x746D',
    TEXT_XML: '0x7478',
    TEXT_CSV: '0x7467',
    TEXT_CALENDAR: '0x7443',

    // Application types
    APPLICATION_JSON: '0x786A',
    APPLICATION_XML: '0x7878',
    APPLICATION_PDF: '0x7870',
    APPLICATION_ZIP: '0x787A',
    APPLICATION_OCTET_STREAM: '0x786F',
    APPLICATION_FORM_URLENCODED: '0x7877',
    APPLICATION_MS_EXCEL: '0x7865',
    APPLICATION_XLSX: '0x7866',

    // Image types
    IMAGE_PNG: '0x6970',
    IMAGE_JPEG: '0x696A',
    IMAGE_GIF: '0x6967',
    IMAGE_WEBP: '0x6977',
    IMAGE_SVG: '0x6973',
    IMAGE_BMP: '0x6962',
    IMAGE_TIFF: '0x6974',
    IMAGE_ICO: '0x6969',

    // Audio types
    AUDIO_MPEG: '0x616D',
    AUDIO_WAV: '0x6177',
    AUDIO_OGG: '0x616F',

    // Video types
    VIDEO_MP4: '0x766D',
    VIDEO_WEBM: '0x7677',
    VIDEO_OGG: '0x766F',

    // Multipart types
    MULTIPART_FORM_DATA: '0x7066',
    MULTIPART_BYTERANGES: '0x7062'
} as const;

// Charset Types
export const CHARSET_TYPES = {
    UTF_8: '0x7508',
    UTF_16: '0x7516',
    UTF_32: '0x7532',
    UTF_32BE: '0x7533',
    BASE64: '0x6264',
    BASE64URL: '0x6265',
    BASE58: '0x6258',
    BASE32: '0x6232',
    HEX: '0x6216',
    ASCII: '0x6173',
    ISO_8859_1: '0x6973',
    LATIN1: '0x6C31',
    UTF_7: '0x7507',
    UCS_2: '0x7563'
} as const;

// Location Types
export const LOCATION_TYPES = {
    DATAPOINT_CHUNK: '0x0101',
    DATAPOINT_COLLECTION: '0x0102',
    DATAPOINT_FILE: '0x0103',
    DATAPOINT_DIRECTORY: '0x0104',
    DATAPOINT_LINK: '0x0105',
    HTTP_URL: '0x0201',
    HTTP_SECURE_URL: '0x0202',
    IPFS_FILE_ID: '0x0303',
    IPFS_FOLDER_ID: '0x0304',
    ARWEAVE_FILE_ID: '0x0403',
    ARWEAVE_FOLDER_ID: '0x0404',
    ORDINALS_CHUNK_ID: '0x0501',
    ORDINALS_COLLECTION_ID: '0x0502',
    ORDINALS_FILE_ID: '0x0503',
    ORDINALS_DIRECTORY_ID: '0x0504',
    ICP_LINK: '0x0605'
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
    // 1xx Informational
    CONTINUE: 100,
    SWITCHING_PROTOCOLS: 101,
    PROCESSING: 102,
    EARLY_HINTS: 103,

    // 2xx Success
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NON_AUTHORITATIVE_INFORMATION: 203,
    NO_CONTENT: 204,
    RESET_CONTENT: 205,
    PARTIAL_CONTENT: 206,
    MULTI_STATUS: 207,
    ALREADY_REPORTED: 208,
    IM_USED: 226,

    // 3xx Redirection
    MULTIPLE_CHOICES: 300,
    MOVED_PERMANENTLY: 301,
    FOUND: 302,
    SEE_OTHER: 303,
    NOT_MODIFIED: 304,
    USE_PROXY: 305,
    TEMPORARY_REDIRECT: 307,
    PERMANENT_REDIRECT: 308,
    OFF_CHAIN_REDIRECT: 309,

    // 4xx Client Error
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    PAYMENT_REQUIRED: 402,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    NOT_ACCEPTABLE: 406,
    PROXY_AUTHENTICATION_REQUIRED: 407,
    REQUEST_TIMEOUT: 408,
    CONFLICT: 409,
    GONE: 410,
    LENGTH_REQUIRED: 411,
    PRECONDITION_FAILED: 412,
    PAYLOAD_TOO_LARGE: 413,
    URI_TOO_LONG: 414,
    UNSUPPORTED_MEDIA_TYPE: 415,
    RANGE_NOT_SATISFIABLE: 416,
    EXPECTATION_FAILED: 417,
    IM_A_TEAPOT: 418,
    MISDIRECTED_REQUEST: 421,
    UNPROCESSABLE_ENTITY: 422,
    LOCKED: 423,
    FAILED_DEPENDENCY: 424,
    TOO_EARLY: 425,
    UPGRADE_REQUIRED: 426,
    PRECONDITION_REQUIRED: 428,
    TOO_MANY_REQUESTS: 429,
    REQUEST_HEADER_FIELDS_TOO_LARGE: 431,
    UNAVAILABLE_FOR_LEGAL_REASONS: 451,

    // 5xx Server Error
    INTERNAL_SERVER_ERROR: 500,
    NOT_IMPLEMENTED: 501,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504,
    HTTP_VERSION_NOT_SUPPORTED: 505,
    VARIANT_ALSO_NEGOTIATES: 506,
    INSUFFICIENT_STORAGE: 507,
    LOOP_DETECTED: 508,
    NOT_EXTENDED: 510,
    NETWORK_AUTHENTICATION_REQUIRED: 511
} as const;

// Type Categories (from the TypeCategory enum)
export const TYPE_CATEGORY = {
    MIME_TYPE: 0,
    CHARSET_TYPE: 1,
    LOCATION_TYPE: 2,
    LANGUAGE_TYPE: 3
} as const;

// These will be key contract addresses for the WTTP protocol
export const WTTP_CONTRACT = '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853' as const;
export const DATAPOINT_REGISTRY = '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707' as const;

// Deploying contracts with account: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
// DataPointStorage deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
// DataPointRegistry deployed to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
// WTTPBaseMethods deployed to: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
// WTTP deployed to: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9

// Default header for WTTP contracts
export const DEFAULT_HEADER = {
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
    methods: 0, // Will be set to default 2913 in contract
    redirect: {
        code: 0,
        location: ""
    },
    resourceAdmin: "0x0000000000000000000000000000000000000000000000000000000000000000"
} as const;