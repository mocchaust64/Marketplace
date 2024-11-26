import * as anchor from '@coral-xyz/anchor';
import type { Program } from '@coral-xyz/anchor';
import type NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createInitializeMintInstruction, createMintToInstruction, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { SystemProgram, Keypair, PublicKey } from '@solana/web3.js';
import type { MintNft } from '../target/types/mint_nft';

import { 
  CreateCollectionAccounts, 
  MintNFTAccounts, 
  ListNftAccounts , 
  MarketplaceAccounts, 
  VerifyCollectionAccounts, 
  NFTMetadata,
  getMetadata,
  getMasterEdition,
  UpdateListingAccounts,
  PauseMarketplaceAccounts,
  UnpauseMarketplaceAccounts,
  ListingAccount
} from './types/utils';
import { BN } from '@coral-xyz/anchor';
import { NftMarketplace } from '../target/types/nft_marketplace';

// Khai báo provider và program
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = anchor.workspace.NftMarketplace as Program<NftMarketplace>;
const wallet = provider.wallet as NodeWallet;

// Khai báo các biến global
let marketplaceConfig: PublicKey;
let treasuryWallet: PublicKey;
let nftPrice = new BN(1_000_000_000); // 1 SOL
let duration = new BN(7 * 24 * 60 * 60); // 7 days

// Khởi tạo marketplaceConfig PDA
[marketplaceConfig] = PublicKey.findProgramAddressSync(
  [Buffer.from('marketplace')],
  program.programId
);

