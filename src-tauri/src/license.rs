//! Offline license system for Aervox.
//!
//! How it works, in one paragraph:
//! a license "key" is a short text token made of three parts —
//! `AVX1.<payload>.<signature>`. The payload is plain JSON (tier, machine,
//! dates) and is NOT secret; the signature is an Ed25519 signature made with
//! the vendor's PRIVATE key. This file only contains the matching PUBLIC key,
//! which is safe to publish: it can verify signatures but cannot create them.
//! So the source can be public and no one can forge a key.
//!
//! Everything is local. A determined attacker with a debugger can always patch
//! a local check; the goal here is to stop copying keys between PCs, editing
//! the stored license, restarting trials and winding the clock back — not to
//! beat a reverse engineer.

use base64::Engine;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

/// Ed25519 public key that licenses are verified against, as 64 hex characters.
/// Generate a key pair with `node tools/license-keygen.mjs --init`.
const PUBLIC_KEY_HEX: &str = "5c381952b4177378a29fe54344e58e146a526d03c7c5613b69180089f7ff97e1";

const TOKEN_PREFIX: &str = "AVX1";
const TOKEN_VERSION: u8 = 1;
const DAY_SECS: i64 = 86_400;
/// How far the clock may jump backwards before we call it tampering.
const CLOCK_GRACE_SECS: i64 = 3_600;
/// Don't touch the license file on every single status call.
const LAST_SEEN_WRITE_SECS: i64 = 300;

// ─────────────────────────────── data types ───────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Claims {
    /// Token format version.
    v: u8,
    /// Unique key id, e.g. "AVX-20261109-1A2B".
    id: String,
    /// "dev" | "trial" | "sub3" | "sub6" | "sub12"
    tier: String,
    /// Length of the license in days from first activation. 0 = permanent.
    days: u32,
    /// Machine code this key was issued for (16 hex characters).
    machine: String,
    /// Issued-at, unix seconds (UTC).
    iat: i64,
    #[serde(default)]
    note: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct LicenseStatus {
    /// "none" | "valid" | "expired" | "invalid" | "tampered"
    pub state: String,
    pub tier: Option<String>,
    pub key_id: Option<String>,
    /// Unix seconds.
    pub activated_at: Option<i64>,
    /// Unix seconds. None means the license never expires.
    pub expires_at: Option<i64>,
    pub days_remaining: Option<i64>,
    /// Grouped machine code, e.g. "1A2B-3C4D-5E6F-7081".
    pub machine_code: String,
    pub reason: Option<String>,
}

impl LicenseStatus {
    fn blank(machine_code: &str) -> Self {
        Self {
            state: "none".to_string(),
            tier: None,
            key_id: None,
            activated_at: None,
            expires_at: None,
            days_remaining: None,
            machine_code: machine_code.to_string(),
            reason: None,
        }
    }

    fn fail(machine_code: &str, state: &str, reason: impl Into<String>) -> Self {
        let mut status = Self::blank(machine_code);
        status.state = state.to_string();
        status.reason = Some(reason.into());
        status
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredLicense {
    token: String,
    activated_at: i64,
    last_seen: i64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct DeviceState {
    /// key id -> unix time this key was first activated on this machine
    #[serde(default)]
    activations: BTreeMap<String, i64>,
    /// machine code -> key id of the trial key already used on this machine
    #[serde(default)]
    trials: BTreeMap<String, String>,
}

// ────────────────────────────── small helpers ─────────────────────────────

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Stable, non-reversible short code for this PC. This is what the customer
/// sends you; the raw hardware id stays on their machine.
pub fn machine_code() -> Result<String, String> {
    let uid = machine_uid::get()
        .map_err(|e| format!("Could not read a hardware identifier: {e}"))?;
    let digest = Sha256::digest(uid.as_bytes());
    Ok(hex::encode(&digest[..8]).to_uppercase())
}

fn display_code(code: &str) -> String {
    code.as_bytes()
        .chunks(4)
        .map(|chunk| String::from_utf8_lossy(chunk).into_owned())
        .collect::<Vec<_>>()
        .join("-")
}

fn normalise_token(raw: &str) -> String {
    raw.chars().filter(|c| !c.is_whitespace()).collect()
}

// ─────────────────────────────── file paths ───────────────────────────────

fn settings_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not find the app data folder: {e}"))?
        .join("settings");
    fs::create_dir_all(&dir).map_err(|e| format!("Could not create the settings folder: {e}"))?;
    Ok(dir)
}

fn license_file(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(settings_dir(app)?.join("license.json"))
}

/// Device state deliberately lives OUTSIDE the app data folder so that
/// reinstalling / wiping app data does not hand out a fresh trial.
fn device_state_paths(app: &AppHandle) -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if let Ok(program_data) = std::env::var("ProgramData") {
        let trimmed = program_data.trim();
        if !trimmed.is_empty() {
            paths.push(PathBuf::from(trimmed).join("Aervox").join("device.json"));
        }
    }

    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let trimmed = local_app_data.trim();
        if !trimmed.is_empty() {
            paths.push(PathBuf::from(trimmed).join("Aervox").join("device.json"));
        }
    }

