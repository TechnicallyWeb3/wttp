import { ZeroAddress } from 'ethers';

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

// Reverse mapping for traditional MIME type strings
export const MIME_TYPE_STRINGS = {
    'text/plain': MIME_TYPES.TEXT_PLAIN,
    'text/html': MIME_TYPES.TEXT_HTML,
    'text/css': MIME_TYPES.TEXT_CSS,
    'text/javascript': MIME_TYPES.TEXT_JAVASCRIPT,
    'text/markdown': MIME_TYPES.TEXT_MARKDOWN,
    'text/xml': MIME_TYPES.TEXT_XML,
    'text/csv': MIME_TYPES.TEXT_CSV,
    'text/calendar': MIME_TYPES.TEXT_CALENDAR,
    
    'application/json': MIME_TYPES.APPLICATION_JSON,
    'application/xml': MIME_TYPES.APPLICATION_XML,
    'application/pdf': MIME_TYPES.APPLICATION_PDF,
    'application/zip': MIME_TYPES.APPLICATION_ZIP,
    'application/octet-stream': MIME_TYPES.APPLICATION_OCTET_STREAM,
    'application/x-www-form-urlencoded': MIME_TYPES.APPLICATION_FORM_URLENCODED,
    'application/vnd.ms-excel': MIME_TYPES.APPLICATION_MS_EXCEL,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': MIME_TYPES.APPLICATION_XLSX,
    
    'image/png': MIME_TYPES.IMAGE_PNG,
    'image/jpeg': MIME_TYPES.IMAGE_JPEG,
    'image/gif': MIME_TYPES.IMAGE_GIF,
    'image/webp': MIME_TYPES.IMAGE_WEBP,
    'image/svg+xml': MIME_TYPES.IMAGE_SVG,
    'image/bmp': MIME_TYPES.IMAGE_BMP,
    'image/tiff': MIME_TYPES.IMAGE_TIFF,
    'image/x-icon': MIME_TYPES.IMAGE_ICO,
    
    'audio/mpeg': MIME_TYPES.AUDIO_MPEG,
    'audio/wav': MIME_TYPES.AUDIO_WAV,
    'audio/ogg': MIME_TYPES.AUDIO_OGG,
    
    'video/mp4': MIME_TYPES.VIDEO_MP4,
    'video/webm': MIME_TYPES.VIDEO_WEBM,
    'video/ogg': MIME_TYPES.VIDEO_OGG,
    
    'multipart/form-data': MIME_TYPES.MULTIPART_FORM_DATA,
    'multipart/byteranges': MIME_TYPES.MULTIPART_BYTERANGES
} as const;

