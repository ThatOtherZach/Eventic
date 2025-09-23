// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title TicketRegistry
 * @dev NFT contract for minting validated event tickets on Base L2
 * Designed to work with the ticket registry platform where:
 * - Users pay 12 tickets to mint (with royalties) or 15 tickets (without)
 * - NFT metadata points to permanent registry URLs
 * - Only the platform can mint (centralized minting)
 * - Supports ERC-2981 royalty standard with per-token configuration
 */
contract TicketRegistry is ERC721, ERC721URIStorage, ERC2981, Ownable {
    using Counters for Counters.Counter;
    
    Counters.Counter private _tokenIdCounter;
    
    // Mapping from registry ID to token ID
    mapping(string => uint256) public registryToToken;
    
    // Mapping from token ID to registry ID
    mapping(uint256 => string) public tokenToRegistry;
    
    // Mapping to track which tokens have royalties enabled
    mapping(uint256 => bool) public hasRoyalty;
    
    // Base URL for metadata (e.g., "https://yourapp.replit.app/api/registry/")
    string public baseMetadataURI;
    
    // Royalty configuration
    address public royaltyReceiver;
    uint96 public constant ROYALTY_BPS = 269; // 2.69% = 269 basis points
    
    // Event emitted when a ticket is minted
    event TicketMinted(
        uint256 indexed tokenId,
        address indexed recipient,
        string registryId,
        string metadataURI,
        bool withRoyalty
    );
    
    constructor(
        string memory _baseMetadataURI,
        address _royaltyReceiver
    ) ERC721("Ticket Registry NFT", "TICKET") {
        require(_royaltyReceiver != address(0), "Invalid royalty receiver");
        baseMetadataURI = _baseMetadataURI;
        royaltyReceiver = _royaltyReceiver;
    }
    
    /**
     * @dev Mint a new NFT for a validated ticket
     * Anyone can call this function after paying tickets through the platform
     * @param recipient The wallet address to receive the NFT
     * @param registryId The registry ID from the platform
     * @param metadataPath The path to append to baseMetadataURI (e.g., "abc123/metadata")
     * @param withRoyalty Whether this NFT should have royalties enabled
     */
    function mintTicket(
        address recipient,
        string memory registryId,
        string memory metadataPath,
        bool withRoyalty
    ) public returns (uint256) {
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
        hasRoyalty[tokenId] = withRoyalty;
        
        // Set royalty info if enabled for this token
        if (withRoyalty) {
            _setTokenRoyalty(tokenId, royaltyReceiver, ROYALTY_BPS);
        }
        
        emit TicketMinted(tokenId, recipient, registryId, fullURI, withRoyalty);
        
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
     * @dev Update the royalty receiver address (owner only)
     * @param newReceiver The new royalty receiver address
     */
    function setRoyaltyReceiver(address newReceiver) public onlyOwner {
        require(newReceiver != address(0), "Invalid royalty receiver");
        royaltyReceiver = newReceiver;
        
        // Update royalty info for all existing tokens with royalties
        uint256 currentTokenId = _tokenIdCounter.current();
        for (uint256 i = 0; i < currentTokenId; i++) {
            if (_ownerOf(i) != address(0) && hasRoyalty[i]) {
                _setTokenRoyalty(i, newReceiver, ROYALTY_BPS);
            }
        }
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
        override(ERC721, ERC721URIStorage, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}