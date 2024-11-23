import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';

// Định nghĩa discriminator từ IDL
const LISTING_DISCRIMINATOR = [59, 89, 136, 25, 21, 196, 183, 13];

const NFT_MINT = "DtJa5wRrEFnF6WYQkUbCYJg1AcxACuqTntC89yf3YPvT";
const PROGRAM_ID = "CFSd2NBvuNZY16M3jcYZufyZbhdok4esET8N2kyEdVrs";

async function getNFTPrice() {
  try {
    console.log("Đang kết nối...");
    const connection = new anchor.web3.Connection("https://api.devnet.solana.com");
    
    const [listingAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("listing"), new anchor.web3.PublicKey(NFT_MINT).toBuffer()],
      new anchor.web3.PublicKey(PROGRAM_ID)
    );

    console.log("Listing Account:", listingAccount.toBase58());

    const accountInfo = await connection.getAccountInfo(listingAccount);
    if (!accountInfo) {
      console.log("NFT chưa được list bán");
      return;
    }

    // Bỏ qua 8 byte đầu (discriminator)
    const data = accountInfo.data.slice(8);
    
    // Parse dữ liệu theo cấu trúc ListingAccount
    const seller = new anchor.web3.PublicKey(data.slice(0, 32));
    const nftMint = new anchor.web3.PublicKey(data.slice(32, 64));
    const price = new anchor.BN(data.slice(64, 72), 'le');
    const tokenAccount = new anchor.web3.PublicKey(data.slice(72, 104));
    const createdAt = new anchor.BN(data.slice(104, 112), 'le');
    const expiresAt = new anchor.BN(data.slice(112, 120), 'le');

    console.log("\nNFT Listing Details:");
    console.log("Price:", price.toString(), "lamports");
    console.log("Price in SOL:", price.toNumber() / anchor.web3.LAMPORTS_PER_SOL);
    console.log("Seller:", seller.toBase58());
    console.log("NFT Mint:", nftMint.toBase58());
    console.log("Token Account:", tokenAccount.toBase58());
    console.log("Listed at:", new Date(createdAt.toNumber() * 1000).toLocaleString());
    console.log("Expires at:", new Date(expiresAt.toNumber() * 1000).toLocaleString());

  } catch (error) {
    console.error("Có lỗi xảy ra:", error);
  }
}

getNFTPrice().catch(console.error);