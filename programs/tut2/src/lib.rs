use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};
use mpl_token_metadata::instruction::{create_master_edition_v3, create_metadata_accounts_v3};
use mpl_token_metadata::state::{Creator, DataV2};

declare_id!("GuZ43msQ2Ki8UpgokcTcJoduh7Gud4EDHEteaYYHdjbb");

pub fn get_string_from_buffer(buffer: &[u8]) -> String {
    let mut arr = Vec::new();

    for i in buffer {
        if *i == 0 {
            break;
        }
        arr.push(*i);
    }

    String::from_utf8(arr).unwrap()
}

#[program]
pub mod tut2 {
    use anchor_lang::solana_program::program::invoke;

    use super::*;

    pub fn create_nft(
        context: Context<ACreateNft>,
        name: [u8; 32],
        symbol: [u8; 32],
        uri: [u8; 128],
    ) -> Result<()> {
        let user = context.accounts.user.to_account_info();
        let user_ata = context.accounts.user_ata.to_account_info();
        let master_edition_account = context.accounts.master_edition_account.to_account_info();
        let metadata_account = context.accounts.metadata_account.to_account_info();
        let system_program = context.accounts.system_program.to_account_info();
        let token_program = context.accounts.token_program.to_account_info();
        let mpl_program = context.accounts.mpl_program.to_account_info();
        let mint = context.accounts.mint.to_account_info();

        //? Minting the token.
        let cpi_account = token::MintTo {
            authority: user.to_account_info(),
            mint: mint.to_account_info(),
            to: user_ata.to_account_info(),
        };

        token::mint_to(
            CpiContext::new(token_program.to_account_info(), cpi_account),
            1,
        )?;

        //? Init and set metadata:
        let name = get_string_from_buffer(&name);
        let symbol = get_string_from_buffer(&symbol);
        let uri = get_string_from_buffer(&uri);
        let creators = Some(vec![Creator {
            address: user.key(),
            share: 10,
            verified: true,
        }]);

        let create_metadata_account_ix = create_metadata_accounts_v3(
            mpl_program.key(),
            metadata_account.key(),
            mint.key(),
            user.key(),
            user.key(),
            user.key(),
            name,
            symbol,
            uri,
            creators,
            4,
            true,
            true,
            None,
            None,
            None,
        );
        invoke(
            &create_metadata_account_ix, 
            &[
                user.to_account_info(),
                metadata_account.to_account_info(),
                mint.to_account_info(),
                mpl_program.to_account_info(),
                system_program.to_account_info(),
            ]
        )?;

        let create_master_edition_ix = create_master_edition_v3(
            mpl_program.key(),
            master_edition_account.key(),
            mint.key(),
            user.key(),
            user.key(),
            metadata_account.key(),
            user.key(),
            None,
        );
        invoke(
            &create_master_edition_ix, 
            &[
                user.to_account_info(),
                metadata_account.to_account_info(),
                master_edition_account.to_account_info(),
                mint.to_account_info(),
                mpl_program.to_account_info(),
                system_program.to_account_info(),
            ]
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct ACreateNft<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        token::authority = user,
        token::mint = mint,
    )]
    pub user_ata: Account<'info, TokenAccount>,

    ///CHECK:
    #[account(
        mut,
        mint::decimals = 0,
        constraint = mint.supply == 0,
    )]
    pub mint: Account<'info, Mint>,

    ///CHECK:
    #[account(
        mut,
        seeds = [
            b"metadata",
            mpl_token_metadata::id().as_ref(),
            mint.key().as_ref(),
        ],
        bump,
        seeds::program = mpl_token_metadata::id()  
    )]
    pub metadata_account: AccountInfo<'info>,

    ///CHECK:
    #[account(
        mut,
        seeds = [
            b"metadata",
            mpl_token_metadata::id().as_ref(),
            mint.key().as_ref(),
            b"edition",
        ],
        bump,
        seeds::program = mpl_token_metadata::id()
    )]
    pub master_edition_account: AccountInfo<'info>,

    ///CHECK:
    #[account(address = mpl_token_metadata::id())]
    mpl_program: AccountInfo<'info>,

    token_program: Program<'info, Token>,
    system_program: Program<'info, System>,
}
