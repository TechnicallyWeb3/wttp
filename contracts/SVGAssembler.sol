// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./WebStorage.sol";

struct SVGData {
    uint256 width;
    uint256 height;
    bool viewbox;
    bool base64;
    bytes32[] layers;
}

contract SVGAssembler {
    // constructor
    constructor(address dprAddress) {
        dataPointRegistry = DataPointRegistry(dprAddress);
    }

    // state variables
    DataPointRegistry dataPointRegistry;

    // events
    // errors

    // modifiers
    // functions
    function assembleSVG(SVGData memory svgData)
        public
        view
        returns (string memory svg)
    {
        svg = '<svg xmlns="http://www.w3.org/2000/svg"';

        // add the viewbox if requested, otherwise add the height and width
        if (svgData.viewbox) {
            svg = string(
                abi.encodePacked(
                    svg,
                    ' viewBox="0 0 ',
                    Strings.toString(svgData.width),
                    " ",
                    Strings.toString(svgData.height),
                    '">'
                )
            );
        } else {
            svg = string(
                abi.encodePacked(
                    svg,
                    ' width="',
                    svgData.width,
                    '" height="',
                    svgData.height,
                    '">'
                )
            );
        }

        // add the layers
        for (uint256 i = 0; i < svgData.layers.length; i++) {
            DataPoint memory layerData = DataPointStorage(dataPointRegistry.DPS_()).readDataPoint(
                svgData.layers[i]
            );
            require(
                layerData.structure.mimeType == 0x6973,
                "Invalid data point type"
            );
            require(
                layerData.structure.charset == 0x7508,
                "Invalid data point charset"
            );
            require(
                layerData.structure.location == 0x0101,
                "Invalid data point location"
            );
            require(
                layerData.data[0] == abi.encodePacked("<")[0],
                "Invalid SVG layer"
            );

            svg = string(abi.encodePacked(svg, layerData.data));
        }

        // close the svg tag
        svg = string.concat(svg, "</svg>");

        // convert to base64 if requested
        if (svgData.base64) {
            svg = Base64.encode(bytes(svg));
        }
        return svg;
    }

    function setSVGLayerData(string memory svg, address publisher)
        external
        payable
        returns (bytes32 svgLayerAddress)
    {
        DataPoint memory dataPoint = DataPoint(
            DataPointStructure(0x6973, 0x7508, 0x0101),
            bytes(svg)
        );

        svgLayerAddress = dataPointRegistry.writeDataPoint{value: msg.value}(
            dataPoint,
            publisher
        );
    }
}
