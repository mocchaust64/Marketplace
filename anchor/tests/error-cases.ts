import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createInitializeMintInstruction, createAssociatedTokenAccountInstruction, createMintToInstruction } from '@solana/spl-token';
import { SystemProgram, Keypair } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { MintNft } from '../target/types/mint_nft';
import { ListNftAccounts, UpdateListingAccounts, MarketplaceAccounts } from './types/utils';
import { PublicKey } from '@solana/web3.js';

describe('NFT Marketplace Error Cases', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.NftMarketplace as Program;
  const wallet = provider.wallet as anchor.Wallet;
  
  let mint: PublicKey;
  let mintKeypair: Keypair;
  let marketplaceConfig: PublicKey;
  let treasuryWallet: PublicKey;
  let nftPrice = new BN(1_000_000_000);
  let duration = new BN(7 * 24 * 60 * 60);

  before(async () => {
    // Thêm hàm close marketplace
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

    console.log("\n=== SETUP MINT ACCOUNT ===");
    console.log("Khởi tạo mint keypair mới...");
    
    mintKeypair = Keypair.generate();
    mint = mintKeypair.publicKey;
    console.log("Mint pubkey:", mint.toBase58());
    
    const lamports = await provider.connection.getMinimumBalanceForRentExemption(82);
    console.log("Lamports cần thiết:", lamports);
    
    console.log("\nTạo các instructions...");
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
    console.log("Token account address:", nftToken.toBase58());
    
    const createTokenAccountIx = createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      nftToken,
      wallet.publicKey,
      mint
    );
    
    console.log("\nGửi transaction...");
    const tx = await provider.sendAndConfirm(
      new anchor.web3.Transaction()
        .add(createAccountIx)
        .add(initializeMintIx)
        .add(createTokenAccountIx),
      [mintKeypair]
    );
    console.log("Transaction signature:", tx);
    console.log("✅ Mint account và token account đã được khởi tạo\n");
    
    // Thêm bước mint token
    const mintToIx = createMintToInstruction(
      mint,
      getAssociatedTokenAddressSync(mint, wallet.publicKey),
      wallet.publicKey,
      1
    );
    
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(mintToIx),
      []
    );
    
    console.log("✅ Đã mint token cho owner");
    
    // Thêm code khởi tạo marketplace sau phần mint token
    console.log("\nKhởi tạo marketplace...");
    [marketplaceConfig] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('marketplace')],
      program.programId
    );
    
    // Close marketplace cũ trước
    await closeExistingMarketplace();
    
    // Khởi tạo marketplace mới
    treasuryWallet = Keypair.generate().publicKey;
    await program.methods
      .initializeMarketplace(200)
      .accounts({
        authority: wallet.publicKey,
        config: marketplaceConfig,
        treasuryWallet,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([wallet.payer])
      .rpc();
    
    console.log("✅ Đã khởi tạo marketplace");

    async function verifyMarketplaceInitialization(tx: string) {
      await provider.connection.confirmTransaction(tx);
      console.log("Transaction signature:", tx);

      const newAccountInfo = await provider.connection.getAccountInfo(marketplaceConfig);
      console.log("New account owner:", newAccountInfo?.owner.toBase58());
      
      if (!newAccountInfo || newAccountInfo.owner.toBase58() !== program.programId.toBase58()) {
        throw new Error("Marketplace không được khởi tạo đúng cách");
      }
    }

    // Thêm verify sau khi khởi tạo marketplace
    await verifyMarketplaceInitialization(tx);
  });

  it("Test InvalidPrice Error", async () => {
    console.log("\n=== TEST INVALID PRICE ERROR ===");
    console.log("Chuẩn bị dữ liệu test...");
    
    const invalidPrice = new BN(0);
    const duration = new BN(7 * 24 * 60 * 60);
    console.log("Price:", invalidPrice.toString());
    console.log("Duration:", duration.toString(), "seconds");
    
    const [listingAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('listing'), mint.toBuffer()],
      program.programId
    );
    console.log("Listing account PDA:", listingAccount.toBase58());

    const nftToken = getAssociatedTokenAddressSync(mint, wallet.publicKey);
    console.log("NFT token account:", nftToken.toBase58());
    
    console.log("\nThử list NFT với giá 0 SOL...");
    
    try {
      const escrowTokenAccount = getAssociatedTokenAddressSync(mint, listingAccount, true);

      await program.methods
        .listNft(invalidPrice, duration)
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
      
      throw new Error("Giao dịch phải thất bại với giá = 0");
    } catch (error: any) {
      if (!error.message.includes("Giá phải lớn hơn 0")) {
        console.error("\n❌ Lỗi không mong muốn:");
        logError(error);
        throw new Error(`Lỗi không đúng như mong đợi: ${error.message}`);
      }
      console.log("✅ Test InvalidPrice thành công - Lỗi như mong đợi");
    }
  });

  // Thêm biến để track trạng thái
  let isNftListed = false;

  // Test case 1: InvalidOwner Error 
  it("Test InvalidOwner Error", async () => {
    console.log("\n=== TEST INVALID OWNER ERROR ===");
    console.log("Chuẩn bị dữ liệu test...");
    
    const fakeOwner = Keypair.generate();
    const price = new BN(1_000_000_000);
    const duration = new BN(7 * 24 * 60 * 60);
    
    // Chuyển SOL cho fake owner
    const transferIx = SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: fakeOwner.publicKey,
      lamports: 10_000_000 // 0.01 SOL
    });
    
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(transferIx),
      []
    );
    
    // Tạo token account cho fake owner
    const fakeOwnerToken = getAssociatedTokenAddressSync(mint, fakeOwner.publicKey);
    const createTokenAccountIx = createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      fakeOwnerToken, 
      fakeOwner.publicKey,
      mint
    );
    
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(createTokenAccountIx),
      []
    );

    console.log("Fake owner pubkey:", fakeOwner.publicKey.toBase58());
    console.log("Fake owner's token account:", fakeOwnerToken.toBase58());
    
    const [listingAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('listing'), mint.toBuffer()],
      program.programId
    );
    console.log("Listing account PDA:", listingAccount.toBase58());

    const nftToken = getAssociatedTokenAddressSync(mint, fakeOwner.publicKey);
    console.log("Fake owner's NFT token account:", nftToken.toBase58());
    
    console.log("\nThử list NFT với fake owner...");
    
    try {
      const escrowTokenAccount = getAssociatedTokenAddressSync(mint, listingAccount, true);

      await program.methods
        .listNft(price, duration)
        .accounts({
          owner: fakeOwner.publicKey,
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
        .signers([fakeOwner])
        .rpc();
      
      throw new Error("Giao dịch phải thất bại với fake owner");
    } catch (error: any) {
      if (!error.message.includes("Bạn không sở hữu NFT này")) {
        console.error("\n❌ Lỗi không mong muốn:");
        logError(error);
        throw new Error(`Lỗi không đúng như mong đợi: ${error.message}`);
      }
      console.log("✅ Test InvalidOwner thành công - Lỗi như mong đợi");
    }
  });

  // Test case 2: InvalidSeller Error
  it("Test InvalidSeller Error", async () => {
    console.log("\n=== TEST INVALID SELLER ERROR ===");
    
    // List NFT với owner thật
    const listPrice = new BN(1_000_000_000);
    const listDuration = new BN(7 * 24 * 60 * 60);
    
    const [listingAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('listing'), mint.toBuffer()],
      program.programId
    );
    
    const nftToken = getAssociatedTokenAddressSync(mint, wallet.publicKey);
    
    try {
      // Khởi tạo marketplace trước
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
      const treasuryWallet = Keypair.generate().publicKey;
      await program.methods
        .initializeMarketplace(200)
        .accounts({
          authority: wallet.publicKey,
          config: marketplaceConfig,
          treasuryWallet,
          systemProgram: SystemProgram.programId,
        } )
        .rpc();

      console.log("✅ Đã khởi tạo marketplace mới");

      // List NFT
      await program.methods
        .listNft(listPrice, listDuration)
        .accounts({
          owner: wallet.publicKey,
          listingAccount,
          nftMint: mint,
          nftToken,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        } )
        .rpc();
        
      console.log("✅ NFT đã được list bởi owner thật");

      // Test với fake seller
      const fakeSeller = Keypair.generate();
      const newPrice = new BN(2_000_000_000);
      const newDuration = new BN(14 * 24 * 60 * 60);
      
      console.log("\nThử update listing với fake seller...");
      console.log("Fake seller pubkey:", fakeSeller.publicKey.toBase58());
      
      try {
        await program.methods
          .updateListing(newPrice, newDuration)
          .accounts({
            seller: fakeSeller.publicKey,
            listingAccount,
            nftMint: mint,
            marketplaceConfig,
          } )
          .signers([fakeSeller])
          .rpc();
        
        throw new Error("Giao dịch phải thất bại với fake seller");
      } catch (error: any) {
        if (!error.message.includes("constraint was violated")) {
          console.error("\n❌ Lỗi không mong muốn:");
          logError(error);
          throw new Error(`Lỗi không đúng như mong đợi: ${error.message}`);
        }
        console.log("✅ Test InvalidSeller thành công - Lỗi như mong đợi");
      }
    } catch (error) {
      console.error("\n❌ Lỗi khi list NFT:");
      logError(error);
      throw error;
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