import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createMintToInstruction, createInitializeMintInstruction, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { BN } from "bn.js";
import { BuyNftAccounts, MarketplaceAccounts } from './types/utils';

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
  // Thêm sau dòng 25 trong buy-nft.ts
async function closeExistingMarketplace() {
  try {
    const accountInfo = await provider.connection.getAccountInfo(marketplaceConfig);
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
}

async function verifyMarketplaceInitialization(tx: string) {
  await provider.connection.confirmTransaction(tx);
  console.log("Transaction signature:", tx);

  const newAccountInfo = await provider.connection.getAccountInfo(marketplaceConfig);
  console.log("New account owner:", newAccountInfo?.owner.toBase58());
  
  if (!newAccountInfo || newAccountInfo.owner.toBase58() !== program.programId.toBase58()) {
    throw new Error("Marketplace không được khởi tạo đúng cách");
  }
  console.log("✅ Đã khởi tạo marketplace mới");
}

async function initializeMarketplace() {
  console.log("\n=== INITIALIZE MARKETPLACE ===");
  
  // Kiểm tra và close marketplace cũ
  await closeExistingMarketplace();
  
  // Khởi tạo marketplace mới
  treasuryWallet = Keypair.generate().publicKey;
  const tx = await program.methods
    .initializeMarketplace(200)
    .accounts({
      authority: wallet.publicKey,
      config: marketplaceConfig,
      treasuryWallet,
      systemProgram: SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    } )
    .signers([wallet.payer])
    .rpc();
    
  await verifyMarketplaceInitialization(tx);
  return tx;
}
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
      marketplaceConfig = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from('marketplace')],
        program.programId
      )[0];
      
      await initializeMarketplace();
      isMarketplaceInitialized = true;
    }

    console.log("6. List NFT...");
    if (!isNftListed) {
      [listingAccount] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from('listing'), mint.toBuffer()],
        program.programId
      );
      
      const nftToken = getAssociatedTokenAddressSync(mint, wallet.publicKey);
      
      const escrowTokenAccount = getAssociatedTokenAddressSync(
        mint,
        listingAccount,
        true
      );
      
      await program.methods
        .listNft(nftPrice, duration)
        .accounts({
          owner: wallet.publicKey,
          listingAccount,
          nftMint: mint,
          nftToken,
          escrowTokenAccount,
          marketplaceConfig,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY
        })
        .rpc();
        
      isNftListed = true;
      console.log("✅ NFT listed successfully");
    }

    console.log("7. Setup buyer với 2 SOL...");
    buyer = Keypair.generate();
    
    // Transfer 2 SOL cho buyer
    const transferSOLIx = SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: buyer.publicKey,
      lamports: 2 * LAMPORTS_PER_SOL
    });

    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(transferSOLIx),
      []
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
    
    const escrowTokenAccount = getAssociatedTokenAddressSync(newMint, newListingAccount, true);

    await program.methods
      .listNft(nftPrice, duration)
      .accounts({
        owner: wallet.publicKey,
        listingAccount: newListingAccount,
        nftMint: newMint,
        nftToken,
        escrowTokenAccount,
        marketplaceConfig,
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

  it("Buy NFT Successfully", async () => {
    try {
      console.log("\n=== BUY NFT ===");
      
      // Tạo buyer mới và fund SOL
      buyer = Keypair.generate();
      const transferIx = SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: buyer.publicKey, 
        lamports: 2 * LAMPORTS_PER_SOL
      });
      
      await provider.sendAndConfirm(
        new anchor.web3.Transaction().add(transferIx),
        []
      );
      
      // Setup listing mới
      await setupNewListing();
      
      // Lấy các accounts cần thiết
      const [listingAccountPDA] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from('listing'), mint.toBuffer()],
        program.programId
      );

      const sellerTokenAccount = getAssociatedTokenAddressSync(mint, wallet.publicKey);
      const buyerTokenAccount = getAssociatedTokenAddressSync(mint, buyer.publicKey);
      const escrowTokenAccount = getAssociatedTokenAddressSync(
        mint,
        listingAccountPDA,
        true
      );

      // Tạo token account cho buyer
      const createTokenAccountIx = createAssociatedTokenAccountInstruction(
        wallet.publicKey, // Sử dụng wallet để trả phí rent
        buyerTokenAccount,
        buyer.publicKey,
        mint
      );

      // Tạo token account cho buyer trước
      await provider.sendAndConfirm(
        new anchor.web3.Transaction().add(createTokenAccountIx),
        []
      );

      console.log("Thực hiện giao dịch mua NFT...");
      const modifyComputeUnits = anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
        units: 300_000
      });

      await program.methods
        .buyNft()
        .accounts({
          buyer: buyer.publicKey,
          seller: wallet.publicKey,
          config: marketplaceConfig,
          listingAccount: listingAccountPDA,
          nftMint: mint,
          sellerTokenAccount,
          escrowTokenAccount,
          buyerTokenAccount,
          treasuryWallet,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .preInstructions([modifyComputeUnits])
        .signers([buyer])
        .rpc();

      console.log("✅ Mua NFT thành công!");
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
      const poorBuyerTokenAccount = getAssociatedTokenAddressSync(mint, poorBuyer.publicKey);
      // Lấy listing account PDA
      const [listingAccount] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from('listing'), mint.toBuffer()],
        program.programId
      );
      // Lấy seller token account
      const sellerTokenAccount = getAssociatedTokenAddressSync(mint, wallet.publicKey);
      console.log("2. Tạo token account cho poorBuyer...");
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
      const escrowTokenAccount = getAssociatedTokenAddressSync(
        mint,
        listingAccount,
        true
      );

      await program.methods
        .buyNft()
        .accounts({
          buyer: poorBuyer.publicKey,
          seller: wallet.publicKey,
          config: marketplaceConfig,
          listingAccount: listingAccount,
          nftMint: mint,
          sellerTokenAccount: sellerTokenAccount,
          escrowTokenAccount,
          buyerTokenAccount: poorBuyerTokenAccount,
          treasuryWallet,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
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

      const escrowTokenAccount = getAssociatedTokenAddressSync(
        mint,
        listingAccountPDA,
        true
      );

      await program.methods
        .buyNft()
        .accounts({
          buyer: wallet.publicKey,
          seller: wallet.publicKey,
          config: marketplaceConfig,
          listingAccount: listingAccountPDA,
          nftMint: mint,
          sellerTokenAccount,
          escrowTokenAccount,
          buyerTokenAccount,
          treasuryWallet,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
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