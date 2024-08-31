import * as multisig from "@squads-protocol/multisig";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionMessage,
  clusterApiUrl,
} from "@solana/web3.js";
import { getKeypairFromFile } from "@solana-developers/helpers";

const { Permission, Permissions } = multisig.types;

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

async function getKeypairs() {
  const creator = await getKeypairFromFile(
    "/home/ritikbhatt020/squads_quickstart/keys/creator-CATPWdHpMS4TVvYruxVDiDk1hWahQuDoHbTteQQQg1ok.json"
  );
  const secondMember = await getKeypairFromFile(
    "/home/ritikbhatt020/squads_quickstart/keys/second-CATZdDMoSoGWfWzSQvyzv3X4DeRscFmjC8yDep35x8yF.json"
  );
  const createKey = await getKeypairFromFile(
    "/home/ritikbhatt020/squads_quickstart/keys/createkey-CATpXTLWnPm2NyAwNrcBe2ZXQ7CiBqm1qJfeZJds9yvM.json"
  );

  const [multisigPda] = multisig.getMultisigPda({
    createKey: createKey.publicKey,
  });

  return { creator, secondMember, createKey, multisigPda };
}

async function airdropSol(creator: Keypair) {
  const airdropSignature = await connection.requestAirdrop(
    creator.publicKey,
    1 * LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(airdropSignature);
  console.log("Airdrop successful: ", airdropSignature);
}

async function createMultisig(
  creator: Keypair,
  secondMember: Keypair,
  createKey: Keypair,
  multisigPda: any
) {
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

async function createTransactionProposal(creator: Keypair, multisigPda: any) {
  const [vaultPda] = multisig.getVaultPda({
    multisigPda,
    index: 0,
  });
  console.log("multisig pda: ", multisigPda);
  console.log("vault pda: ", vaultPda);

  const instruction = SystemProgram.transfer({
    fromPubkey: vaultPda,
    toPubkey: creator.publicKey,
    lamports: 0.1 * LAMPORTS_PER_SOL,
  });
  console.log("instruction: ", instruction);

  const transferMessage = new TransactionMessage({
    payerKey: vaultPda,
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    instructions: [instruction],
  });

  const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(
    connection,
    multisigPda
  );
  console.log("multi sig info: ", multisigInfo);

  const currentTransactionIndex = Number(multisigInfo.transactionIndex);
  const newTransactionIndex = BigInt(currentTransactionIndex + 1);
  console.log("currentTransactionIndex: ", currentTransactionIndex);
  console.log("newTransactionIndex: ", newTransactionIndex);

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

async function voteOnProposal(
  creator: Keypair,
  secondMember: Keypair,
  multisigPda: any
) {
  // Fetch the transaction index from the multisig account
  const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(
    connection,
    multisigPda
  );
  const transactionIndex = Number(multisigInfo.transactionIndex);

  // Creator votes on the proposal
  const signature1 = await multisig.rpc.proposalApprove({
    connection,
    feePayer: creator,
    multisigPda,
    transactionIndex: BigInt(transactionIndex),
    member: creator,
  });
  await connection.confirmTransaction(signature1);
  console.log("Creator voted: ", signature1);

  // Second member votes on the proposal
  const signature2 = await multisig.rpc.proposalApprove({
    connection,
    feePayer: creator,
    multisigPda,
    transactionIndex: BigInt(transactionIndex),
    member: secondMember,
  });
  await connection.confirmTransaction(signature2);
  console.log("Second member voted: ", signature2);
}

async function performAllTransactions() {
  try {
    const { creator, secondMember, createKey, multisigPda } =
      await getKeypairs();

    // await airdropSol(creator);
    // await createMultisig(creator, secondMember, createKey, multisigPda);
    // await createTransactionProposal(creator, multisigPda);
    await voteOnProposal(creator, secondMember, multisigPda);
  } catch (error) {
    console.error(error);
  }
}

// Execute the combined function
performAllTransactions();
