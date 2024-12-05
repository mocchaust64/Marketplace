import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair } from '@solana/web3.js';
import { findMarketplaceConfigPDA, UpdateFeePercentageAccounts, MarketplaceAccounts } from './types/utils';
import { NftMarketplace } from '../target/types/nft_marketplace';

describe('Update Fee Tests', () => {
  console.log("\n=== KHỞI TẠO TEST ENVIRONMENT ===");
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  console.log("✓ Provider được khởi tạo");
  
  const program = anchor.workspace.NftMarketplace as Program<NftMarketplace>;
  console.log("✓ Program ID:", program.programId.toBase58());
  
  const wallet = provider.wallet as anchor.Wallet;
  console.log("✓ Wallet pubkey:", wallet.publicKey.toBase58());
  
  let treasuryWallet: PublicKey;
  let marketplaceConfig: PublicKey;

  before(async () => {
    console.log("\n=== SETUP BEFORE TESTS ===");
    console.log("-> Tìm PDA cho marketplace config");
    const [config] = findMarketplaceConfigPDA(program.programId);
    marketplaceConfig = config;
    console.log("✓ Marketplace config PDA:", marketplaceConfig.toBase58());
    
    console.log("\n-> Khởi tạo marketplace");
    await initializeMarketplace();
  });

  async function closeExistingMarketplace() {
    console.log("\n-> Kiểm tra và đóng marketplace cũ...");
    try {
      const accountInfo = await provider.connection.getAccountInfo(marketplaceConfig);
      console.log("Account info:", accountInfo ? "Tồn tại" : "Không tồn tại");
      
      if (accountInfo !== null) {
        console.log("Tiến hành đóng marketplace cũ...");
        const tx = await program.methods
          .closeMarketplace()
          .accounts({
            authority: wallet.publicKey,
            config: marketplaceConfig,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        console.log("✓ Transaction signature:", tx);
        console.log("✓ Đã đóng marketplace cũ thành công");
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (err) {
      console.log("Không có marketplace cũ để đóng:", err);
    }
  }

  async function verifyMarketplaceInitialization(tx: string) {
    console.log("\n-> Verify kết quả khởi tạo");
    await provider.connection.confirmTransaction(tx);
    console.log("✓ Transaction confirmed:", tx);

    const accountInfo = await provider.connection.getAccountInfo(marketplaceConfig);
    console.log("✓ Account owner:", accountInfo?.owner.toBase58());
    console.log("✓ Account data length:", accountInfo?.data.length);
    
    // Log raw account data
    console.log("Raw account data:", Buffer.from(accountInfo!.data).toString('hex'));
    
    try {
      // Thử decode thủ công
      const data = accountInfo!.data;
      const authority = new PublicKey(data.slice(8, 40));
      const treasuryWallet = new PublicKey(data.slice(40, 72));
      const feePercentage = data.readUInt16LE(72);
      const isPaused = data[74] === 1;
      const bump = data[75];
      
      console.log("✓ Manual decoded data:", {
        authority: authority.toBase58(),
        treasuryWallet: treasuryWallet.toBase58(),
        feePercentage,
        isPaused,
        bump
      });

      // Thử decode bằng Anchor
      const decodedAccount = program.coder.accounts.decode(
        "MarketplaceConfig",
        accountInfo!.data
      );
      console.log("✓ Anchor decoded data:", decodedAccount);
    } catch (err) {
      console.error("❌ Không thể decode account data:", err);
    }

    if (!accountInfo || accountInfo.owner.toBase58() !== program.programId.toBase58()) {
      throw new Error("Marketplace không được khởi tạo đúng cách");
    }
    console.log("✓ Marketplace được khởi tạo thành công");
  }

  async function initializeMarketplace() {
    console.log("\n=== KHỞI TẠO MARKETPLACE ===");
    console.log("-> Bước 1: Đóng marketplace cũ nếu có");
    await closeExistingMarketplace();
    
    console.log("\n-> Bước 2: Tạo treasury wallet mới");
    treasuryWallet = Keypair.generate().publicKey;
    console.log("✓ Treasury wallet:", treasuryWallet.toBase58());

    console.log("\n-> Bước 3: Gọi initializeMarketplace instruction");
    console.log("Fee ban đầu:", 500);
    const tx = await program.methods
      .initializeMarketplace(500)
      .accounts({
        authority: wallet.publicKey,
        config: marketplaceConfig,
        treasuryWallet,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      } as MarketplaceAccounts)
      .rpc();
    
    console.log("✓ Transaction signature:", tx);
    await verifyMarketplaceInitialization(tx);
    
    console.log("-> Đợi 5 giây để account được tạo hoàn toàn...");
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const finalCheck = await provider.connection.getAccountInfo(marketplaceConfig);
    console.log("Final account check:", finalCheck ? "Tồn tại" : "Không tồn tại");
    
    return tx;
  }

  it("Authority có thể update fee", async () => {
    try {
      console.log("\n=== TEST UPDATE FEE ===");
      
      // Verify trước khi update
      console.log("-> Verify marketplace config account");
      const configAccountInfo = await provider.connection.getAccountInfo(marketplaceConfig);
      if (!configAccountInfo) {
        throw new Error("Marketplace config không tồn tại trước khi update fee");
      }
      console.log("✓ Account data length:", configAccountInfo.data.length);
      console.log("✓ Account owner:", configAccountInfo.owner.toBase58());
      
      // Thêm logging cho discriminator và raw data
      const discriminator = Buffer.from(program.coder.accounts.memcmp(
        "MarketplaceConfig",
        marketplaceConfig.toBuffer()
      ).bytes).slice(0, 8);

      console.log("Expected discriminator:", discriminator.toString('hex'));
      console.log("Raw account data (first 8 bytes):", Buffer.from(configAccountInfo.data.slice(0, 8)).toString('hex'));

      try {
        const initialConfig = program.coder.accounts.decode(
          "MarketplaceConfig",
          configAccountInfo.data
        );
        console.log("✓ Initial account data:", {
          authority: initialConfig.authority.toBase58(),
          treasuryWallet: initialConfig.treasuryWallet.toBase58(),
          feePercentage: initialConfig.feePercentage,
          isPaused: initialConfig.isPaused,
          bump: initialConfig.bump
        });
      } catch (err) {
        console.error("❌ Không thể decode account data trước update:", err);
        throw err;
      }

      console.log("-> Bước 1: Chuẩn bị dữ liệu");
      const newFee = 1000;
      console.log("✓ Fee mới:", newFee);
      console.log("✓ Authority:", wallet.publicKey.toBase58());
      console.log("✓ Config account:", marketplaceConfig.toBase58());

      console.log("\n-> Bước 2: Gọi updateFee instruction");
      console.log("Sending transaction...");
      const tx = await program.methods
        .updateFee(newFee)
        .accounts({
          authority: wallet.publicKey,
          config: marketplaceConfig
        } as UpdateFeePercentageAccounts)
        .rpc();

      console.log("\n-> Bước 3: Đợi transaction confirm");
      await provider.connection.confirmTransaction(tx);
      console.log("-> Đợi 3 giây để transaction được xử lý...");
      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log("\n-> Bước 4: Verify kết quả");
      const finalAccountInfo = await provider.connection.getAccountInfo(marketplaceConfig);
      if (!finalAccountInfo) {
        throw new Error("Không tìm thấy marketplace config account");
      }
      console.log("✓ Account vẫn tồn tại sau update");
      console.log("✓ Account data length:", finalAccountInfo.data.length);
      console.log("✓ Account owner:", finalAccountInfo.owner.toBase58());

      const updatedConfig = program.coder.accounts.decode(
        "MarketplaceConfig",
        finalAccountInfo.data
      );
      console.log("✓ Updated account data:", {
        authority: updatedConfig.authority.toBase58(),
        treasuryWallet: updatedConfig.treasuryWallet.toBase58(),
        feePercentage: updatedConfig.feePercentage,
        isPaused: updatedConfig.isPaused
      });

      if (updatedConfig.feePercentage === newFee) {
        console.log("✅ Update fee thành công");
      } else {
        throw new Error(`Fee không đúng. Expected: ${newFee}, Got: ${updatedConfig.feePercentage}`);
      }
    } catch (err) {
      console.error("❌ Lỗi update fee:");
      logError(err);
      throw err;
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