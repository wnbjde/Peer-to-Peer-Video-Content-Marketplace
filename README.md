# Peer-to-Peer Video Content Marketplace

Welcome to a decentralized video content marketplace built on the Stacks blockchain! This platform empowers creators to sell their videos directly to fans, ensuring fair compensation, transparent pricing, and global access using cryptocurrency payments.

## ✨ Features

- **Direct Sales**: Creators upload and sell videos directly to fans, bypassing intermediaries.
- **Secure Payments**: Fans pay using STX (Stacks' native token) with transparent, on-chain transactions.
- **Access Control**: Purchased videos are unlocked for fans via encrypted access keys.
- **Royalty System**: Creators can set royalty percentages for secondary sales.
- **Content Verification**: Prevent duplicate or unauthorized uploads using content hashes.
- **Dispute Resolution**: A decentralized voting system for handling disputes over content.
- **Creator Profiles**: Store and display creator metadata for discoverability.
- **Fan Rewards**: Fans earn loyalty points for purchases, redeemable for discounts.

## 🛠 How It Works

### For Creators
1. **Register as a Creator**: Use the `CreatorRegistry` contract to create a profile with metadata (e.g., name, bio).
2. **Upload Video Metadata**: Call the `VideoRegistry` contract to register a video with its hash, title, description, and price.
3. **Set Royalties**: Use the `RoyaltyManagement` contract to define royalty percentages for secondary sales.
4. **Verify Content**: The `ContentVerification` contract ensures the video hash is unique to prevent duplicates.
5. **Sell Videos**: List videos in the `Marketplace` contract, where fans can purchase them.
6. **Manage Disputes**: If disputes arise, the `DisputeResolution` contract allows community voting to resolve issues.

### For Fans
1. **Browse Videos**: Query the `Marketplace` contract to view available videos and creator profiles.
2. **Purchase Videos**: Use the `Payment` contract to buy videos with STX, receiving an encrypted access key via the `AccessControl` contract.
3. **Earn Rewards**: The `FanRewards` contract tracks purchases and awards loyalty points.
4. **Resell Videos**: Use the `Marketplace` contract to resell purchased videos, with royalties paid to the creator.
5. **Verify Purchases**: Check ownership and access rights using the `AccessControl` contract.
