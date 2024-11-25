import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createMintToInstruction, createInitializeMintInstruction, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { BN } from "bn.js";
import { BuyNftAccounts } from './types/utils';

describe('Buy NFT Tests', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.NftMarketplace as Program;
  const wallet = provider.wallet as anchor.Wallet;
  
  let mint: PublicKey;
  let mintKeypair: Keypair;
  let buyer: Keypair;
  let treasuryWallet: PublicKey;
  let marketplaceConfig: PublicKey;
  let nftPrice = new BN(1_000_000_000); // 1 SOL
  let duration = new BN(7 * 24 * 60 * 60); // 7 days
  
  // Thêm biến để track trạng thái
  let isMarketplaceInitialized = false;
  let isNftListed = false;
  let listingAccount: PublicKey;
  
  before(async () => {
    console.log("\n=== SETUP MINT AND NFT ===");
    console.log("1. Tạo mint keypair mới...");
    mintKeypair = Keypair.generate();
    mint = mintKeypair.publicKey;
    
    console.log("2. Khởi tạo mint account...");
    // Khởi tạo mint account
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

    // Tạo token account cho seller
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
    // Mint token cho seller
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
      const [marketplaceConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from('marketplace')],
        program.programId
      );

      // Close marketplace cũ nếu tồn tại
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

      // Khởi tạo marketplace mới
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
      
      const nftToken = getAssociatedTokenAddressSync(mint, wallet.publicKey);
      
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

    console.log("7. Setup buyer với 2 SOL...");
    // Setup buyer với 2 SOL
    buyer = Keypair.generate();
    const transferIx = SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: buyer.publicKey,
      lamports: 2 * LAMPORTS_PER_SOL
    });
    
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(transferIx)
    );
    
    console.log("✅ Test setup completed");
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
    
    await program.methods
      .listNft(nftPrice, duration)
      .accounts({
        owner: wallet.publicKey,
        listingAccount: newListingAccount,
        nftMint: newMint,
        nftToken,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc();
      
    // Cập nhật biến mint và listingAccount
    mint = newMint;
    listingAccount = newListingAccount;
    
    console.log("✅ New NFT minted and listed");
    return { mint, listingAccount };
  }

  it("Buy NFT Successfully", async () => {
    try {
      console.log("\n=== BUY NFT ===");
      console.log("1. Lấy marketplace config...");
      const [marketplaceConfig] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from('marketplace')],
        program.programId
      );

      console.log("2. Lấy listing account và token accounts...");
      const [listingAccount] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from('listing'), mint.toBuffer()],
        program.programId
      );

      const sellerTokenAccount = getAssociatedTokenAddressSync(mint, wallet.publicKey);
      const buyerTokenAccount = getAssociatedTokenAddressSync(mint, buyer.publicKey);

      console.log("4. Thực hiện giao dịch mua NFT...");
      await program.methods
        .buyNft()
        .accounts({
          buyer: buyer.publicKey,
          seller: wallet.publicKey,
          config: marketplaceConfig,
          listingAccount,
          nftMint: mint,
          sellerTokenAccount,
          buyerTokenAccount,
          treasuryWallet,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          marketplaceConfig,
        })
        .signers([buyer])
        .rpc();

      console.log("✅ NFT bought successfully!");

    } catch (error) {
      console.error("\n❌ LỖI KHI MUA NFT:");
      logError(error);
      throw error;
    }
  });

  it("Test Buy NFT with Insufficient Balance", async () => {
    // List NFT lại trước khi test
    await setupNewListing();
    
    try {
      console.log("\n=== TEST INSUFFICIENT BALANCE ===");
      console.log("1. Tạo poorBuyer không có SOL...");
      const poorBuyer = Keypair.generate();

      // Lấy listing account PDA
      const [listingAccount] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from('listing'), mint.toBuffer()],
        program.programId
      );

      // Lấy seller token account
      const sellerTokenAccount = getAssociatedTokenAddressSync(mint, wallet.publicKey);

      console.log("2. Tạo token account cho poorBuyer...");
      const poorBuyerTokenAccount = getAssociatedTokenAddressSync(mint, poorBuyer.publicKey);
      const createTokenAccountIx = createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        poorBuyerTokenAccount,
        poorBuyer.publicKey,
        mint
      );
      
      await provider.sendAndConfirm(
        new anchor.web3.Transaction().add(createTokenAccountIx),
        []
      );

      console.log("3. Thử mua NFT với số dư không đủ...");
      await program.methods
        .buyNft()
        .accounts({
          buyer: poorBuyer.publicKey,
          seller: wallet.publicKey,
          config: marketplaceConfig,
          listingAccount: listingAccount,
          nftMint: mint,
          sellerTokenAccount: sellerTokenAccount,
          buyerTokenAccount: poorBuyerTokenAccount,
          treasuryWallet,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          marketplaceConfig: marketplaceConfig,
        })
        .signers([poorBuyer])
        .rpc();
        
      throw new Error("Giao dịch phải thất bại do không đủ SOL");
    } catch (error: any) {
      if (!error.message.includes("Số dư không đủ để mua NFT")) {
        throw error;
      }
      console.log("✅ Test Insufficient Balance thành công");
    }
  });

  it("Test Buy Own NFT", async () => {
    // List NFT lại trước khi test
    await setupNewListing();
    
    try {
      console.log("\n=== TEST BUY OWN NFT ===");
      
      const [listingAccountPDA] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from('listing'), mint.toBuffer()],
        program.programId
      );

      const sellerTokenAccount = getAssociatedTokenAddressSync(mint, wallet.publicKey);
      const buyerTokenAccount = getAssociatedTokenAddressSync(mint, wallet.publicKey);

      await program.methods
        .buyNft()
        .accounts({
          buyer: wallet.publicKey,
          seller: wallet.publicKey,
          config: marketplaceConfig,
          listingAccount: listingAccountPDA,
          nftMint: mint,
          sellerTokenAccount,
          buyerTokenAccount,
          treasuryWallet,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          marketplaceConfig,
        })
        .rpc();

      throw new Error("Giao dịch phải thất bại khi mua NFT của chính mình");
    } catch (error: any) {
      if (!error.message.includes("Không thể mua NFT của chính mình")) {
        throw error;
      }
      console.log("✅ Test Buy Own NFT thành công");
    }
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