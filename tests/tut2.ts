import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Tut2 } from "../target/types/tut2";
import { readFileSync } from 'fs';
import { utf8 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction

} from '@solana/spl-token'

const log = console.log;
const {
  PublicKey
} = anchor.web3;

describe("tut2", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();
  const mplId = new anchor.web3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
  let fileTxt = readFileSync("./_users/mint.json", { encoding: 'utf-8' });
  let kepairJson = JSON.parse(fileTxt);
  let buffers_8 = Uint8Array.from(kepairJson);
  let token_keypair = anchor.web3.Keypair.fromSecretKey(buffers_8);
  const program = anchor.workspace.Tut2 as Program<Tut2>;
  const txis: anchor.web3.TransactionInstruction[] = []
  const tokenId = token_keypair.publicKey;


  async function createToken() {
    const web3 = anchor.web3;

    const rent = await provider.connection.getMinimumBalanceForRentExemption(MINT_SIZE);

    const ix1 = web3.SystemProgram.createAccount({
      fromPubkey: provider.publicKey,
      lamports: rent,
      newAccountPubkey: token_keypair.publicKey,
      programId: TOKEN_PROGRAM_ID, //? here we are creating the token that's why as the program id to token_program_id smart contract which is only one who can change the date inside the token_account. 
      space: MINT_SIZE,
    })
    txis.push(ix1)

    //? setting the token initial values.
    const ix2 = createInitializeMintInstruction(
      token_keypair.publicKey,
      0, //? make sure the decimals has to be '0'
      provider.publicKey,
      provider.publicKey
    );
    txis.push(ix2)

    // this._sendTransaction([token_keypair]);
    // console.log("Token is created : ", token_keypair.publicKey.toBase58())
  }

  async function _getOrCreateTokenAccount(owner: anchor.web3.PublicKey, token: anchor.web3.PublicKey, isOffCurve = false) {
    const web3 = anchor.web3;

    const ata = getAssociatedTokenAddressSync(token, owner, isOffCurve);
    const info = await provider.connection.getAccountInfo(ata);

    if (info == null) {
      log("added token account init")
      const ix = createAssociatedTokenAccountInstruction(provider.publicKey, ata, owner, token);
      txis.push(ix);
    }
    return ata;
  }

  function parseStringToBuffer(text: string, len: number) {
    let _buffer = utf8.encode(text);
    let new_buffer = [];

    if (text.length >= len) throw 'string has to be small'

    //? filling the string value to new_buffer;
    for (let i of _buffer) {
      new_buffer.push(i);
    }

    //? filling '0' for left over space.
    for (let i = new_buffer.length; i < len; i++) {
      new_buffer.push(0)
    }

    // return Uint8Array.from(new_buffer);
    return new_buffer
  }

  it("Create nft", async () => {
    const metadata_account = PublicKey.findProgramAddressSync(
      [
        utf8.encode("metadata"),
        mplId.toBuffer(),
        tokenId.toBuffer(),
      ],
      mplId
    )[0]
    const master_edition_account = PublicKey.findProgramAddressSync(
      [
        utf8.encode("metadata"),
        mplId.toBuffer(),
        tokenId.toBuffer(),
        utf8.encode("edition"),
      ],
      mplId
    )[0]

    await createToken();
    const userAta = await _getOrCreateTokenAccount(provider.publicKey, tokenId);

    const name = parseStringToBuffer("Vi", 32);
    const symbol = parseStringToBuffer("VI", 32);
    const uri = parseStringToBuffer("https://VI", 128);

    let ix = await program.methods.createNft(name, symbol, uri).accounts({
      masterEditionAccount: master_edition_account,
      metadataAccount: metadata_account,
      mint: tokenId,
      mplProgram: mplId,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      user: provider.publicKey,
      userAta: userAta,
    }).instruction()

    txis.push(ix);

    const tx = new anchor.web3.Transaction();
    tx.add(...txis);

    let res = await provider.sendAndConfirm(tx, [token_keypair])
    log('res: ', res);

  })


});

