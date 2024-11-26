use anchor_lang::prelude::*;
use crate::state::ListingAccount;
use crate::errors::MarketplaceError;

#[derive(Accounts)]
pub struct UpdateListingMint<'info> {
    #[account(
        mut,
        seeds = [b"listing", nft_mint.key().as_ref()],
        bump,
        has_one = seller,
        constraint = listing_account.is_active @ MarketplaceError::ListingNotActive
    )]
    pub listing_account: Account<'info, ListingAccount>,
    
    /// CHECK: Validated in constraint
    pub nft_mint: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub seller: Signer<'info>,
}

impl<'info> UpdateListingMint<'info> {
    pub fn update_listing(&mut self, price: u64, duration: i64) -> Result<()> {
        let clock = Clock::get()?;
        let listing = &mut self.listing_account;
        
        listing.price = price;
        listing.expires_at = Some(clock.unix_timestamp + duration);
        
        Ok(())
    }
}