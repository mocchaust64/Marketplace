use anchor_lang::prelude::*;

#[error_code]
pub enum MarketplaceError {
    #[msg("Giá phải lớn hơn 0")]
    InvalidPrice,
    
    #[msg("Bạn không sở hữu NFT này")]
    InvalidOwner,
    
    #[msg("Bạn không phải người bán NFT này")]
    InvalidSeller,
    
    #[msg("NFT không thuộc collection này")]
    InvalidCollection,
}

#[error_code]
pub enum NFTError {
    InvalidMetadata,
    InvalidCollectionMetadata,
    MetadataUpdateNotAllowed,
    InvalidCreatorShare,
    InvalidAuthority,
}
