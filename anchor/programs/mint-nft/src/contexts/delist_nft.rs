use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Token, TokenAccount, Mint, Transfer},
    associated_token::AssociatedToken,
};
use crate::errors::MarketplaceError;
use crate::state::ListingAccount;

#[derive(Accounts)]
#[instruction()]
pub struct DelistNft<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"listing", nft_mint.key().as_ref()],
        bump,
        constraint = owner.key() == listing_account.seller @ MarketplaceError::InvalidSeller,
        constraint = listing_account.is_active @ MarketplaceError::ListingNotActive,
        close = owner
    )]
    pub listing_account: Account<'info, ListingAccount>,

    pub nft_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = owner
    )]
    pub owner_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = listing_account,
        constraint = escrow_token_account.key() == listing_account.escrow_token_account @ MarketplaceError::InvalidEscrowAccount,
        constraint = escrow_token_account.amount == 1 @ MarketplaceError::InvalidOwner
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> DelistNft<'info> {
    pub fn delist_nft(&mut self) -> Result<()> {
        // Transfer token từ escrow về owner
        let nft_mint_key = self.nft_mint.key();
        let bump = self.listing_account.bump;
        
        let listing_seeds = [
            b"listing",
            nft_mint_key.as_ref(),
            &[bump],
        ];
        let signer_seeds = &[&listing_seeds[..]];

        // Transfer token
        let transfer_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            Transfer {
                from: self.escrow_token_account.to_account_info(),
                to: self.owner_token_account.to_account_info(),
                authority: self.listing_account.to_account_info(),
            },
            signer_seeds
        );
        token::transfer(transfer_ctx, 1)?;

        // Close escrow token account
        let close_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            token::CloseAccount {
                account: self.escrow_token_account.to_account_info(),
                destination: self.owner.to_account_info(),
                authority: self.listing_account.to_account_info(),
            },
            signer_seeds
        );
        token::close_account(close_ctx)?;

        Ok(())
    }
}