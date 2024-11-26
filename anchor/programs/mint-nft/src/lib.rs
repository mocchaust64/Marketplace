use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};

pub mod state;
pub mod contexts;
pub mod errors;

use contexts::*;
use errors::*;

declare_id!("CFSd2NBvuNZY16M3jcYZufyZbhdok4esET8N2kyEdVrs");

#[program]
pub mod nft_marketplace {
    use super::*;

    pub fn create_collection(
        ctx: Context<CreateCollection>,
        collection_metadata: NFTMetadata
    ) -> Result<()> {
        ctx.accounts.create_collection(collection_metadata, &ctx.bumps)
    }
    
    pub fn mint_nft(ctx: Context<MintNFT>, nft_metadata: NFTMetadata) -> Result<()> {
        let bumps = ctx.bumps;
        msg!("Mint NFT with bumps: {:?}", bumps);
        ctx.accounts.mint_nft(nft_metadata, &bumps)
    }

    pub fn verify_collection(ctx: Context<VerifyCollectionMint>) -> Result<()> {
        msg!("Verifying collection...");
        ctx.accounts.verify_collection(&ctx.bumps)
    }

    pub fn initialize_marketplace(
        ctx: Context<InitializeMarketplace>,
        fee_percentage: u16,
    ) -> Result<()> {
        require!(
            fee_percentage <= 10000, // Max 100% = 10000 basis points
            MarketplaceError::InvalidFeePercentage
        );
        ctx.accounts.initialize(fee_percentage)
    }

    pub fn list_nft(
        ctx: Context<ListNFT>,
        price: u64,
        duration: i64,
    ) -> Result<()> {
        require!(price > 0, MarketplaceError::InvalidPrice);
        require!(duration > 0, MarketplaceError::InvalidDuration);
        
        // Transfer NFT to escrow first
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.nft_token.to_account_info(),
                to: ctx.accounts.escrow_token_account.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, 1)?;
        
        // Initialize listing
        ctx.accounts.list_nft(price, duration)
    }

    pub fn update_metadata(
        ctx: Context<UpdateMetadata>,
        metadata: NFTMetadata
    ) -> Result<()> {
        ctx.accounts.update_metadata(metadata)
    }

    pub fn update_listing(
        ctx: Context<UpdateListingMint>, 
        price: u64, 
        duration: i64
    ) -> Result<()> {
        require!(price > 0, MarketplaceError::InvalidPrice);
        require!(duration > 0, MarketplaceError::InvalidDuration);
        ctx.accounts.update_listing(price, duration)
    }

    pub fn pause_marketplace(ctx: Context<PauseMarketplace>) -> Result<()> {
        ctx.accounts.pause()
    }

    pub fn unpause_marketplace(ctx: Context<PauseMarketplace>) -> Result<()> {
        ctx.accounts.unpause()
    }

    pub fn close_marketplace(ctx: Context<CloseMarketplace>) -> Result<()> {
        msg!("Closing marketplace...");
        Ok(())
    }

    pub fn buy_nft(ctx: Context<BuyNft>) -> Result<()> {
        ctx.accounts.buy_nft()
    }

    pub fn delist_nft(ctx: Context<DelistNft>) -> Result<()> {
        // Verify listing is active
        require!(
            ctx.accounts.listing_account.is_active,
            MarketplaceError::ListingNotActive
        );
        
        // Verify escrow token account
        require!(
            ctx.accounts.escrow_token_account.key() == ctx.accounts.listing_account.escrow_token_account,
            MarketplaceError::InvalidEscrowAccount
        );
        
        // Transfer NFT back and close accounts
        ctx.accounts.delist_nft()
    }
}