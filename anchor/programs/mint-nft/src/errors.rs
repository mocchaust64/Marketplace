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
}

#[error_code]
pub enum NFTError {
    InvalidMetadata,
    InvalidCollectionMetadata,
    MetadataUpdateNotAllowed,
    InvalidCreatorShare,
    InvalidAuthority,
}
