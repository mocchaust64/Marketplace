export type MintNft = {
    "version": "0.1.0",
    "name": "mint_nft",
    "instructions": [
      // ... other instructions
    ],
    "accounts": [
      {
        "name": "listingAccount",
        "type": {
          "kind": "struct",
          "fields": [
            {
              "name": "seller",
              "type": "pubkey"
            },
            {
              "name": "nftMint", 
              "type": "pubkey"
            },
            {
              "name": "price",
              "type": "u64"
            },
            {
              "name": "tokenAccount",
              "type": "pubkey"
            },
            {
              "name": "createdAt",
              "type": "i64"
            },
            {
              "name": "expiresAt",
              "type": {
                "option": "i64"
              }
            },
            {
              "name": "bump",
              "type": "u8"
            }
          ]
        }
      }
    ]
  };