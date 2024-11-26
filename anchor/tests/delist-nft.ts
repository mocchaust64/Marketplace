import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createInitializeMintInstruction, createAssociatedTokenAccountInstruction, createMintToInstruction, createTransferInstruction } from "@solana/spl-token";
import { DelistNftAccounts, ListingAccount } from './types/utils';
import { BN } from "bn.js";
import { ComputeBudgetProgram } from "@solana/web3.js";

function logError(error: any) {
  if (error.logs) {
    console.log("Program Logs:", error.logs);
  }
  
  if (error.error) {
    console.log("Error:", error.error);
  }
  
  if (error.message) {
    console.log("Message:", error.message); 
  }
}

describe('Delist NFT Tests', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.nft_marketplace as Program;
  const wallet = provider.wallet as anchor.Wallet;
  
  let mint: PublicKey;
  let mintKeypair: Keypair;
  let treasuryWallet: PublicKey;
  let marketplaceConfig: PublicKey;
  let nftPrice = new BN(1_000_000_000); // 1 SOL
  let duration = new BN(7 * 24 * 60 * 60); // 7 days
  
  let isMarketplaceInitialized = false;
  let isNftListed = false;
  let listingAccount: PublicKey;

  before(async () => {
    console.log("\n=== SETUP MINT AND NFT ===");
    console.log("1. Tạo mint keypair mới...");
    mintKeypair = Keypair.generate();
    mint = mintKeypair.publicKey;
    
    console.log("2. Khởi tạo mint account...");
    const lamports = await provider.connection.getMinimumBalanceForRentExemption(82);
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
      wallet.publicKey,
      wallet.publicKey
    );

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

    console.log("3. Tạo token account cho seller...");
    console.log("✅ Mint account và token account đã được khởi tạo");
    
    console.log("4. Mint token cho seller...");
    const mintToIx = createMintToInstruction(
      mint,
      nftToken,
      wallet.publicKey,
      1
    );
    
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(mintToIx),
      []
    );

    console.log("✅ Đã mint token cho seller");

    console.log("5. Setup marketplace...");
    if (!isMarketplaceInitialized) {
      [marketplaceConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from('marketplace')],
        program.programId
      );

      try {
        await program.methods
          .closeMarketplace()
          .accounts({
            authority: wallet.publicKey,
            config: marketplaceConfig,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        console.log("Đã close marketplace cũ");
      } catch (err) {
        console.log("Không có marketplace cũ để close");
      }

      treasuryWallet = Keypair.generate().publicKey;
      await program.methods
        .initializeMarketplace(200)
        .accounts({
          authority: wallet.publicKey,
          config: marketplaceConfig,
          treasuryWallet,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      isMarketplaceInitialized = true;
      console.log("✅ Marketplace initialized");
    }

    console.log("6. List NFT...");
    if (!isNftListed) {
      [listingAccount] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from('listing'), mint.toBuffer()],
        program.programId
      );
      
      await program.methods
        .listNft(nftPrice, duration)
        .accounts({
          owner: wallet.publicKey,
          listingAccount,
          nftMint: mint,
          nftToken,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();
        
      isNftListed = true;
      console.log("✅ NFT listed successfully");
    }
  });

  async function setupNewListing() {
    console.log("\nSetup new listing...");
    
    // 1. Tạo mint mới
    const newMintKeypair = Keypair.generate();
    const newMint = newMintKeypair.publicKey;
    
    // 2. Khởi tạo mint account
    const lamports = await provider.connection.getMinimumBalanceForRentExemption(82);
    const createAccountIx = SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: newMint,
      space: 82,
      lamports: lamports,
      programId: TOKEN_PROGRAM_ID
    });

    const initializeMintIx = createInitializeMintInstruction(
      newMint,
      0,
      wallet.publicKey,
      wallet.publicKey
    );

    // 3. Tạo token account cho seller
    const nftToken = getAssociatedTokenAddressSync(newMint, wallet.publicKey);
    const createTokenAccountIx = createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      nftToken,
      wallet.publicKey,
      newMint
    );

    await provider.sendAndConfirm(
      new anchor.web3.Transaction()
        .add(createAccountIx)
        .add(initializeMintIx)
        .add(createTokenAccountIx),
      [newMintKeypair]
    );

    // 4. Mint token
    const mintToIx = createMintToInstruction(
      newMint,
      nftToken,
      wallet.publicKey,
      1
    );
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(mintToIx),
      []
    );

    // 5. List NFT
    const [newListingAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('listing'), newMint.toBuffer()],
      program.programId
    );
    
    const escrowTokenAccount = getAssociatedTokenAddressSync(newMint, newListingAccount, true);

    await program.methods
      .listNft(nftPrice, duration)
      .accounts({
        owner: wallet.publicKey,
        listingAccount: newListingAccount,
        nftMint: newMint,
        nftToken,
        escrowTokenAccount,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY
      })
      .rpc();
      
    // Cập nhật biến mint và listingAccount
    mint = newMint;
    listingAccount = newListingAccount;
    
    console.log("✅ New NFT minted and listed");
    return { mint, listingAccount };
  }

  async function closeExistingListing(listingAccount: PublicKey) {
    try {
      const listingData = await program.account.listingAccount.fetch(listingAccount);
      if (listingData) {
        const ownerTokenAccount = getAssociatedTokenAddressSync(mint, wallet.publicKey);
        const escrowTokenAccount = getAssociatedTokenAddressSync(
          mint,
          listingAccount,
          true
        );

        await program.methods
          .delistNft()
          .accounts({
            owner: wallet.publicKey,
            listingAccount,
            nftMint: mint,
            ownerTokenAccount,
            escrowTokenAccount,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY
          } )
          .rpc();
      }
    } catch (error) {
      console.log("Không có listing cần close hoặc lỗi khi close:", error);
    }
  }

  it("Delist NFT Successfully", async () => {
    try {
      console.log("\n=== DELIST NFT ===");
      
      await setupNewListing();
      
      const [listingAccount] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from('listing'), mint.toBuffer()],
        program.programId
      );

      const ownerTokenAccount = getAssociatedTokenAddressSync(mint, wallet.publicKey);
      const escrowTokenAccount = getAssociatedTokenAddressSync(
        mint,
        listingAccount,
        true
      );

      const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
        units: 300_000
      });

      const listingData = await program.account.listingAccount.fetch(listingAccount);
      console.log("Listing status:", listingData);

      if (!listingData.isActive) {
        throw new Error("Listing không còn active");
      }

      const tx = await program.methods
        .delistNft()
        .accounts({
          owner: wallet.publicKey,
          listingAccount,
          nftMint: mint,
          ownerTokenAccount,
          escrowTokenAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY
        })
        .preInstructions([modifyComputeUnits])
        .rpc();

      console.log("✅ NFT delisted successfully!");
      
    } catch (error) {
      console.error("Error details:", error);
      if (error.logs) {
        console.log("Program logs:", error.logs);
      }
      throw error;
    }
  });

  it("Test Invalid Seller Error", async () => {
    try {
      await setupNewListing();
      
      const invalidSeller = Keypair.generate();
      const [listingAccount] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from('listing'), mint.toBuffer()],
        program.programId
      );

      const ownerTokenAccount = getAssociatedTokenAddressSync(mint, invalidSeller.publicKey);
      const escrowTokenAccount = getAssociatedTokenAddressSync(
        mint,
        listingAccount,
        true
      );

      // Transfer SOL cho invalid seller
      const transferIx = SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: invalidSeller.publicKey,
        lamports: LAMPORTS_PER_SOL 
      });

      await provider.sendAndConfirm(
        new anchor.web3.Transaction().add(transferIx),
        []
      );

      // Tạo token account cho invalid seller
      const createTokenAccountIx = createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        ownerTokenAccount,
        invalidSeller.publicKey, 
        mint
      );

      await provider.sendAndConfirm(
        new anchor.web3.Transaction()
          .add(createTokenAccountIx),
        []
      );

      await program.methods
        .delistNft()
        .accounts({
          owner: invalidSeller.publicKey,
          listingAccount,
          nftMint: mint,
          ownerTokenAccount,
          escrowTokenAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY
        } )
        .signers([invalidSeller])
        .rpc();

      throw new Error("Giao dịch phải thất bại với người bán không hợp lệ");
    } catch (error: any) {
      if (!error.message.includes("InvalidSeller")) {
        throw error;
      }
      console.log("✅ Test Invalid Seller thành công");
    }
  });
});