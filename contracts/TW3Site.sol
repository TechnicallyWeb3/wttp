// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.20;

import "@tw3/solidity/contracts/wttp/WebContract.sol";

abstract contract TW3Site is WTTPSite {

    string public name;
    string public description;
    string public tags;

    address TW3_DPR_ = 0x5d32C19033A602D936221237ACdc6A7e7135D724;

    constructor (
        string memory _name, 
        string memory _description,
        string memory _tags
    ) 
    WTTPSite(
        TW3_DPR_, 
        msg.sender, 
        HeaderInfo(
            CacheControl(
                0, 
                0, 
                false, 
                false, 
                false, 
                false, 
                false, 
                0, 
                0, 
                false, 
                false
            ), 
            0, 
            Redirect(0, ""), 
            bytes32(0)
        )
    ) {

        setName(_name);
        setTags(_tags);
        setDescription(_description);
    }

    function setName(string memory _name) internal virtual {
        string memory oldName = name;
        name = _name;
        emit NameModified(oldName, _name);
    }

    function setDescription(string memory _description) internal virtual {
        string memory oldDescription = description;
        description = _description;
        emit DescriptionModified(oldDescription, _description);
    }

    function setTags(string memory _tags) internal virtual {
        string memory oldTags = tags;
        tags = _tags;
        emit TagsModified(oldTags, tags);
    }

    // function addTags(string[] memory _tags) internal virtual {
    //     string[] memory oldTags = tags;
    //     for (uint i; i < _tags.length; i++) {
    //         tags.push(_tags[i]);
    //     }
    //     emit TagsModified(oldTags, tags);
    // }

    // function removeTags(string[] memory _tags) internal virtual {
    //     string[] memory oldTags = tags;
    //     for (uint i; i < _tags.length; i++) {
    //         for (uint j; j < tags.length; j++) {
    //             if (keccak256(abi.encodePacked(tags[j])) == keccak256(abi.encodePacked(_tags[i]))) {
    //                 // Swap the tag to be removed with the last tag
    //                 tags[j] = tags[tags.length - 1];
    //                 // Remove the last tag
    //                 tags.pop();
    //                 // Break out of the inner loop as we found a match
    //                 break;
    //             }
    //         }
    //     }
    //     emit TagsModified(oldTags, tags);
    // }

    // Define events
    event NameModified(string oldName, string newName);
    event DescriptionModified(string oldDescription, string newDescription);
    event TagsModified(string oldTags, string newTags);


}