// Reverse mapping for MIME type bytes
export const MIME_BYTES = {
    [MIME_TYPES.TEXT_PLAIN]: 'text/plain',
    [MIME_TYPES.TEXT_HTML]: 'text/html',
    [MIME_TYPES.TEXT_CSS]: 'text/css',
    [MIME_TYPES.TEXT_JAVASCRIPT]: 'text/javascript',
    [MIME_TYPES.TEXT_MARKDOWN]: 'text/markdown',
    [MIME_TYPES.TEXT_XML]: 'text/xml',
    [MIME_TYPES.TEXT_CSV]: 'text/csv',
    [MIME_TYPES.TEXT_CALENDAR]: 'text/calendar',

    [MIME_TYPES.APPLICATION_JSON]: 'application/json',
    [MIME_TYPES.APPLICATION_XML]: 'application/xml',
    [MIME_TYPES.APPLICATION_PDF]: 'application/pdf',
    [MIME_TYPES.APPLICATION_ZIP]: 'application/zip',
    [MIME_TYPES.APPLICATION_OCTET_STREAM]: 'application/octet-stream',
    [MIME_TYPES.APPLICATION_FORM_URLENCODED]: 'application/x-www-form-urlencoded',
    [MIME_TYPES.APPLICATION_MS_EXCEL]: 'application/vnd.ms-excel',
    [MIME_TYPES.APPLICATION_XLSX]: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

    [MIME_TYPES.IMAGE_PNG]: 'image/png',
    [MIME_TYPES.IMAGE_JPEG]: 'image/jpeg',
    [MIME_TYPES.IMAGE_GIF]: 'image/gif',
    [MIME_TYPES.IMAGE_WEBP]: 'image/webp',
    [MIME_TYPES.IMAGE_SVG]: 'image/svg+xml',
    [MIME_TYPES.IMAGE_BMP]: 'image/bmp',
    [MIME_TYPES.IMAGE_TIFF]: 'image/tiff',
    [MIME_TYPES.IMAGE_ICO]: 'image/x-icon',

    [MIME_TYPES.AUDIO_MPEG]: 'audio/mpeg',
    [MIME_TYPES.AUDIO_WAV]: 'audio/wav',
    [MIME_TYPES.AUDIO_OGG]: 'audio/ogg',

    [MIME_TYPES.VIDEO_MP4]: 'video/mp4',
    [MIME_TYPES.VIDEO_WEBM]: 'video/webm',
    [MIME_TYPES.VIDEO_OGG]: 'video/ogg',

    [MIME_TYPES.MULTIPART_FORM_DATA]: 'multipart/form-data',
    [MIME_TYPES.MULTIPART_BYTERANGES]: 'multipart/byteranges'
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

// Reverse mapping for charset strings
export const CHARSET_STRINGS = {
    'utf-8': CHARSET_TYPES.UTF_8,
    'utf-16': CHARSET_TYPES.UTF_16,
    'utf-32': CHARSET_TYPES.UTF_32,
    'utf-32be': CHARSET_TYPES.UTF_32BE,
    'base64': CHARSET_TYPES.BASE64,
    'base64url': CHARSET_TYPES.BASE64URL,
    'base58': CHARSET_TYPES.BASE58,
    'base32': CHARSET_TYPES.BASE32,
    'hex': CHARSET_TYPES.HEX,
    'ascii': CHARSET_TYPES.ASCII,
    'iso-8859-1': CHARSET_TYPES.ISO_8859_1,
    'latin1': CHARSET_TYPES.LATIN1,
    'utf-7': CHARSET_TYPES.UTF_7,
    'ucs-2': CHARSET_TYPES.UCS_2
} as const;

// Reverse mapping for charset bytes
export const CHARSET_BYTES = {
    [CHARSET_TYPES.UTF_8]: 'utf-8',
    [CHARSET_TYPES.UTF_16]: 'utf-16',
    [CHARSET_TYPES.UTF_32]: 'utf-32',
    [CHARSET_TYPES.UTF_32BE]: 'utf-32be',
    [CHARSET_TYPES.BASE64]: 'base64',
    [CHARSET_TYPES.BASE64URL]: 'base64url',
    [CHARSET_TYPES.BASE58]: 'base58',
    [CHARSET_TYPES.BASE32]: 'base32',
    [CHARSET_TYPES.HEX]: 'hex',
    [CHARSET_TYPES.ASCII]: 'ascii',
    [CHARSET_TYPES.ISO_8859_1]: 'iso-8859-1',
    [CHARSET_TYPES.LATIN1]: 'latin1',
    [CHARSET_TYPES.UTF_7]: 'utf-7',
    [CHARSET_TYPES.UCS_2]: 'ucs-2'
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
    IPFS_DIRECTORY_ID: '0x0304',
    ARWEAVE_FILE_ID: '0x0403',
    ARWEAVE_DIRECTORY_ID: '0x0404',
    ORDINALS_CHUNK_ID: '0x0501',
    ORDINALS_COLLECTION_ID: '0x0502',
    ORDINALS_FILE_ID: '0x0503',
    ORDINALS_DIRECTORY_ID: '0x0504',
    ICP_LINK: '0x0605'
} as const;

// Reverse mapping for location strings
export const LOCATION_STRINGS = {
    'datapoint/chunk': LOCATION_TYPES.DATAPOINT_CHUNK,
    'datapoint/collection': LOCATION_TYPES.DATAPOINT_COLLECTION,
    'datapoint/file': LOCATION_TYPES.DATAPOINT_FILE,
    'datapoint/directory': LOCATION_TYPES.DATAPOINT_DIRECTORY,
    'datapoint/link': LOCATION_TYPES.DATAPOINT_LINK,
    'http': LOCATION_TYPES.HTTP_URL,
    'https': LOCATION_TYPES.HTTP_SECURE_URL,
    'ipfs/file': LOCATION_TYPES.IPFS_FILE_ID,
    'ipfs/directory': LOCATION_TYPES.IPFS_DIRECTORY_ID,
    'arweave/file': LOCATION_TYPES.ARWEAVE_FILE_ID,
    'arweave/directory': LOCATION_TYPES.ARWEAVE_DIRECTORY_ID,
    'ordinals/chunk': LOCATION_TYPES.ORDINALS_CHUNK_ID,
    'ordinals/collection': LOCATION_TYPES.ORDINALS_COLLECTION_ID,
    'ordinals/file': LOCATION_TYPES.ORDINALS_FILE_ID,
    'ordinals/directory': LOCATION_TYPES.ORDINALS_DIRECTORY_ID,
    'icp': LOCATION_TYPES.ICP_LINK
} as const;

// Reverse mapping for location bytes
export const LOCATION_BYTES = {
    [LOCATION_TYPES.DATAPOINT_CHUNK]: 'datapoint/chunk',
    [LOCATION_TYPES.DATAPOINT_COLLECTION]: 'datapoint/collection',
    [LOCATION_TYPES.DATAPOINT_FILE]: 'datapoint/file',
    [LOCATION_TYPES.DATAPOINT_DIRECTORY]: 'datapoint/directory',
    [LOCATION_TYPES.DATAPOINT_LINK]: 'datapoint/link',
    [LOCATION_TYPES.HTTP_URL]: 'http',
    [LOCATION_TYPES.HTTP_SECURE_URL]: 'https',
    [LOCATION_TYPES.IPFS_FILE_ID]: 'ipfs/file',
    [LOCATION_TYPES.IPFS_DIRECTORY_ID]: 'ipfs/directory',
    [LOCATION_TYPES.ARWEAVE_FILE_ID]: 'arweave/file',
    [LOCATION_TYPES.ARWEAVE_DIRECTORY_ID]: 'arweave/directory',
    [LOCATION_TYPES.ORDINALS_CHUNK_ID]: 'ordinals/chunk',
    [LOCATION_TYPES.ORDINALS_COLLECTION_ID]: 'ordinals/collection',
    [LOCATION_TYPES.ORDINALS_FILE_ID]: 'ordinals/file',
    [LOCATION_TYPES.ORDINALS_DIRECTORY_ID]: 'ordinals/directory',
    [LOCATION_TYPES.ICP_LINK]: 'icp'
} as const;

// Language Types
export const LANGUAGE_TYPES = {
    EN_US: '0x656E',
    EN_GB: '0x6567',
    ZH_CN: '0x7A68',
    ZH_TW: '0x7A74',
    JA_JP: '0x6A61',
    KO_KR: '0x6B6F',
    FR_FR: '0x6672',
    DE_DE: '0x6465',
    ES_ES: '0x6573',
    IT_IT: '0x6974',
    PT_PT: '0x7074',
    RU_RU: '0x7275'
} as const;

// Reverse mapping for language strings
export const LANGUAGE_STRINGS = {
    'en-us': LANGUAGE_TYPES.EN_US,
    'en-gb': LANGUAGE_TYPES.EN_GB,
    'zh-cn': LANGUAGE_TYPES.ZH_CN,
    'zh-tw': LANGUAGE_TYPES.ZH_TW,
    'ja-jp': LANGUAGE_TYPES.JA_JP,
    'ko-kr': LANGUAGE_TYPES.KO_KR,
    'fr-fr': LANGUAGE_TYPES.FR_FR,
    'de-de': LANGUAGE_TYPES.DE_DE,
    'es-es': LANGUAGE_TYPES.ES_ES,
    'it-it': LANGUAGE_TYPES.IT_IT,
    'pt-pt': LANGUAGE_TYPES.PT_PT,
    'ru-ru': LANGUAGE_TYPES.RU_RU
} as const;

// Reverse mapping for language bytes
export const LANGUAGE_BYTES = {
    [LANGUAGE_TYPES.EN_US]: 'en-us',
    [LANGUAGE_TYPES.EN_GB]: 'en-gb',
    [LANGUAGE_TYPES.ZH_CN]: 'zh-cn',
    [LANGUAGE_TYPES.ZH_TW]: 'zh-tw',
    [LANGUAGE_TYPES.JA_JP]: 'ja-jp',
    [LANGUAGE_TYPES.KO_KR]: 'ko-kr',
    [LANGUAGE_TYPES.FR_FR]: 'fr-fr',
    [LANGUAGE_TYPES.DE_DE]: 'de-de',
    [LANGUAGE_TYPES.ES_ES]: 'es-es',
    [LANGUAGE_TYPES.IT_IT]: 'it-it',
    [LANGUAGE_TYPES.PT_PT]: 'pt-pt',
    [LANGUAGE_TYPES.RU_RU]: 'ru-ru'
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

// Reverse mapping for HTTP status strings
export const HTTP_STATUS_STRINGS = {
    [HTTP_STATUS.CONTINUE]: 'Continue',
    [HTTP_STATUS.SWITCHING_PROTOCOLS]: 'Switching Protocols',
    [HTTP_STATUS.PROCESSING]: 'Processing',
    [HTTP_STATUS.EARLY_HINTS]: 'Early Hints',
    [HTTP_STATUS.OK]: 'OK',
    [HTTP_STATUS.CREATED]: 'Created',
    [HTTP_STATUS.ACCEPTED]: 'Accepted',
    [HTTP_STATUS.NON_AUTHORITATIVE_INFORMATION]: 'Non-Authoritative Information',
    [HTTP_STATUS.NO_CONTENT]: 'No Content',
    [HTTP_STATUS.RESET_CONTENT]: 'Reset Content',
    [HTTP_STATUS.PARTIAL_CONTENT]: 'Partial Content',
    [HTTP_STATUS.MULTI_STATUS]: 'Multi-Status',
    [HTTP_STATUS.ALREADY_REPORTED]: 'Already Reported',
    [HTTP_STATUS.IM_USED]: 'IM Used',
    [HTTP_STATUS.MULTIPLE_CHOICES]: 'Multiple Choices',
    [HTTP_STATUS.MOVED_PERMANENTLY]: 'Moved Permanently',
    [HTTP_STATUS.FOUND]: 'Found',
    [HTTP_STATUS.SEE_OTHER]: 'See Other',
    [HTTP_STATUS.NOT_MODIFIED]: 'Not Modified',
    [HTTP_STATUS.USE_PROXY]: 'Use Proxy',
    [HTTP_STATUS.TEMPORARY_REDIRECT]: 'Temporary Redirect',
    [HTTP_STATUS.PERMANENT_REDIRECT]: 'Permanent Redirect',
    [HTTP_STATUS.OFF_CHAIN_REDIRECT]: 'Off-Chain Redirect',
    [HTTP_STATUS.BAD_REQUEST]: 'Bad Request',
    [HTTP_STATUS.UNAUTHORIZED]: 'Unauthorized',
    [HTTP_STATUS.PAYMENT_REQUIRED]: 'Payment Required',
    [HTTP_STATUS.FORBIDDEN]: 'Forbidden',
    [HTTP_STATUS.NOT_FOUND]: 'Not Found',
    [HTTP_STATUS.METHOD_NOT_ALLOWED]: 'Method Not Allowed',
    [HTTP_STATUS.NOT_ACCEPTABLE]: 'Not Acceptable',
    [HTTP_STATUS.PROXY_AUTHENTICATION_REQUIRED]: 'Proxy Authentication Required',
    [HTTP_STATUS.REQUEST_TIMEOUT]: 'Request Timeout',
    [HTTP_STATUS.CONFLICT]: 'Conflict',
    [HTTP_STATUS.GONE]: 'Gone',
    [HTTP_STATUS.LENGTH_REQUIRED]: 'Length Required',
    [HTTP_STATUS.PRECONDITION_FAILED]: 'Precondition Failed',
    [HTTP_STATUS.PAYLOAD_TOO_LARGE]: 'Payload Too Large',
    [HTTP_STATUS.URI_TOO_LONG]: 'URI Too Long',
    [HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE]: 'Unsupported Media Type',
    [HTTP_STATUS.RANGE_NOT_SATISFIABLE]: 'Range Not Satisfiable',
    [HTTP_STATUS.EXPECTATION_FAILED]: 'Expectation Failed',
    [HTTP_STATUS.IM_A_TEAPOT]: "I'm a teapot",
    [HTTP_STATUS.MISDIRECTED_REQUEST]: 'Misdirected Request',
    [HTTP_STATUS.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
    [HTTP_STATUS.LOCKED]: 'Locked',
    [HTTP_STATUS.FAILED_DEPENDENCY]: 'Failed Dependency',
    [HTTP_STATUS.TOO_EARLY]: 'Too Early',
    [HTTP_STATUS.UPGRADE_REQUIRED]: 'Upgrade Required',
    [HTTP_STATUS.PRECONDITION_REQUIRED]: 'Precondition Required',
    [HTTP_STATUS.TOO_MANY_REQUESTS]: 'Too Many Requests',
    [HTTP_STATUS.REQUEST_HEADER_FIELDS_TOO_LARGE]: 'Request Header Fields Too Large',
    [HTTP_STATUS.UNAVAILABLE_FOR_LEGAL_REASONS]: 'Unavailable For Legal Reasons'
} as const; 

// Type Categories (from the TypeCategory enum)
export const TYPE_CATEGORY = {
    MIME_TYPE: 0,
    CHARSET_TYPE: 1,
    LOCATION_TYPE: 2,
    LANGUAGE_TYPE: 3
} as const;

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
        methods: 2913, // Default methods
        redirect: {
            code: 0,
            location: ""
        },
        resourceAdmin: ZeroAddress
    } as const;

// Supported protocols
export const SUPPORTED_PROTOCOLS = ['wttp', 'http', 'https'];

