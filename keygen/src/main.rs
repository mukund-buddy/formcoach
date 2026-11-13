// formcoach-keygen — FormCoach license key generator (offline, admin-only)
//
// Payload: [0..8) device code (ASCII) | [8..12) nonce | [12..) name (<=16 bytes)
// Key: "FC-" + base32(payload || ed25519_signature) grouped by 6.
//
// Commands:
//   formcoach-keygen keygen --code 7KX2-9QMF --name "Rahul"
//   formcoach-keygen pubkey        (app ke license.js mein paste karne ke liye)

use clap::{Parser, Subcommand};
use data_encoding::BASE32_NOPAD;
use ed25519_dalek::{Signature, Signer, SigningKey};
use rand::RngCore;
use std::fs;
use std::path::Path;

const KEYFILE: &str = "formcoach-ed25519.key";

#[derive(Parser)]
#[command(name = "formcoach-keygen", version)]
struct Cli {
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Issue a license key for one device code
    Keygen {
        /// 8-char device code shown in the app's unlock screen
        #[arg(long)]
        code: String,
        /// Customer name (goes into the key, max 16 bytes)
        #[arg(long, default_value = "")]
        name: String,
    },
    /// Print the public key hex (paste into js/license.js)
    Pubkey,
}

fn load_or_create_keypair() -> anyhow::Result<SigningKey> {
    if Path::new(KEYFILE).exists() {
        let seed = fs::read(KEYFILE)?;
        anyhow::ensure!(seed.len() == 32, "keyfile corrupt (need 32 bytes)");
        let mut bytes = [0u8; 32];
        bytes.copy_from_slice(&seed);
        Ok(SigningKey::from_bytes(&bytes))
    } else {
        let mut seed = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut seed);
        fs::write(KEYFILE, &seed)?;
        eprintln!("NOTE: nayi private key bani ({KEYFILE}). Ise kabhi kisi ke saath share na karo.");
        Ok(SigningKey::from_bytes(&seed))
    }
}

fn format_key(bytes: &[u8]) -> String {
    let b32 = BASE32_NOPAD.encode(bytes);
    let groups: Vec<&str> = b32
        .as_bytes()
        .chunks(6)
        .map(|c| std::str::from_utf8(c).expect("b32 is ascii"))
        .collect();
    format!("FC-{}", groups.join("-"))
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    let signing = load_or_create_keypair()?;

    match cli.cmd {
        Cmd::Pubkey => {
            println!("{}", hex::encode(signing.verifying_key().as_bytes()));
        }
        Cmd::Keygen { code, name } => {
            let code_clean: String = code
                .to_uppercase()
                .replace('-', "");
            anyhow::ensure!(code_clean.len() == 8, "device code exactly 8 chars hona chahiye (dash optional)");
            anyhow::ensure!(code_clean.chars().all(|c| c.is_ascii_alphanumeric()), "code alphanumeric hona chahiye");

            let name_bytes = name.as_bytes();
            anyhow::ensure!(name_bytes.len() <= 16, "name max 16 bytes");

            let mut nonce = [0u8; 4];
            rand::thread_rng().fill_bytes(&mut nonce);

            let mut payload = Vec::with_capacity(12 + name_bytes.len());
            payload.extend_from_slice(code_clean.as_bytes());
            payload.extend_from_slice(&nonce);
            payload.extend_from_slice(name_bytes);

            let sig: Signature = signing.sign(&payload);

            let mut full = payload.clone();
            full.extend_from_slice(&sig.to_bytes());
            println!("{}", format_key(&full));
        }
    }
    Ok(())
}
