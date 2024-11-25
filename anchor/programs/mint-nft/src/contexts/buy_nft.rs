use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::{
    token::{self, Token, TokenAccount, Mint},
    associated_token::AssociatedToken,
};
use crate::errors::NFTError;
use super::marketplace::{MarketplaceConfig, ListingAccount};

#[derive(Accounts)]
pub struct BuyNft<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    #[account(mut)]
    pub seller: SystemAccount<'info>,
    
    #[account(
        mut,
        seeds = [b"marketplace"],
        bump
    )]
    pub config: Account<'info, MarketplaceConfig>,
    
    #[account(
        mut,
        seeds = [b"listing", nft_mint.key().as_ref()],
        bump,
        close = seller,
        has_one = seller
    )]
    pub listing_account: Account<'info, ListingAccount>,
    
    #[account(mut)]
    pub nft_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = seller
    )]
    pub seller_token_account: Account<'info, TokenAccount>,
    
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = nft_mint,
        associated_token::authority = buyer
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub treasury_wallet: SystemAccount<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> BuyNft<'info> {
    pub fn buy_nft(&mut self) -> Result<()> {
        // Check if buyer has enough balance
        require!(
            self.buyer.lamports() >= self.listing_account.price,
            NFTError::InsufficientBalance
        );

        // Check if buyer is not seller
        require!(
            self.buyer.key() != self.seller.key(),
            NFTError::CannotBuyOwnNFT
        );

        let listing_price = self.listing_account.price;
        let fee_percentage = self.config.fee_percentage;

        // Calculate fee amount
        let fee_amount = (listing_price as u128)
            .checked_mul(fee_percentage as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap() as u64;

        // Calculate seller amount
        let seller_amount = listing_price.checked_sub(fee_amount).unwrap();

        // Transfer SOL to seller
        system_program::transfer(
            CpiContext::new(
                self.system_program.to_account_info(),
                system_program::Transfer {
                    from: self.buyer.to_account_info(),
                    to: self.seller.to_account_info(),
                }
            ),
            seller_amount,
        )?;

        // Transfer fee to treasury
        system_program::transfer(
            CpiContext::new(
                self.system_program.to_account_info(),
                system_program::Transfer {
                    from: self.buyer.to_account_info(),
                    to: self.treasury_wallet.to_account_info(),
                }
            ),
            fee_amount,
        )?;

        // Transfer NFT from seller to buyer
        token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                token::Transfer {
                    from: self.seller_token_account.to_account_info(),
                    to: self.buyer_token_account.to_account_info(),
                    authority: self.seller.to_account_info(),
                },
                &[]
            ),
            1,
        )?;

        Ok(())
    }
}