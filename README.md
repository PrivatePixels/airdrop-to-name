# Airdrop Duo

AirdropToName is an Aragon app to facilitate the efficient distribution of a token to a name. An interface ([INames.sol](contracts/INames.sol)) provides username<->address lookup. The intention is to allow airdropping to, for instance, web2.0 users, who can claim once they have registered without knowing their chosen address in advance.

### How it works

1. Airdrop data is uploaded as a csv or pull from an online source. Fields should be ['username', 'points']
1. An [INames.sol](contracts/INames.sol) implementing contract handles username->address lookup.
1. A merkle tree is generated and uploaded to ipfs
1. A transaction is submitted, protected by `START_ROLE`, to the AirdropToName contract. The tx includes a merkle root and ipfs hash of the complete airdrop data, including merkle proofs (the app front end generates this automatically from the source csv).
1. Once accepted via `START_ROLE` the tokens from that airdrop are available to `award`. The `award` tx can be submitted by either the recipient or a third party on the recipient's behalf.
1. `awardFromMany` allows for combining the amounts from multiple airdrops
1. `awardToMany` allows for bulk awarding to recipients from a single airdrop
