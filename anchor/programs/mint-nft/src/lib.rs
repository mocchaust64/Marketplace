use anchor_lang::prelude::*;

pub mod contexts;
pub mod errors;

pub use contexts::*;
pub use errors::*;

declare_id!("CFSd2NBvuNZY16M3jcYZufyZbhdok4esET8N2kyEdVrs");

#[program]
pub mod mint_nft {
    use super::*;
    pub fn create_collection(ctx: Context<CreateCollection>) -> Result<()> {
        ctx.accounts.create_collection(&ctx.bumps)
    }
    
    pub fn mint_nft(ctx: Context<MintNFT>) -> Result<()> {
        ctx.accounts.mint_nft(&ctx.bumps)
    }

    pub fn verify_collection(ctx: Context<VerifyCollectionMint>) -> Result<()> {
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
}
