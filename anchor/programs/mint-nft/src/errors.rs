use anchor_lang::prelude::*;

#[error_code]
pub enum MarketplaceError {
    #[msg("Marketplace đang tạm dừng")]
    MarketplacePaused,
    
    #[msg("Giá phải lớn hơn 0")]
    InvalidPrice,
    
    #[msg("Bạn không sở hữu NFT này")]
    InvalidOwner,
    
    #[msg("Bạn không phải người bán NFT này")]
    InvalidSeller,
    
    #[msg("NFT không thuộc collection này")]
    InvalidCollection,
    
    #[msg("NFT listing không còn active")]
    ListingNotActive,
    
    #[msg("Phí marketplace không hợp lệ")]
    InvalidFeePercentage,
    
    #[msg("Thời hạn listing không hợp lệ")]
    InvalidDuration,
    
    #[msg("Token account chưa được khởi tạo")]
    AccountNotInitialized,
    
    #[msg("Invalid escrow token account")]
    InvalidEscrowAccount,
    
    #[msg("Số dư không đủ để mua NFT")]
    InsufficientBalance,
    
    #[msg("Không thể mua NFT của chính mình")]
    CannotBuyOwnNFT,
    
    #[msg("Phí royalty không hợp lệ")]
    InvalidRoyaltyPercentage,
}

#[error_code]
pub enum NFTError {
    #[msg("Invalid metadata")]
    InvalidMetadata,
    
    #[msg("Invalid collection metadata")]
    InvalidCollectionMetadata,
    
    #[msg("Metadata update not allowed")]
    MetadataUpdateNotAllowed,
    
    #[msg("Invalid creator share")]
    InvalidCreatorShare,
    
    #[msg("Invalid authority")]
    InvalidAuthority,
    
    #[msg("Invalid mint authority")]
    InvalidMintAuthority,
    
    #[msg("Already minted")]
    AlreadyMinted,
    
    #[msg("Invalid NFT supply - must be 1")]
    InvalidNFTSupply,
    
    #[msg("Invalid token amount - must be 1")]
    InvalidTokenAmount,
    
    #[msg("Invalid marketplace authority")]
    InvalidMarketplaceAuthority,
    #[msg("Marketplace is paused")]  // Thêm error này
    MarketplacePaused,

}