    if paths.is_empty() {
        if let Ok(dir) = app.path().app_data_dir() {
            paths.push(dir.join("device.json"));
        }
    }

    paths
}

// ────────────────────────────── device state ──────────────────────────────

fn load_device_state(app: &AppHandle) -> DeviceState {
    let mut merged = DeviceState::default();

    for path in device_state_paths(app) {
        let Ok(text) = fs::read_to_string(&path) else {
            continue;
        };
        let Ok(state) = serde_json::from_str::<DeviceState>(&text) else {
            continue;
        };

        for (key_id, activated_at) in state.activations {
            // Keep the LATEST activation time across mirrors. That is the safe
            // direction: a deleted or back-dated copy cannot shorten a license.
            let slot = merged.activations.entry(key_id).or_insert(activated_at);
            if activated_at > *slot {
                *slot = activated_at;
            }
        }

        for (machine, key_id) in state.trials {
            merged.trials.entry(machine).or_insert(key_id);
        }
    }

    merged
}

fn save_device_state(app: &AppHandle, state: &DeviceState) -> Result<(), String> {
    let text = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    let mut written = 0usize;

    for path in device_state_paths(app) {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if fs::write(&path, &text).is_ok() {
            written += 1;
        }
    }

    if written == 0 {
        return Err("Could not save the activation record for this PC.".to_string());
    }

    Ok(())
}

// ────────────────────────────── license file ──────────────────────────────

fn read_stored(app: &AppHandle) -> Option<StoredLicense> {
    let path = license_file(app).ok()?;
    let text = fs::read_to_string(path).ok()?;
    serde_json::from_str(&text).ok()
}

fn write_stored(app: &AppHandle, stored: &StoredLicense) -> Result<(), String> {
    let path = license_file(app)?;
    let text = serde_json::to_string_pretty(stored).map_err(|e| e.to_string())?;
    fs::write(&path, text).map_err(|e| format!("Could not save the license: {e}"))
}

// ──────────────────────────────── verify ──────────────────────────────────

fn verify_token(raw: &str) -> Result<Claims, String> {
    if PUBLIC_KEY_HEX.len() != 64 || !PUBLIC_KEY_HEX.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("This build of Aervox has no license public key configured.".to_string());
    }

    let token = normalise_token(raw);
    let mut parts = token.split('.');

    let prefix = parts.next().unwrap_or("");
    if prefix != TOKEN_PREFIX {
        return Err("That does not look like an Aervox license key.".to_string());
    }

    let payload_b64 = parts
        .next()
        .ok_or_else(|| "The license key is incomplete.".to_string())?;
    let signature_b64 = parts
        .next()
        .ok_or_else(|| "The license key is incomplete.".to_string())?;
    if parts.next().is_some() {
        return Err("The license key has extra characters on the end.".to_string());
    }

    let payload = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(payload_b64)
        .map_err(|_| "The license key is damaged (payload).".to_string())?;

    let signature_bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(signature_b64)
        .map_err(|_| "The license key is damaged (signature).".to_string())?;

    let signature = Signature::from_slice(&signature_bytes)
        .map_err(|_| "The license key signature is malformed.".to_string())?;

    let public_bytes =
        hex::decode(PUBLIC_KEY_HEX).map_err(|_| "Built-in license key is invalid.".to_string())?;
    let public_array: [u8; 32] = public_bytes
        .try_into()
        .map_err(|_| "Built-in license key has the wrong length.".to_string())?;
    let verifying_key = VerifyingKey::from_bytes(&public_array)
        .map_err(|_| "Built-in license key is invalid.".to_string())?;

    verifying_key
        .verify(&payload, &signature)
        .map_err(|_| "This key was not issued by Aervox.".to_string())?;

    let claims: Claims = serde_json::from_slice(&payload)
        .map_err(|_| "The license key contents are unreadable.".to_string())?;

    if claims.v != TOKEN_VERSION {
        return Err("This key is for a newer version of Aervox. Update the app.".to_string());
    }

    Ok(claims)
}

// ─────────────────────────────── evaluate ─────────────────────────────────

