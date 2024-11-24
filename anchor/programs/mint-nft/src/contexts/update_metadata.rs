use anchor_lang::prelude::*;
use anchor_spl::{
    metadata::Metadata,
    token::{Mint},
};
use anchor_spl::metadata::mpl_token_metadata::{
    instructions::{
        UpdateMetadataAccountV2Cpi,
        UpdateMetadataAccountV2CpiAccounts,
        UpdateMetadataAccountV2InstructionArgs,
    },
    types::DataV2,
};
use crate::contexts::metadata::NFTMetadata;
use crate::errors::NFTError;
use crate::contexts::metadata::Creator;

#[derive(Accounts)]
pub struct UpdateMetadata<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub mint: Account<'info, Mint>,
    
    pub collection_mint: Account<'info, Mint>,
    
    #[account(mut)]
    /// CHECK: This is the metadata account we're updating
    pub metadata: UncheckedAccount<'info>,
    
    pub token_metadata_program: Program<'info, Metadata>,
}

impl<'info> UpdateMetadata<'info> {
    pub fn update_metadata(&mut self, nft_metadata: NFTMetadata) -> Result<()> {
        // Validate metadata
        let creators = nft_metadata.creators.clone();
        require!(
            creators.iter().map(|c| c.share).sum::<u8>() == 100,
            NFTError::InvalidMetadata
        );

        // Tạo các AccountInfo tạm
        let token_metadata_info = self.token_metadata_program.to_account_info();
        let metadata_info = self.metadata.to_account_info();
        let authority_info = self.authority.to_account_info();

        let metadata_account = UpdateMetadataAccountV2Cpi::new(
            &token_metadata_info,
            UpdateMetadataAccountV2CpiAccounts {
                metadata: &metadata_info,
                update_authority: &authority_info,
            },
            UpdateMetadataAccountV2InstructionArgs {
                data: Some(DataV2 {
                    name: nft_metadata.name,
                    symbol: nft_metadata.symbol,
                    uri: nft_metadata.uri,
                    seller_fee_basis_points: nft_metadata.seller_fee_basis_points,
                    creators: Some(Creator::to_metaplex_creators(nft_metadata.creators)),
                    collection: Some(anchor_spl::metadata::mpl_token_metadata::types::Collection {
                        verified: false,
                        key: self.collection_mint.key(),
                    }),
                    uses: None,
                }),
                new_update_authority: None,
                primary_sale_happened: None,
                is_mutable: Some(true),
            },
        );
        metadata_account.invoke()?;
        
        Ok(())
    }
}