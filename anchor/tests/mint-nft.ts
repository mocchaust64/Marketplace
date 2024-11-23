import * as anchor from '@coral-xyz/anchor';
import type { Program } from '@coral-xyz/anchor';
import type NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet';
import { ASSOCIATED_PROGRAM_ID } from '@coral-xyz/anchor/dist/cjs/utils/token';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { Keypair, SystemProgram } from '@solana/web3.js';
import type { MintNft } from '../target/types/mint_nft';

describe('mint-nft', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const wallet = provider.wallet as NodeWallet;

  const program = anchor.workspace.MintNft as Program<MintNft>;

  const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

  const mintAuthority = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from('authority')], program.programId)[0];

  const collectionKeypair = Keypair.generate();
  const collectionMint = collectionKeypair.publicKey;

  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;

  const getMetadata = async (mint: anchor.web3.PublicKey): Promise<anchor.web3.PublicKey> => {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      TOKEN_METADATA_PROGRAM_ID,
    )[0];
  };

  const getMasterEdition = async (mint: anchor.web3.PublicKey): Promise<anchor.web3.PublicKey> => {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer(), Buffer.from('edition')],
      TOKEN_METADATA_PROGRAM_ID,
    )[0];
  };

  it('Create Collection NFT', async () => {
    console.log('\nCollection Mint Key: ', collectionMint.toBase58());

    const metadata = await getMetadata(collectionMint);
    console.log('Collection Metadata Account: ', metadata.toBase58());

    const masterEdition = await getMasterEdition(collectionMint);
    console.log('Master Edition Account: ', masterEdition.toBase58());

    const destination = getAssociatedTokenAddressSync(collectionMint, wallet.publicKey);
    console.log('Destination ATA = ', destination.toBase58());

    const tx = await program.methods
      .createCollection()
      .accountsPartial({
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
      })
      .signers([collectionKeypair])
      .rpc({
        skipPreflight: true,
      });
    console.log('\nCollection NFT minted: TxID - ', tx);
  });

  it('Mint NFT', async () => {
    console.log('\nMint', mint.toBase58());

    const metadata = await getMetadata(mint);
    console.log('Metadata', metadata.toBase58());

    const masterEdition = await getMasterEdition(mint);
    console.log('Master Edition', masterEdition.toBase58());

    const destination = getAssociatedTokenAddressSync(mint, wallet.publicKey);
    console.log('Destination', destination.toBase58());

    const tx = await program.methods
      .mintNft()
      .accountsPartial({
        owner: wallet.publicKey,
        destination,
        metadata,
        masterEdition,
        mint,
        mintAuthority,
        collectionMint,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      })
      .signers([mintKeypair])
      .rpc({
        skipPreflight: true,
      });
    console.log('\nNFT Minted! Your transaction signature', tx);
  });

  it('Verify Collection', async () => {
    const mintMetadata = await getMetadata(mint);
    console.log('\nMint Metadata', mintMetadata.toBase58());

    const collectionMetadata = await getMetadata(collectionMint);
    console.log('Collection Metadata', collectionMetadata.toBase58());

    const collectionMasterEdition = await getMasterEdition(collectionMint);
    console.log('Collection Master Edition', collectionMasterEdition.toBase58());

    const tx = await program.methods
      .verifyCollection()
      .accountsPartial({
        authority: wallet.publicKey,
        metadata: mintMetadata,
        mint,
        mintAuthority,
        collectionMint,
        collectionMetadata,
        collectionMasterEdition,
        systemProgram: SystemProgram.programId,
        sysvarInstruction: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      })
      .rpc({
        skipPreflight: true,
      });
    console.log('\nCollection Verified! Your transaction signature', tx);
  });

  describe("NFT Marketplace", () => {
    let userNftAccount: anchor.web3.PublicKey;
    
    before(async () => {
      userNftAccount = getAssociatedTokenAddressSync(
        mint,
        wallet.publicKey
      );
    });

    it("Can initialize marketplace", async () => {
      const [config] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("marketplace")],
        program.programId
      );

      await program.methods
        .initializeMarketplace(500)
        .accountsStrict({
          authority: wallet.publicKey,
          config,
          treasuryWallet: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

    it("Can list NFT", async () => {
      const [listingAccount] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("listing"), mint.toBuffer()],
        program.programId
      );

      await program.methods
        .listNft(
          new anchor.BN(1_000_000_000),
          new anchor.BN(86400)
        )
        .accountsPartial({
          owner: wallet.publicKey,
          listingAccount,
          nftMint: mint,
          nftToken: userNftAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc({
          skipPreflight: true
        });
    });

    it("Can get NFT price", async () => {
      const [listingAccount] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("listing"), mint.toBuffer()],
        program.programId
      );
      console.log("Listing Account:", listingAccount.toBase58());

      const accountInfo = await provider.connection.getAccountInfo(listingAccount);
      if (!accountInfo) {
        console.log("Account not found!");
        return;
      }
      
      console.log("Account Data Length:", accountInfo.data.length);
      console.log("Account Owner:", accountInfo.owner.toBase58());
      console.log("Raw Data:", Buffer.from(accountInfo.data).toString('hex'));

      const listing = await program.account.listingAccount.fetch(listingAccount);
      console.log("\nNFT Listing Details:");
      console.log("Price:", listing.price.toString(), "lamports");
      console.log("Seller:", listing.seller.toBase58());
      console.log("NFT Mint:", listing.nftMint.toBase58());
      console.log("Listed at:", new Date(listing.createdAt * 1000).toLocaleString());
      console.log("Expires at:", new Date(listing.expiresAt * 1000).toLocaleString());
    });
  });
});
