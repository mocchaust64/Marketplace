use anchor_lang::prelude::*;


pub mod contexts;
pub mod errors;

pub use contexts::*;
pub use errors::*;

declare_id!("CFSd2NBvuNZY16M3jcYZufyZbhdok4esET8N2kyEdVrs");

#[program]
pub mod mint_nft {
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
        ctx.accounts.initialize(fee_percentage)
    }

    pub fn list_nft(
        ctx: Context<ListNFT>,
        price: u64,
        duration: i64,
    ) -> Result<()> {
        ctx.accounts.list_nft(price, duration)
    }

    pub fn update_metadata(
        ctx: Context<UpdateMetadata>,
        metadata: NFTMetadata
    ) -> Result<()> {
        ctx.accounts.update_metadata(metadata)
    }

    pub fn update_listing(ctx: Context<UpdateListingMint>, price: u64, duration: i64) -> Result<()> {
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
}
