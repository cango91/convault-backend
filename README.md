# 💬🔐 Convault
**End-to-end encrypted, real-time chat app**

Convault acts as a vault for your private conversations, putting the keys to your messages directly in your hands.

![splash screen](https://i.imgur.com/aAOXSvn.png)

## Getting Started
[Link to live site](https://convault-d603666b3d0b.herokuapp.com/): To use Convault, sign up and get started. You'll need your friends' handles to chat with them. Due to our focus on privacy, the MVP does not include a user search feature; however, it's planned for inclusion in the icebox once profile settings are developed.

**For security, ensure your password has:**
+ A minimum of 8 characters
+ At least one uppercase letter
+ At least one lowercase letter
+ A minimum of one digit
+ At least one special character

Upon signing up, a private/public key pair will be created. You'll be prompted to store your private key securely and present it in subsequent sessions. This step is crucial; the MVP doesn't provide a method to recreate your key pair. If lost, access to previous messages is forfeited.

![Keygen Info](https://i.imgur.com/xhQcagz.png)

## Security Features
+ **End-to-end Encryption:** All data is encrypted client-side, with you holding the decryption key.
+ **Short-lived JWTs (Json Web Tokens):** Tokens for user authentication expire in 30 seconds, minimizing risks from compromised tokens.
+ **Data Breach Mitigation:** Reconstructing even the metadata of conversations is challenging. We use references to the last message between users, with each message referring to its predecessor. All references, including timestamps, are encrypted. However, this design impacts performance.

## Technologies Utilized
+ Mongo
+ Express
+ Node
+ React
+ Web Cryptography API
+ Socket.io

## Roadmap
[Link to Trello](https://trello.com/b/zaAZv1KH/convault)

## Screenshots
![friend request](https://i.imgur.com/hrpHbqmm.png)
![friends list](https://i.imgur.com/onwZbvgm.png)
![a conversation between Duke Nukem and John Locke](https://i.imgur.com/kxlzo9w.png)

## Icebox Features
+ Improved error messages
+ Password reset functionality
+ Username search
+ Profile settings for search visibility
+ Options for user blocking
+ Capability to reject friend requests
+ Notifications and unread message count
+ Perfect Forward Secrecy mode
+ Browser extension for secure private key management

## Repos
+ [Backend](https://github.com/cango91/convault-backend) on GitHub
+ [Frontend](https://github.com/cango91/convault-frontend) on GitHub