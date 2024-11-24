use anchor_lang::prelude::*;
use anchor_spl::metadata::mpl_token_metadata::types::Creator as MetaplexCreator;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Creator {
    pub address: Pubkey,
    pub verified: bool,
    pub share: u8,
}

impl From<Creator> for MetaplexCreator {
    fn from(creator: Creator) -> Self {
        MetaplexCreator {
            address: creator.address,
            verified: creator.verified,
            share: creator.share,
        }
    }
}

impl Creator {
    pub fn to_metaplex_creators(creators: Vec<Creator>) -> Vec<MetaplexCreator> {
        creators.into_iter().map(|c| c.into()).collect()
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct NFTMetadata {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub seller_fee_basis_points: u16,
    pub creators: Vec<Creator>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct NFTAttribute {
    pub trait_type: String,
    pub value: String,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct NFTProperties {
    pub files: Vec<FileType>,
    pub category: String,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct FileType {
    pub uri: String,
    pub file_type: String,
}