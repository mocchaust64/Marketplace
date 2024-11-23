use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};
use crate::errors::MarketplaceError;

#[account]
#[derive(Default)]
pub struct ListingAccount {
    pub seller: Pubkey,
    pub nft_mint: Pubkey,
    pub price: u64,
    pub token_account: Pubkey,
    pub created_at: i64,
    pub expires_at: Option<i64>,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct ListNFT<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    
    #[account(
        init,
        payer = owner,
        space = 8 + std::mem::size_of::<ListingAccount>(),
        seeds = [b"listing", nft_mint.key().as_ref()],
        bump
    )]
    pub listing_account: Account<'info, ListingAccount>,
    
    pub nft_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = owner
    )]
    pub nft_token: Account<'info, TokenAccount>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> ListNFT<'info> {
    pub fn list_nft(
        &mut self,
        price: u64,
        duration: i64,
    ) -> Result<()> {
        require!(price > 0, MarketplaceError::InvalidPrice);
        require!(
            self.nft_token.amount == 1,
            MarketplaceError::InvalidOwner
        );
        
        let clock = Clock::get()?;
        let listing = &mut self.listing_account;
        
        listing.seller = self.owner.key();
        listing.nft_mint = self.nft_mint.key();
        listing.price = price;
        listing.token_account = self.nft_token.key();
        listing.created_at = clock.unix_timestamp;
        listing.expires_at = Some(clock.unix_timestamp + duration);
        
        Ok(())
    }
}

#[account]
pub struct MarketplaceConfig {
    pub authority: Pubkey,
    pub treasury_wallet: Pubkey,
    pub fee_percentage: u16,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct InitializeMarketplace<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + std::mem::size_of::<MarketplaceConfig>(),
        seeds = [b"marketplace"],
        bump
    )]
    pub config: Account<'info, MarketplaceConfig>,
    
    /// CHECK: Safe because this is just a wallet
    pub treasury_wallet: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

impl<'info> InitializeMarketplace<'info> {
    pub fn initialize(&mut self, fee_percentage: u16) -> Result<()> {
        require!(fee_percentage <= 1000, MarketplaceError::InvalidFeePercentage);
        
        let config = &mut self.config;
        config.authority = self.authority.key();
        config.treasury_wallet = self.treasury_wallet.key();
        config.fee_percentage = fee_percentage;
        
        Ok(())
    }
}