fn evaluate(app: &AppHandle) -> Result<LicenseStatus, String> {
    let machine = machine_code()?;
    let shown = display_code(&machine);

    let stored = match read_stored(app) {
        Some(stored) => stored,
        None => return Ok(LicenseStatus::blank(&shown)),
    };

    let now = now_secs();

    let claims = match verify_token(&stored.token) {
        Ok(claims) => claims,
        Err(reason) => return Ok(LicenseStatus::fail(&shown, "invalid", reason)),
    };

    if claims.machine != machine {
        return Ok(LicenseStatus::fail(
            &shown,
            "invalid",
            "This key was issued for a different PC. Send this PC's Machine ID to get the right one.",
        ));
    }

    let mut device = load_device_state(app);

    let recorded = device
        .activations
        .get(&claims.id)
        .copied()
        .unwrap_or(stored.activated_at);

    // Clock moved backwards? Either relative to the last known time, or before
    // the moment this key was first activated.
    if now + CLOCK_GRACE_SECS < recorded || now + CLOCK_GRACE_SECS < stored.last_seen {
        return Ok(LicenseStatus::fail(
            &shown,
            "tampered",
            "The system clock has moved backwards. Set the correct date and time, then restart Aervox.",
        ));
    }

    let activated_at = recorded.min(now);

    let known = device.activations.get(&claims.id).copied();
    if known != Some(activated_at) {
        device.activations.insert(claims.id.clone(), activated_at);
        let _ = save_device_state(app, &device);
    }

    let expires_at = if claims.days == 0 {
        None
    } else {
        Some(activated_at + claims.days as i64 * DAY_SECS)
    };

    // Never let a backwards clock extend a license: compare against the latest
    // time we have ever seen this install at.
    let effective_now = now.max(stored.last_seen);

    if let Some(expires_at) = expires_at {
        if effective_now >= expires_at {
            let mut status = LicenseStatus::fail(&shown, "expired", "This license has expired.");
            status.tier = Some(claims.tier.clone());
            status.key_id = Some(claims.id.clone());
            status.activated_at = Some(activated_at);
            status.expires_at = Some(expires_at);
            status.days_remaining = Some(0);
            return Ok(status);
        }
    }

    if now > stored.last_seen + LAST_SEEN_WRITE_SECS {
        let refreshed = StoredLicense {
            token: stored.token.clone(),
            activated_at: stored.activated_at,
            last_seen: now,
        };
        let _ = write_stored(app, &refreshed);
    }

    let days_remaining = expires_at.map(|expires| {
        let remaining = (expires - effective_now + DAY_SECS - 1) / DAY_SECS;
        remaining.max(0)
    });

    Ok(LicenseStatus {
        state: "valid".to_string(),
        tier: Some(claims.tier),
        key_id: Some(claims.id),
        activated_at: Some(activated_at),
        expires_at,
        days_remaining,
        machine_code: shown,
        reason: None,
    })
}

// ─────────────────────────────── commands ─────────────────────────────────

#[tauri::command]
pub fn license_machine_code() -> Result<String, String> {
    Ok(display_code(&machine_code()?))
}

#[tauri::command]
pub fn license_status(app: AppHandle) -> Result<LicenseStatus, String> {
    evaluate(&app)
}

#[tauri::command]
pub fn license_activate(app: AppHandle, token: String) -> Result<LicenseStatus, String> {
    let clean = normalise_token(&token);
    if clean.is_empty() {
        return Err("Paste your license key first.".to_string());
    }

    let machine = machine_code()?;
    let claims = verify_token(&clean)?;

    if claims.machine != machine {
        return Err(
            "This key was issued for a different PC. Send this PC's Machine ID to get the right one."
                .to_string(),
        );
    }

    let now = now_secs();
    if claims.iat > now + CLOCK_GRACE_SECS {
        return Err(
            "The system clock is set in the past. Correct the date and time, then try again."
                .to_string(),
        );
    }

    let mut device = load_device_state(&app);

    if claims.tier == "trial" {
        if let Some(existing) = device.trials.get(&claims.machine) {
            if existing != &claims.id {
                return Err("The free trial has already been used on this PC.".to_string());
            }
        } else {
            device.trials.insert(claims.machine.clone(), claims.id.clone());
            save_device_state(&app, &device)?;
        }
    }

    let activated_at = match device.activations.get(&claims.id).copied() {
        Some(existing) => existing,
        None => {
            device.activations.insert(claims.id.clone(), now);
            save_device_state(&app, &device)?;
            now
        }
    };

    write_stored(
        &app,
        &StoredLicense {
            token: clean,
            activated_at,
            last_seen: now,
        },
    )?;

    evaluate(&app)
}

/// Removes the local license. The device activation record is kept on purpose,
/// so re-entering the same key does not reset its start date.
#[tauri::command]
pub fn license_clear(app: AppHandle) -> Result<(), String> {
    let path = license_file(&app)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Could not remove the license: {e}"))?;
    }
    Ok(())
}
