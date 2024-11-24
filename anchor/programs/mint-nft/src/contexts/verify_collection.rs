use anchor_lang::prelude::*;

use anchor_spl::metadata::mpl_token_metadata::instructions::{
    VerifyCollectionV1Cpi,
    VerifyCollectionV1CpiAccounts,
};

use anchor_spl::{
    token::Mint, 
    metadata::Metadata, 
};

pub use anchor_lang::solana_program::sysvar::instructions::ID as INSTRUCTIONS_ID;



#[derive(Accounts)]
pub struct VerifyCollectionMint<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut)]
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub metadata: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        seeds = [b"authority"],
        bump,
    )]
    /// CHECK: This account is not initialized and is being used for signing purposes only
    pub mint_authority: UncheckedAccount<'info>,
    pub collection_mint: Account<'info, Mint>,
    #[account(mut)]
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub collection_metadata: UncheckedAccount<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub collection_master_edition: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub sysvar_instruction: UncheckedAccount<'info>,
    pub token_metadata_program: Program<'info, Metadata>,
}

impl<'info> VerifyCollectionMint<'info> {
    pub fn verify_collection(&mut self, bumps: &VerifyCollectionMintBumps) -> Result<()> {
        let seeds = &[
            b"authority".as_ref(),
            &[bumps.mint_authority]
        ];
        let signer_seeds = &[&seeds[..]];

        // Tạo các AccountInfo tạm
        let token_metadata_info = self.token_metadata_program.to_account_info();
        let mint_authority_info = self.mint_authority.to_account_info();
        let metadata_info = self.metadata.to_account_info();
        let collection_mint_info = self.collection_mint.to_account_info();
        let collection_metadata_info = self.collection_metadata.to_account_info();
        let collection_master_edition_info = self.collection_master_edition.to_account_info();
        let system_program_info = self.system_program.to_account_info();
        let sysvar_instruction_info = self.sysvar_instruction.to_account_info();

        let verify_collection = VerifyCollectionV1Cpi::new(
            &token_metadata_info,
            VerifyCollectionV1CpiAccounts {
                authority: &mint_authority_info,
                delegate_record: None,
                metadata: &metadata_info,
                collection_mint: &collection_mint_info,
                collection_metadata: Some(&collection_metadata_info),
                collection_master_edition: Some(&collection_master_edition_info),
                system_program: &system_program_info,
                sysvar_instructions: &sysvar_instruction_info,
            }
        );
        verify_collection.invoke_signed(signer_seeds)?;

        msg!("Collection Verified!");
        Ok(())
    }
}