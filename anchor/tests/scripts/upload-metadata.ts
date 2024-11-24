import * as fs from 'fs';
import pinataSDK from '@pinata/sdk';
import path from 'path';
import { OffChainMetadata } from '../types/utils';

const pinata = new pinataSDK(
    '49d03dd184ece15831f8',
    '1f57f4848817f0a46c3c75bcd41eddef3d1f461c3ee8f935b7a643cf64d6bcc8'
);

async function uploadImage(imagePath: string, name: string) {
    try {
        const readableStreamForFile = fs.createReadStream(imagePath);
        const options = {
            pinataMetadata: {
                name: name,
            },
        };
        
        const result = await pinata.pinFileToIPFS(readableStreamForFile, options);
        return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
    } catch (error) {
        console.error("Error uploading image:", error);
        throw error;
    }
}

async function uploadMetadata() {
    const collectionImageUrl = await uploadImage(
        path.join(__dirname, '../assets/collection.png'),
        'collection-image'
    );
    console.log('Collection image uploaded:', collectionImageUrl);

    const nftImageUrl = await uploadImage(
        path.join(__dirname, '../assets/nft.png'),
        'nft-image'
    );
    console.log('NFT image uploaded:', nftImageUrl);

    const collectionMetadata: OffChainMetadata = {
        name: "Test Collection",
        symbol: "TCOL",
        description: "Test Collection Description",
        image: collectionImageUrl,
        external_url: null,
        attributes: [],
        properties: {
            files: [
                {
                    uri: collectionImageUrl,
                    type: "image/png"
                }
            ],
            category: "image"
        }
    };

    const nftMetadata: OffChainMetadata = {
        name: "Test NFT",
        symbol: "TNFT",
        description: "Test NFT Description",
        image: nftImageUrl,
        external_url: null,
        attributes: [
            {
                trait_type: "Background",
                value: "Blue"
            }
        ],
        properties: {
            files: [
                {
                    uri: nftImageUrl,
                    type: "image/png"
                }
            ],
            category: "image"
        }
    };

    const collectionResult = await pinata.pinJSONToIPFS(collectionMetadata);
    const nftResult = await pinata.pinJSONToIPFS(nftMetadata);

    console.log('Collection metadata URI:', `https://gateway.pinata.cloud/ipfs/${collectionResult.IpfsHash}`);
    console.log('NFT metadata URI:', `https://gateway.pinata.cloud/ipfs/${nftResult.IpfsHash}`);
}

uploadMetadata().catch(console.error);