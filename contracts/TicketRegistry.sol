// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title TicketRegistry
 * @dev NFT contract for minting validated event tickets on Base L2
 * Designed to work with the ticket registry platform where:
 * - Users pay 12 tickets to mint
 * - NFT metadata points to permanent registry URLs
 * - Only the platform can mint (centralized minting)
 */
contract TicketRegistry is ERC721, ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    
    Counters.Counter private _tokenIdCounter;
    
    // Mapping from registry ID to token ID
    mapping(string => uint256) public registryToToken;
    
    // Mapping from token ID to registry ID
    mapping(uint256 => string) public tokenToRegistry;
    
    // Base URL for metadata (e.g., "https://yourapp.replit.app/api/registry/")
    string public baseMetadataURI;
    
    // Event emitted when a ticket is minted
    event TicketMinted(
        uint256 indexed tokenId,
        address indexed recipient,
        string registryId,
        string metadataURI
    );
    
    constructor(
        string memory _baseMetadataURI
    ) ERC721("Ticket Registry NFT", "TICKET") {
        baseMetadataURI = _baseMetadataURI;
    }
    
    /**
     * @dev Mint a new NFT for a validated ticket
     * @param recipient The wallet address to receive the NFT
     * @param registryId The registry ID from the platform
     * @param metadataPath The path to append to baseMetadataURI (e.g., "abc123/metadata")
     */
    function mintTicket(
        address recipient,
        string memory registryId,
        string memory metadataPath
    ) public onlyOwner returns (uint256) {
        require(registryToToken[registryId] == 0, "Ticket already minted");
        require(recipient != address(0), "Invalid recipient");
        
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        
        _safeMint(recipient, tokenId);
        
        // Set the metadata URI
        string memory fullURI = string(abi.encodePacked(baseMetadataURI, metadataPath));
        _setTokenURI(tokenId, fullURI);
        
        // Store mappings
        registryToToken[registryId] = tokenId;
        tokenToRegistry[tokenId] = registryId;
        
        emit TicketMinted(tokenId, recipient, registryId, fullURI);
        
        return tokenId;
    }
    
    /**
     * @dev Update the base metadata URI (owner only)
     * @param newBaseURI The new base URI for metadata
     */
    function setBaseMetadataURI(string memory newBaseURI) public onlyOwner {
        baseMetadataURI = newBaseURI;
    }
    
    /**
     * @dev Check if a registry ID has been minted
     * @param registryId The registry ID to check
     */
    function isMinted(string memory registryId) public view returns (bool) {
        return registryToToken[registryId] != 0;
    }
    
    /**
     * @dev Get token ID for a registry ID
     * @param registryId The registry ID
     */
    function getTokenId(string memory registryId) public view returns (uint256) {
        require(registryToToken[registryId] != 0, "Not minted");
        return registryToToken[registryId];
    }
    
    // Required overrides for ERC721URIStorage
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
        string memory registryId = tokenToRegistry[tokenId];
        delete registryToToken[registryId];
        delete tokenToRegistry[tokenId];
    }
    
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}