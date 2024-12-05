use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct ListingAccount {
    pub seller: Pubkey,
    pub nft_mint: Pubkey,
    pub price: u64,
    pub token_account: Pubkey,
    pub escrow_token_account: Pubkey,
    pub created_at: i64,
    pub expires_at: Option<i64>,
    pub is_active: bool,
    pub bump: u8,
}

#[account]
pub struct MarketplaceConfig {
    pub authority: Pubkey,
    pub treasury_wallet: Pubkey,
    pub fee_percentage: u16,
    pub is_paused: bool,
    pub bump: u8,
}