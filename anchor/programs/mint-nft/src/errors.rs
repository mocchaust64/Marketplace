use anchor_lang::prelude::*;

#[error_code]
pub enum MarketplaceError {
    #[msg("Invalid fee percentage")]
    InvalidFeePercentage,
    #[msg("Invalid listing price")]
    InvalidPrice,
    #[msg("NFT not owned by seller")]
    InvalidOwner,
    #[msg("Listing has expired")]
    ListingExpired,
}

#[error_code]
pub enum NFTError {
    InvalidMetadata,
    InvalidCollectionMetadata,
    MetadataUpdateNotAllowed,
    InvalidCreatorShare,
    InvalidAuthority,
}