describe('NFT Marketplace Tests', () => {
 
  const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
  
  const [mintAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    program.programId
  );

  let collectionKeypair: Keypair;
  let collectionMint: anchor.web3.PublicKey;
  let mintKeypair: Keypair;
  let mint: anchor.web3.PublicKey;
  let userNftAccount: anchor.web3.PublicKey;

  describe('Collection Flow', () => {
    // Thêm biến để track trạng thái
    let isCollectionCreated = false;
    let isMintInitialized = false;

    beforeEach(async () => {
      console.log("\n=== SETUP PHASE ===");
      
      try {
        marketplaceConfig = anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from('marketplace')],
          program.programId
        )[0];
        
        // Pause marketplace nếu nó đang active
        const account = await program.account.marketplaceConfig.fetch(marketplaceConfig);
        if (account && !account.isPaused) {
          await program.methods
            .pauseMarketplace()
            .accounts({
              authority: wallet.publicKey,
              config: marketplaceConfig,
            } as PauseMarketplaceAccounts)
            .rpc();
          console.log("Paused existing marketplace");
        }
      } catch (err) {
        // Ignore error if account doesn't exist
      }

      if (!isCollectionCreated) {
        console.log("1. Bắt đầu tạo collection...");
        collectionKeypair = Keypair.generate();
        collectionMint = collectionKeypair.publicKey;
        
        console.log("Collection Mint pubkey:", collectionMint.toBase58());
        console.log("Mint Authority pubkey:", mintAuthority.toBase58());
        
        const metadata = await getMetadata(collectionMint);
        const masterEdition = await getMasterEdition(collectionMint);
        const destination = getAssociatedTokenAddressSync(collectionMint, wallet.publicKey);

        console.log("Collection Metadata:", metadata.toBase58());
        console.log("Collection Master Edition:", masterEdition.toBase58());
        console.log("Collection Destination:", destination.toBase58());

        const collectionMetadata: NFTMetadata = {
          name: "Test Collection",
          symbol: "TCOL",
          uri: "https://gateway.pinata.cloud/ipfs/QmWPf3yr7JR7PEQnibJTEMib7jzMoYWacNPcyK6JZJTGPp",
          sellerFeeBasisPoints: 500,
          creators: [{
            address: wallet.publicKey,
            verified: false,
            share: 100
          }]
        };

        console.log("\n=== SETUP PHASE - COLLECTION CREATION ===");
        console.log("Collection Keypair generated:", {
          publicKey: collectionKeypair.publicKey.toBase58(),
          mint: collectionMint.toBase58()
        });
        console.log("PDA Mint Authority:", mintAuthority.toBase58());

        console.log("\nPreparing collection metadata:", {
          name: collectionMetadata.name,
          symbol: collectionMetadata.symbol, 
          uri: collectionMetadata.uri,
          sellerFeeBasisPoints: collectionMetadata.sellerFeeBasisPoints,
          creators: collectionMetadata.creators.map(c => ({
            address: c.address.toBase58(),
            share: c.share
          }))
        });

        await program.methods
          .createCollection(collectionMetadata)
          .accounts({
            user: wallet.publicKey,
            mint: collectionMint,
            mintAuthority,
            metadata,
            masterEdition,
            destination,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY
          } as CreateCollectionAccounts)
          .signers([collectionKeypair])
          .rpc();

        console.log("✅ Collection created successfully!");
        isCollectionCreated = true;
      }

      if (!isMintInitialized) {
        console.log("\n2. Khởi tạo mint account cho NFT...");
        mintKeypair = Keypair.generate();
        mint = mintKeypair.publicKey;
        
        console.log("NFT Mint pubkey:", mint.toBase58());
        
        const lamports = await provider.connection.getMinimumBalanceForRentExemption(82);
        console.log("Lamports needed:", lamports);

        const createAccountIx = SystemProgram.createAccount({
          fromPubkey: wallet.publicKey,
          newAccountPubkey: mint,
          space: 82,
          lamports: lamports,
          programId: TOKEN_PROGRAM_ID
        });

        const initializeMintIx = createInitializeMintInstruction(
          mint,
          0,
          mintAuthority,
          mintAuthority
        );

        // 2. Tạo token account cho owner
        const nftToken = getAssociatedTokenAddressSync(mint, wallet.publicKey);
        const createTokenAccountIx = createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          nftToken,
          wallet.publicKey,
          mint
        );

        await provider.sendAndConfirm(
          new anchor.web3.Transaction()
            .add(createAccountIx)
            .add(initializeMintIx)
            .add(createTokenAccountIx),
          [mintKeypair]
        );

        console.log("✅ Đã mint token cho owner");

        isMintInitialized = true;
      }
    });

    it("Bước 3: Mint NFT vào collection", async () => {
      console.log("\n=== MINT NFT PHASE ===");
      
      try {
        console.log("1. Lấy các account addresses...");
        const metadata = await getMetadata(mint);
        const masterEdition = await getMasterEdition(mint);
        const destination = getAssociatedTokenAddressSync(mint, wallet.publicKey);
        const collectionMetadata = await getMetadata(collectionMint);
        const collectionMasterEdition = await getMasterEdition(collectionMint);

        console.log({
          nftMint: mint.toBase58(),
          metadata: metadata.toBase58(),
          masterEdition: masterEdition.toBase58(),
          destination: destination.toBase58(),
          mintAuthority: mintAuthority.toBase58(),
          collectionMetadata: collectionMetadata.toBase58(),
          collectionMasterEdition: collectionMasterEdition.toBase58()
        });

        console.log("\n2. Chuẩn bị gửi mint instruction...");
        
        // Thêm compute budget
        const modifyComputeUnits = anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
          units: 300_000
        });

        console.log("3. Gửi transaction với compute budget:", 300_000);
        
        const nftMetadata: NFTMetadata = {
          name: "Test NFT",
          symbol: "TNFT",
          uri: "https://gateway.pinata.cloud/ipfs/Qma5HmqRjqKUNcKWu6QP7BbeAnvfCujVQs7ERGvbVBRLZ2",
          sellerFeeBasisPoints: 500,
          creators: [{
            address: wallet.publicKey,
            verified: false,
            share: 100
          }]
        };

        const tx = await program.methods
          .mintNft(nftMetadata)
          .accounts({
            owner: wallet.publicKey,
            mint,
            mintAuthority,
            metadata,
            masterEdition,
            destination,
            collectionMint,
            collectionMetadata,
            collectionMasterEdition,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY
          } as MintNFTAccounts)
          .preInstructions([modifyComputeUnits])
          .rpc();

        console.log("✅ NFT minted successfully!");
        console.log("Transaction signature:", tx);
        
      } catch (error) {
        console.error("\n❌ LỖI KHI MINT NFT:");
        console.error("Error name:", error.name);
        console.error("Error message:", error.message);
        if (error.logs) {
          console.error("\nProgram Logs:");
          error.logs.forEach((log: string, index: number) => {
            console.error(`${index + 1}. ${log}`);
          });
        }
        throw error;
      }
    });

    it("Bước 4: Verify collection", async () => {
      try {
        console.log("\n=== VERIFY COLLECTION ===");
        
        // Lấy các địa chỉ metadata cần thiết
        const metadata = await getMetadata(mint);
        const collectionMetadata = await getMetadata(collectionMint);
        const collectionMasterEdition = await getMasterEdition(collectionMint);

        console.log({
          nftMint: mint.toBase58(),
          metadata: metadata.toBase58(), 
          collectionMint: collectionMint.toBase58(),
          collectionMetadata: collectionMetadata.toBase58(),
          collectionMasterEdition: collectionMasterEdition.toBase58(),
        });

        // Lấy PDA mint authority
        const [mintAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from('authority')],
          program.programId
        );

        // Thêm compute budget
        const modifyComputeUnits = anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
          units: 300_000
        });

        const tx = await program.methods
          .verifyCollection()
          .accounts({
            authority: wallet.publicKey,
            metadata,
            mint,
            mintAuthority,
            collectionMint,
            collectionMetadata, 
            collectionMasterEdition,
            systemProgram: SystemProgram.programId,
            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
            sysvarInstruction: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY
          } as VerifyCollectionAccounts)
          .signers([])
          .preInstructions([modifyComputeUnits])
          .rpc();

        console.log("✅ Collection verified:", tx);
      } catch (error) {
        console.error("\n❌ LỖI KHI VERIFY COLLECTION:");
        logError(error);
        throw error;
      }
    });
  });

  describe('Marketplace Flow', () => {
    it("Bước 1: Initialize marketplace", async () => {
      try {
        console.log("\n=== INITIALIZE MARKETPLACE ===");
        console.log("Program ID:", program.programId.toBase58());
        console.log("Marketplace Config:", marketplaceConfig.toBase58());
        
        // Xóa marketplace cũ nếu tồn tại
        try {
          const accountInfo = await provider.connection.getAccountInfo(marketplaceConfig);
          console.log("Current account owner:", accountInfo?.owner.toBase58() || "Not initialized");
          
          if (accountInfo !== null) {
            await program.methods
              .closeMarketplace()
              .accounts({
                authority: wallet.publicKey,
                config: marketplaceConfig,
                systemProgram: SystemProgram.programId,
              })
              .rpc();
            console.log("Đã close marketplace cũ");
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        } catch (err) {
          console.log("Không có marketplace cũ để close");
        }

        // Khởi tạo marketplace mới
        treasuryWallet = Keypair.generate().publicKey;
        console.log("Treasury wallet:", treasuryWallet.toBase58());

        // Kiểm tra program ID
        console.log("Expected program ID:", program.programId.toBase58());
        console.log("Current program ID:", (await provider.connection.getAccountInfo(program.programId))?.owner.toBase58());

        
       

        const tx = await program.methods
          .initializeMarketplace(200)
          .accounts({
            authority: wallet.publicKey,
            config: marketplaceConfig,
            treasuryWallet,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          } as MarketplaceAccounts)
          .signers([wallet.payer])
          .rpc();

        await provider.connection.confirmTransaction(tx);
        console.log("Transaction signature:", tx);

        // Kiểm tra account sau khi khởi tạo
        const newAccountInfo = await provider.connection.getAccountInfo(marketplaceConfig);
        console.log("New account owner:", newAccountInfo?.owner.toBase58());
        
        if (!newAccountInfo || newAccountInfo.owner.toBase58() !== program.programId.toBase58()) {
          throw new Error("Marketplace không được khởi tạo đúng cách");
        }

        console.log("✅ Đã khởi tạo marketplace mới");

      } catch (error) {
        console.error("\n❌ LỖI KHI INITIALIZE MARKETPLACE:");
        logError(error);
        throw error;
      }
    });

    it("Bước 2: List NFT", async () => {
      try {
        console.log("\n=== LIST NFT ===");
        
        const [listingAccount] = anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from('listing'), mint.toBuffer()],
          program.programId
        );

        const nftToken = getAssociatedTokenAddressSync(mint, wallet.publicKey);
        const escrowTokenAccount = getAssociatedTokenAddressSync(mint, listingAccount, true);
        
        // Log thông tin trước khi list
        console.log({
          listingAccount: listingAccount.toBase58(),
          nftMint: mint.toBase58(),
          nftToken: nftToken.toBase58(),
          seller: wallet.publicKey.toBase58(),
          price: nftPrice.toString(),
          duration: duration.toString(),
          marketplaceConfig: marketplaceConfig.toBase58()
        });

        const tx = await program.methods
          .listNft(nftPrice, duration)
          .accounts({
            owner: wallet.publicKey,
            authority: wallet.publicKey,
            listingAccount,
            nftMint: mint,
            nftToken,
            escrowTokenAccount,
            marketplaceConfig,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY
          } as ListNftAccounts)
          .rpc();

        console.log("✅ NFT listed successfully!");
        console.log("Transaction signature:", tx);
        
      } catch (error) {
        console.error("\n❌ LỖI KHI LIST NFT:");
        logError(error);
        throw error;
      }
    });

    it("Bước 3: Update listing", async () => {
      try {
        console.log("\n=== UPDATE LISTING ===");
        
        const newPrice = new BN(2_000_000_000);
        const newDuration = new BN(14 * 24 * 60 * 60);
        
        const [listingAccount] = anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from('listing'), mint.toBuffer()],
          program.programId
        );

        const escrowTokenAccount = getAssociatedTokenAddressSync(mint, listingAccount, true);

        const tx = await program.methods
          .updateListing(newPrice, newDuration)
          .accounts({
            seller: wallet.publicKey,
            listingAccount,
            nftMint: mint,
            escrowTokenAccount,
            marketplaceConfig, // Sử dụng biến global
          } as UpdateListingAccounts)
          .rpc();

        console.log("✅ Listing updated successfully!");
        console.log("Transaction signature:", tx);
        
        // Cập nhật giá và duration mới
        nftPrice = newPrice;
        duration = newDuration;

      } catch (error) {
        console.error("\n❌ LỖI KHI UPDATE LISTING:");
        logError(error);
        throw error;
      }
    });
  });

  function logError(error: any) {
    console.error("- Loại lỗi:", error.name);
    console.error("- Message:", error.message);
    if (error.logs) {
      console.error("\nProgram Logs:");
      error.logs.forEach((log: string) => console.error(log));
    }
  }
});
