import * as multisig from "@squads-protocol/multisig";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionMessage,
  clusterApiUrl,
} from "@solana/web3.js";

const { Permission, Permissions } = multisig.types;

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

const creator = Keypair.generate();
const secondMember = Keypair.generate();
const createKey = Keypair.generate();
const [multisigPda] = multisig.getMultisigPda({
  createKey: createKey.publicKey,
});

async function airdropSol() {
  // Airdrop SOL to creator
  const airdropSignature = await connection.requestAirdrop(
    creator.publicKey,
    1 * LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(airdropSignature);
  console.log("Airdrop successful: ", airdropSignature);
}

async function createMultisig() {
  // Create a new multisig
  const programConfigPda = multisig.getProgramConfigPda({})[0];
  const programConfig =
    await multisig.accounts.ProgramConfig.fromAccountAddress(
      connection,
      programConfigPda
    );
  const configTreasury = programConfig.treasury;

  const signature = await multisig.rpc.multisigCreateV2({
    connection,
    createKey,
    creator,
    multisigPda,
    configAuthority: null,
    timeLock: 0,
    members: [
      {
        key: creator.publicKey,
        permissions: Permissions.all(),
      },
      {
        key: secondMember.publicKey,
        permissions: Permissions.fromPermissions([Permission.Vote]),
      },
    ],
    threshold: 2,
    rentCollector: null,
    treasury: configTreasury,
    sendOptions: { skipPreflight: true },
  });
  await connection.confirmTransaction(signature);
  console.log("Multisig created: ", signature);
}

async function createTransactionProposal() {
  // Create a transaction proposal
  const [vaultPda] = multisig.getVaultPda({
    multisigPda,
    index: 0,
  });

  const instruction = SystemProgram.transfer({
    fromPubkey: vaultPda,
    toPubkey: creator.publicKey,
    lamports: 0.1 * LAMPORTS_PER_SOL,
  });

  const transferMessage = new TransactionMessage({
    payerKey: vaultPda,
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    instructions: [instruction],
  });

  const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(
    connection,
    multisigPda
  );

  const currentTransactionIndex = Number(multisigInfo.transactionIndex);
  const newTransactionIndex = BigInt(currentTransactionIndex + 1);

  const signature1 = await multisig.rpc.vaultTransactionCreate({
    connection,
    feePayer: creator,
    multisigPda,
    transactionIndex: newTransactionIndex,
    creator: creator.publicKey,
    vaultIndex: 0,
    ephemeralSigners: 0,
    transactionMessage: transferMessage,
    memo: "Transfer 0.1 SOL to creator",
  });

  await connection.confirmTransaction(signature1);
  console.log("Transaction created: ", signature1);

  const signature2 = await multisig.rpc.proposalCreate({
    connection,
    feePayer: creator,
    multisigPda,
    transactionIndex: newTransactionIndex,
    creator,
  });

  await connection.confirmTransaction(signature2);
  console.log("Transaction proposal created: ", signature2);
}

async function performAllTransactions() {
  try {
    await airdropSol();
    // await createMultisig();
    // await createTransactionProposal();
  } catch (error) {
    console.error(error);
  }
}

// Execute the combined function
performAllTransactions();
