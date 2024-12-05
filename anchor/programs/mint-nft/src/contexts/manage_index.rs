use anchor_lang::prelude::*;
use crate::state::{TransactionIndex, IndexType, MarketplaceConfig};
use crate::errors::MarketplaceError;

#[derive(Accounts)]
#[instruction(index_type: IndexType, key: String)]
pub struct CreateIndex<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"marketplace_v2"],
        bump = config.bump
    )]
    pub config: Account<'info, MarketplaceConfig>,
    
    #[account(
        init,
        payer = payer,
        space = TransactionIndex::BASE_SIZE + key.len() + 8 * TransactionIndex::MAX_TRANSACTION_IDS,
        seeds = [
            b"index",
            config.key().as_ref(),
            index_type.to_string().as_bytes(),
            key.as_bytes()
        ],
        bump
    )]
    pub index: Account<'info, TransactionIndex>,
    
    pub system_program: Program<'info, System>,
}

impl<'info> CreateIndex<'info> {
    pub fn create_index(
        &mut self,
        index_type: IndexType,
        key: String,
        bump: u8,
    ) -> Result<()> {
        let index = &mut self.index;
        index.marketplace = self.config.key();
        index.index_type = index_type;
        index.key = key;
        index.transaction_ids = Vec::new();
        index.bump = bump;
        Ok(())
    }
    
    pub fn add_transaction(&mut self, transaction_id: u64) -> Result<()> {
        require!(
            self.index.transaction_ids.len() < TransactionIndex::MAX_TRANSACTION_IDS,
            MarketplaceError::IndexFull
        );
        
        self.index.transaction_ids.push(transaction_id);
        Ok(())
    }
}