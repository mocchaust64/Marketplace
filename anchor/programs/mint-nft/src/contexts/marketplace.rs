use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};
use crate::state::{ListingAccount, MarketplaceConfig};
use crate::errors::NFTError;

// Định nghĩa constant cho seeds
const MARKETPLACE_SEED: &[u8] = b"marketplace_v2";
const LISTING_SEED: &[u8] = b"listing_v2";

#[derive(Accounts)]
pub struct ListNFT<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    
    #[account(
        init,
        payer = owner,
        space = 8 + std::mem::size_of::<ListingAccount>(),
        seeds = [LISTING_SEED, nft_mint.key().as_ref()],
        bump
    )]
    pub listing_account: Account<'info, ListingAccount>,
    
    #[account(
        constraint = nft_mint.supply == 1 @ NFTError::InvalidNFTSupply,
    )]
    pub nft_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = owner,
        constraint = nft_token.amount == 1 @ NFTError::InvalidTokenAmount
    )]
    pub nft_token: Account<'info, TokenAccount>,
    
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = nft_mint,
        associated_token::authority = listing_account
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    
    #[account(
        seeds = [MARKETPLACE_SEED],
        bump,
        constraint = !marketplace_config.is_paused @ NFTError::MarketplacePaused
    )]
    pub marketplace_config: Account<'info, MarketplaceConfig>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> ListNFT<'info> {
    pub fn list_nft(&mut self, price: u64, duration: i64) -> Result<()> {
        let listing = &mut self.listing_account;
        
        let (_, bump) = Pubkey::find_program_address(
            &[LISTING_SEED, self.nft_mint.key().as_ref()],
            &crate::ID
        );
        
        listing.bump = bump;
        listing.seller = self.owner.key();
        listing.nft_mint = self.nft_mint.key();
        listing.price = price;
        listing.token_account = self.nft_token.key();
        listing.escrow_token_account = self.escrow_token_account.key();
        listing.created_at = Clock::get()?.unix_timestamp;
        listing.expires_at = Some(Clock::get()?.unix_timestamp + duration);
        listing.is_active = true;
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeMarketplace<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 8 + 1,
        seeds = [MARKETPLACE_SEED],
        bump
    )]
    pub config: Account<'info, MarketplaceConfig>,
    
    /// CHECK: Safe because this is just a wallet
    pub treasury_wallet: AccountInfo<'info>,
pub system_program: Program<'info, System>,
}

impl<'info> InitializeMarketplace<'info> {
    pub fn initialize(
        &mut self,
        fee_percentage: u16
    ) -> Result<()> {
        let config = &mut self.config;
        config.authority = self.authority.key();
        config.treasury_wallet = self.treasury_wallet.key();
        config.fee_percentage = fee_percentage;
        config.is_paused = false;
        
        let (_, bump) = Pubkey::find_program_address(
            &[MARKETPLACE_SEED],
            &crate::ID
        );
        config.bump = bump;
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CloseMarketplace<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        close = authority,
        seeds = [MARKETPLACE_SEED],
        bump,
        has_one = authority
    )]
    pub config: Account<'info, MarketplaceConfig>,
    
    pub system_program: Program<'info, System>,
}

pub fn close_marketplace(_ctx: Context<CloseMarketplace>) -> Result<()> {
    Ok(())
}

#[derive(Accounts)]
pub struct PauseMarketplace<'info> {
    #[account(
        mut,
        seeds = [MARKETPLACE_SEED],
        bump,
        has_one = authority
    )]
    pub config: Account<'info, MarketplaceConfig>,
    
    pub authority: Signer<'info>,
}

impl<'info> PauseMarketplace<'info> {
    pub fn pause(&mut self) -> Result<()> {
        self.config.is_paused = true;
        Ok(())
    }

    pub fn unpause(&mut self) -> Result<()> {
        self.config.is_paused = false;
        Ok(())
    }
}