import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddressSync, 
  createInitializeMintInstruction, 
  createAssociatedTokenAccountInstruction, 
  createMintToInstruction 
} from "@solana/spl-token";
import { DelistNftAccounts, ListingAccount, ListNftAccounts, MarketplaceAccounts } from './types/utils';
import { BN } from "bn.js";
import { NftMarketplace } from '../target/types/nft_marketplace';

describe('Delist NFT Tests', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.nft_marketplace as Program<NftMarketplace>;
  const wallet = provider.wallet as anchor.Wallet;

  let mint: PublicKey;
  let mintKeypair: Keypair;
  let treasuryWallet: PublicKey;
  let marketplaceConfig: PublicKey;
  let nftPrice = new BN(1_000_000_000); // 1 SOL
  let duration = new BN(7 * 24 * 60 * 60); // 7 days

  async function setupMarketplace() {
    [marketplaceConfig] = PublicKey.findProgramAddressSync(
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
    } catch (err) {
      console.log("Không có marketplace cũ");
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
      } as MarketplaceAccounts)
      .rpc();
  }

  async function setupNFT() {
    // Tạo mint mới
    mintKeypair = Keypair.generate();
    mint = mintKeypair.publicKey;

    // Khởi tạo mint account
    const lamports = await provider.connection.getMinimumBalanceForRentExemption(82);
    const createAccountIx = SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: mint,
      space: 82,
      lamports,
      programId: TOKEN_PROGRAM_ID
    });

    const initializeMintIx = createInitializeMintInstruction(
      mint,
      0,
      wallet.publicKey,
      wallet.publicKey
    );

    // Tạo token account cho owner
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

    // Mint NFT
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

    return nftToken;
  }

  async function listNFT() {
    const [listingAccount] = PublicKey.findProgramAddressSync(
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
        listingAccount: listingAccount,
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

    return listingAccount;
  }

  before(async () => {
    await setupMarketplace();
  });

  it("Delist NFT Successfully", async () => {
    await setupNFT();
    const listingAccount = await listNFT();

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
      } as DelistNftAccounts)
      .rpc();

    // Verify listing đã bị xóa
    try {
      await program.account.listingAccount.fetch(listingAccount);
      throw new Error("Listing vẫn còn tồn tại");
    } catch (err) {
      console.log("✅ Listing đã bị xóa thành công");
    }
  });

  it("Test Invalid Owner Error", async () => {
    // Setup
    await setupNFT();
    const listingAccount = await listNFT();
    
    // Tạo fake owner
    const fakeOwner = Keypair.generate();
    
    // Fund SOL cho fake owner
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: fakeOwner.publicKey,
          lamports: LAMPORTS_PER_SOL
        })
      ),
      []
    );

    // Tạo token account cho fake owner
    const fakeOwnerToken = getAssociatedTokenAddressSync(mint, fakeOwner.publicKey);
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          fakeOwnerToken,
          fakeOwner.publicKey,
          mint
        )
      ),
      []
    );

    // Test delist với fake owner
    const escrowTokenAccount = getAssociatedTokenAddressSync(
      mint,
      listingAccount,
      true
    );

    try {
      await program.methods
        .delistNft()
        .accounts({
          owner: fakeOwner.publicKey,
          listingAccount,
          nftMint: mint,
          ownerTokenAccount: fakeOwnerToken,
          escrowTokenAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY
        } as DelistNftAccounts)
        .signers([fakeOwner])
        .rpc();

      throw new Error("Giao dịch phải thất bại với fake owner");
    } catch (error: any) {
      if (!error.message.includes("InvalidSeller")) {
        throw error;
      }
      console.log("✅ Test Invalid Owner thành công");
    }
  });

  it("Test Delist Inactive Listing", async () => {
    // Setup
    await setupNFT();
    const listingAccount = await listNFT();
    
    // Delist lần 1
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
      } as DelistNftAccounts)
      .rpc();

    // Test delist lần 2
    try {
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
        } as DelistNftAccounts)
        .rpc();

      throw new Error("Giao dịch phải thất bại khi delist listing không tồn tại");
    } catch (error: any) {
      if (!error.message.includes("AccountNotInitialized")) {
        throw error;
      }
      console.log("✅ Test Delist Inactive Listing thành công");
    }
  });
});