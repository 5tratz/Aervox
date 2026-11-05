use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

#[derive(serde::Serialize)]
struct MachineInfo { machine_id: String, os: String, arch: String }

#[tauri::command]
fn get_machine_info() -> Result<MachineInfo, String> {
    let machine_id = machine_uid::get().map_err(|e| format!("machine_uid failed: {}", e))?;
    Ok(MachineInfo {
        machine_id,
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
    })
}

#[derive(serde::Serialize)]
struct VerifyResult { valid: bool, payload: Option<serde_json::Value>, reason: Option<String> }

#[tauri::command]
fn verify_license(license_b64: String, public_key_hex: String) -> VerifyResult {
    let decoded = match base64::Engine::decode(&base64::engine::general_purpose::STANDARD, license_b64.as_bytes()) {
        Ok(v) => v,
        Err(e) => return VerifyResult { valid: false, payload: None, reason: Some(format!("bad base64: {}", e)) },
    };
    let text = match String::from_utf8(decoded) {
        Ok(s) => s, Err(_) => return VerifyResult { valid: false, payload: None, reason: Some("invalid utf8".into()) },
    };
    let (payload_json, sig_hex) = match text.rsplit_once('.') {
        Some((p, s)) => (p, s), None => return VerifyResult { valid: false, payload: None, reason: Some("malformed license".into()) },
    };
    let pk_bytes = match hex::decode(&public_key_hex) {
        Ok(v) => v, Err(e) => return VerifyResult { valid: false, payload: None, reason: Some(format!("bad pubkey hex: {}", e)) },
    };
    let pk_arr: [u8; 32] = if pk_bytes.len() == 32 {
        let mut arr = [0u8; 32]; arr.copy_from_slice(&pk_bytes); arr
    } else { return VerifyResult { valid: false, payload: None, reason: Some("pubkey wrong length".into()) }; };
    let verifying_key = match VerifyingKey::from_bytes(&pk_arr) {
        Ok(k) => k, Err(e) => return VerifyResult { valid: false, payload: None, reason: Some(format!("pubkey invalid: {}", e)) },
    };
    let sig_bytes = match hex::decode(sig_hex) {
        Ok(v) => v, Err(e) => return VerifyResult { valid: false, payload: None, reason: Some(format!("bad sig hex: {}", e)) },
    };
    let sig = match Signature::from_slice(&sig_bytes) {
        Ok(s) => s, Err(e) => return VerifyResult { valid: false, payload: None, reason: Some(format!("sig invalid: {}", e)) },
    };
    if verifying_key.verify(payload_json.as_bytes(), &sig).is_err() {
        return VerifyResult { valid: false, payload: None, reason: Some("signature mismatch".into()) };
    }
    let payload: serde_json::Value = match serde_json::from_str(payload_json) {
        Ok(p) => p, Err(e) => return VerifyResult { valid: false, payload: None, reason: Some(format!("payload json invalid: {}", e)) },
    };
    VerifyResult { valid: true, payload: Some(payload), reason: None }
}

#[tauri::command]
fn read_license_file(path: String) -> Result<String, String> {
    let p = PathBuf::from(&path);
    fs::read_to_string(&p).map_err(|e| format!("read failed: {}", e))
}

#[tauri::command]
fn write_license_file(path: String, content: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if let Some(parent) = p.parent() { let _ = fs::create_dir_all(parent); }
    fs::write(&p, content).map_err(|e| format!("write failed: {}", e))
}

#[tauri::command]
fn hash_password(password: String) -> Result<String, String> {
    use argon2::{password_hash::{rand_core::OsRng, PasswordHasher, SaltString}, Argon2};
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default().hash_password(password.as_bytes(), &salt).map(|h| h.to_string()).map_err(|e| e.to_string())
}

#[tauri::command]
fn verify_password(password: String, hash: String) -> Result<bool, String> {
    use argon2::{password_hash::{PasswordHash, PasswordVerifier}, Argon2};
    let parsed = PasswordHash::new(&hash).map_err(|e| e.to_string())?;
    Ok(Argon2::default().verify_password(password.as_bytes(), &parsed).is_ok())
}

#[allow(dead_code)]
fn get_packages_path(app_handle: &AppHandle) -> Option<PathBuf> {
    let app_dir = app_handle.path().app_data_dir().ok()?;
    let settings_dir = app_dir.join("settings");
    let json_file = settings_dir.join("msfs_path.json");
    if json_file.exists() {
        if let Ok(content) = fs::read_to_string(&json_file) {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(path_str) = parsed["path"].as_str() {
                    let path = PathBuf::from(path_str.trim());
                    if path.exists() { return Some(path); }
                }
            }
        }
    }
    let txt_file = settings_dir.join("msfs_path.txt");
    if txt_file.exists() {
        if let Ok(path_str) = fs::read_to_string(&txt_file) {
            let path = PathBuf::from(path_str.trim());
            if path.exists() { return Some(path); }
        }
    }
    None
}

#[tauri::command]
fn save_packages_path(app_handle: AppHandle, path: String) -> Result<(), String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let settings_dir = app_dir.join("settings");
    fs::create_dir_all(&settings_dir).map_err(|e| e.to_string())?;
    fs::write(settings_dir.join("msfs_path.txt"), &path).map_err(|e| e.to_string())?;
    let json = serde_json::json!({ "path": path });
    fs::write(settings_dir.join("msfs_path.json"), serde_json::to_string_pretty(&json).unwrap_or_default()).map_err(|e| e.to_string())?;
    Ok(())
}

fn get_current_aircraft_internal() -> Option<(String, String)> {
    let appdata = std::env::var("APPDATA").ok()?;

    let flt_path = PathBuf::from(&appdata)
        .join("Microsoft Flight Simulator")
        .join("MISSIONS")
        .join("Custom")
        .join("CustomFlight")
        .join("CustomFlight.FLT");

    if flt_path.exists() {
        if let Ok(content) = fs::read_to_string(&flt_path) {
            for line in content.lines() {
                let line = line.trim();
                if line.starts_with("Sim=") {
                    let sim_name = line[4..].trim();
                    if !sim_name.is_empty() {
                        if let Some(icao) = sim_name_to_icao(sim_name) {
                            return Some((icao, sim_name.to_string()));
                        }
                    }
                }
            }
        }
    }

    let simobjects = PathBuf::from(&appdata)
        .join("Microsoft Flight Simulator")
        .join("SimObjects")
        .join("Airplanes");

    if simobjects.exists() {
        let mut best: Option<(PathBuf, std::time::SystemTime, String)> = None;
        if let Ok(entries) = fs::read_dir(&simobjects) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() { continue; }
                let state_cfg = path.join("state.CFG");
                if !state_cfg.exists() { continue; }
                if let Ok(meta) = fs::metadata(&state_cfg) {
                    if let Ok(mtime) = meta.modified() {
                        let aircraft_folder_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
                        let should_replace = match &best {
                            None => true,
                            Some((_, prev_mtime, _)) => mtime > *prev_mtime,
                        };
                        if should_replace {
                            best = Some((state_cfg, mtime, aircraft_folder_name));
                        }
                    }
                }
            }
        }
        if let Some((_, _, folder_name)) = best {
            if let Some(icao) = sim_name_to_icao(&folder_name) {
                return Some((icao, folder_name));
            }
        }
    }

    None
}

fn get_callsign_from_flt() -> Option<String> {
    let appdata = std::env::var("APPDATA").ok()?;
    let flt_path = PathBuf::from(&appdata)
        .join("Microsoft Flight Simulator")
        .join("MISSIONS")
        .join("Custom")
        .join("CustomFlight")
        .join("CustomFlight.FLT");

    let content = fs::read_to_string(&flt_path).ok()?;
    let mut in_atc_section = false;

    for line in content.lines() {
        let line = line.trim();

        for prefix in &[
            "AirlineCallSign=",
            "Callsign=",
            "atc_id=",
            "AtcCallsign=",
            "ATC ID=",
            "atcID=",
            "TailNumber=",
            "FlightNumber=",
        ] {
            if let Some(rest) = line.strip_prefix(prefix) {
                let cs = rest.trim().trim_matches('"');
                if !cs.is_empty() { return Some(cs.to_string()); }
            }
        }

        if line.starts_with('[') {
            in_atc_section = line.to_lowercase().contains("atc");
        }

        if in_atc_section {
            for prefix in &[
                "airline_callsign=",
                "atc_airline=",
                "callsign=",
                "atc_flight_number=",
                "flight_number=",
            ] {
                if let Some(rest) = line.strip_prefix(prefix) {
                    let cs = rest.trim().trim_matches('"');
                    if !cs.is_empty() { return Some(cs.to_string()); }
                }
            }
        }
    }

    None
}

fn sim_name_to_icao(sim_name: &str) -> Option<String> {
    let lc = sim_name.to_lowercase();
    let mappings: &[(&str, &str)] = &[
        ("a320", "A20N"), ("a321", "A21N"), ("a330", "A333"), ("a350", "A359"),
        ("b737", "B738"), ("b738", "B738"), ("b747", "B748"), ("b748", "B748"),
        ("b777", "B77W"), ("b77w", "B77W"), ("b787", "B789"), ("b789", "B789"),
        ("c172", "C172"), ("c152", "C152"), ("da62", "DA62"), ("da40", "DA40"),
        ("tbm930", "TBM9"), ("dg1001", "DG10"), ("ls8", "LS8"), ("fa18", "F18"),
        ("bell407", "B407"), ("a310", "A310"),
    ];
    for (pattern, icao) in mappings {
        if lc.contains(pattern) { return Some(icao.to_string()); }
    }
    None
}

#[tauri::command]
fn get_current_aircraft() -> Result<String, String> {
    if let Some((icao, full_name)) = get_current_aircraft_internal() {
        Ok(format!("{} ({})", icao, full_name))
    } else {
        Err("Could not determine current aircraft".to_string())
    }
}

fn read_aircraft_icao(_app_handle: &AppHandle, _title: &str, atc_model: &str) -> Option<String> {
    if !atc_model.is_empty() {
        let mut clean = atc_model.trim().to_string();
        if let Some(idx) = clean.find("AC_MODEL_") {
            clean = clean[idx + "AC_MODEL_".len()..].to_string();
            if let Some(dot) = clean.find('.') { clean.truncate(dot); }
        }
        if clean.starts_with("TT:") { clean = clean[3..].to_string(); }
        let trimmed = clean.trim().trim_matches('"').trim();
        if !trimmed.is_empty() && trimmed.len() <= 8
            && trimmed.chars().all(|c| c.is_ascii_alphanumeric())
            && !trimmed.to_uppercase().contains("ATCCOM")
            && !trimmed.starts_with("TT")
        {
            return Some(trimmed.to_uppercase());
        }
    }
    None
}

fn aircraft_detector_thread(app: AppHandle, stop: Arc<AtomicBool>) {
    let start = Instant::now();
    let mut last_emitted: Option<String> = None;

    loop {
        if stop.load(Ordering::Relaxed) { return; }

        if let Some((icao, full_name)) = get_current_aircraft_internal() {
            let aircraft = format!("{} ({})", icao, full_name);
            if last_emitted.as_deref() != Some(&aircraft) {
                let _ = app.emit("aircraft-detected", &aircraft);
                last_emitted = Some(aircraft);
            }
            thread::sleep(Duration::from_secs(5));
        } else {
            let elapsed = start.elapsed();
            let sleep_ms = if elapsed.as_secs() < 60 { 50 } else { 1000 };
            thread::sleep(Duration::from_millis(sleep_ms));
        }
    }
}

#[derive(serde::Serialize, Clone)]
struct SimData {
    latitude: f64, longitude: f64, altitude: f64, ground_speed: f64,
    heading: f64, on_ground: bool, title: String, timestamp: u64,
    callsign: String,

    light_landing: bool,
    light_taxi: bool,
    light_strobe: bool,
    light_beacon: bool,
    light_nav: bool,
    light_logo: bool,
    light_wing: bool,
    light_recognition: bool,
    light_cabin: bool,

    ap_master: bool,
    ap_hdg: bool,
    ap_alt: bool,
    ap_nav: bool,
    ap_appr: bool,
    ap_vs: bool,
    at_armed: bool,

    flaps_index: i32,
    gear_handle_down: bool,
    spoilers_pct: i32,
    parking_brake: bool,

    eng1_combustion: bool,
    eng2_combustion: bool,

    exit0_open: i32,

    systems_valid: bool,
}

fn simconnect_worker(app: AppHandle, stop: Arc<AtomicBool>) {
    use simconnect_sdk::{Notification, SimConnect, SimConnectObject};
    use std::time::{SystemTime, UNIX_EPOCH};

    #[derive(Debug, Clone, SimConnectObject)]
    #[simconnect(period = "second")]
    #[allow(dead_code)]
    struct AircraftData {
        #[simconnect(name = "PLANE LATITUDE", unit = "degrees")]
        latitude: f64,
        #[simconnect(name = "PLANE LONGITUDE", unit = "degrees")]
        longitude: f64,
        #[simconnect(name = "PLANE ALTITUDE", unit = "feet")]
        altitude: f64,
        #[simconnect(name = "GROUND VELOCITY", unit = "knots")]
        ground_speed: f64,
        #[simconnect(name = "PLANE HEADING DEGREES TRUE", unit = "degrees")]
        heading: f64,
        #[simconnect(name = "VERTICAL SPEED", unit = "feet per minute")]
        vertical_speed: f64,
        #[simconnect(name = "SIM ON GROUND")]
        on_ground: bool,
        #[simconnect(name = "TITLE")]
        title: String,
        #[simconnect(name = "ATC MODEL")]
        atc_model: String,
        #[simconnect(name = "ATC ID")]
        atc_id: String,
        #[simconnect(name = "ATC FLIGHT NUMBER")]
        atc_flight_number: String,
        #[simconnect(name = "ATC AIRLINE")]
        atc_airline: String,
    }

    #[derive(Debug, Clone, SimConnectObject)]
    #[simconnect(period = "second")]
    #[allow(dead_code)]
    struct FlightSystemsData {
        #[simconnect(name = "LIGHT LANDING")]
        light_landing: bool,
        #[simconnect(name = "LIGHT TAXI")]
        light_taxi: bool,
        #[simconnect(name = "LIGHT STROBE")]
        light_strobe: bool,
        #[simconnect(name = "LIGHT BEACON")]
        light_beacon: bool,
        #[simconnect(name = "LIGHT NAV")]
        light_nav: bool,
        #[simconnect(name = "LIGHT LOGO")]
        light_logo: bool,
        #[simconnect(name = "LIGHT WING")]
        light_wing: bool,
        #[simconnect(name = "LIGHT RECOGNITION")]
        light_recognition: bool,
        #[simconnect(name = "LIGHT CABIN")]
        light_cabin: bool,

        #[simconnect(name = "AUTOPILOT MASTER")]
        ap_master: bool,
        #[simconnect(name = "AUTOPILOT HEADING LOCK")]
        ap_hdg: bool,
        #[simconnect(name = "AUTOPILOT ALTITUDE LOCK")]
        ap_alt: bool,
        #[simconnect(name = "AUTOPILOT NAV1 LOCK")]
        ap_nav: bool,
        #[simconnect(name = "AUTOPILOT APPROACH HOLD")]
        ap_appr: bool,
        #[simconnect(name = "AUTOPILOT VERTICAL HOLD")]
        ap_vs: bool,
        #[simconnect(name = "AUTOTHROTTLE ACTIVE")]
        at_armed: bool,

        #[simconnect(name = "FLAPS HANDLE INDEX", unit = "Enum")]
        flaps_index: f64,
        #[simconnect(name = "GEAR HANDLE POSITION")]
        gear_handle_down: bool,
        #[simconnect(name = "SPOILERS HANDLE POSITION", unit = "percent over 100")]
        spoilers_pct: f64,
        #[simconnect(name = "BRAKE PARKING POSITION")]
        parking_brake: bool,

        #[simconnect(name = "ENG COMBUSTION:1")]
        eng1_combustion: bool,
        #[simconnect(name = "ENG COMBUSTION:2")]
        eng2_combustion: bool,

        #[simconnect(name = "EXIT OPEN:0")]
        exit0_open: f64,
    }

    const AIRBORNE_MIN_SECS: u64 = 30;
    const MIN_DEPARTURE_DIST_M: f64 = 500.0;
    const GROUNDED_DWELL_SECS: u64 = 10;
    const MIN_AIRBORNE_ALT_FT: f64 = 100.0;
    const MIN_AIRBORNE_GS_KT: f64 = 40.0;

    let mut flight_active = false;
    let mut flight_start: Option<u64> = None;
    let mut flight_start_lat = 0.0f64;
    let mut flight_start_lon = 0.0f64;
    let mut grounded_since: Option<u64> = None;
    let mut last_vertical_speed = 0.0f64;
    let mut cached_icao: Option<String> = None;
    let mut last_cache_key = String::new();
    let mut attempts_without_icao: u32 = 0;
    let mut cached_aircraft_from_file: Option<String> = None;

    fn dist_m(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
        let r = 6_371_000.0_f64;
        let to_rad = std::f64::consts::PI / 180.0;
        let dlat = (lat2 - lat1) * to_rad;
        let dlon = (lon2 - lon1) * to_rad;
        let a = (dlat / 2.0).sin().powi(2)
            + (lat1 * to_rad).cos() * (lat2 * to_rad).cos() * (dlon / 2.0).sin().powi(2);
        2.0 * r * a.sqrt().asin()
    }

    loop {
        if stop.load(Ordering::Relaxed) { return; }
        let client = SimConnect::new("Aervox ACARS");
        match client {
            Ok(mut sc) => {
                if cached_aircraft_from_file.is_none() {
                    if let Ok(from_file) = get_current_aircraft() {
                        cached_aircraft_from_file = Some(from_file);
                    }
                }

                if let Err(e) = sc.register_object::<AircraftData>() {
                    log::error!("register_object (AircraftData) failed: {:?}", e);
                    let _ = app.emit("simconnect-error", format!("AircraftData: {:?}", e));
                    let _ = app.emit("simconnect-connected", false);
                    thread::sleep(Duration::from_secs(5));
                    continue;
                }

                let systems_ok = match sc.register_object::<FlightSystemsData>() {
                    Ok(_) => true,
                    Err(e) => {
                        log::warn!("register_object (FlightSystemsData) failed: {:?}", e);
                        false
                    }
                };

                let _ = app.emit("simconnect-connected", true);

                let mut last_data_instant = Instant::now();
                let connection_opened_at = Instant::now();
                let data_timeout = Duration::from_secs(15);
                let stale_connection_timeout = Duration::from_secs(5);
                let mut saw_any_dispatch = false;
                let mut systems: Option<FlightSystemsData> = None;

                loop {
                    if stop.load(Ordering::Relaxed) {
                        if flight_active {
                            if let Some(start) = flight_start.take() {
                                let ts = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
                                let duration = ts.saturating_sub(start);
                                let _ = app.emit("flight-ended", serde_json::json!({
                                    "start_latitude": flight_start_lat, "start_longitude": flight_start_lon,
                                    "end_latitude": flight_start_lat, "end_longitude": flight_start_lon,
                                    "duration_seconds": duration,
                                    "aircraft": cached_aircraft_from_file.clone().unwrap_or_else(|| cached_icao.clone().unwrap_or_default()),
                                    "landing_rate_fpm": last_vertical_speed, "timestamp": ts,
                                }));
                            }
                        }
                        let _ = app.emit("simconnect-connected", false);
                        return;
                    }

                    if !saw_any_dispatch && connection_opened_at.elapsed() > stale_connection_timeout {
                        log::info!("SimConnect handle was stale (sim closed?) — recycling");
                        let _ = app.emit("simconnect-connected", false);
                        break;
                    }

                    if last_data_instant.elapsed() > data_timeout {
                        log::warn!(
                            "No sim-data for {:?} — recycling SimConnect (likely menu/flight transition)",
                            data_timeout
                        );
                        break;
                    }

                    match sc.get_next_dispatch() {
                        Ok(Some(Notification::Object(data))) => {
                            saw_any_dispatch = true;
                            last_data_instant = Instant::now();

                            let aircraft = AircraftData::try_from(&data).ok();

                            if aircraft.is_none() && systems_ok {
                                if let Ok(sys) = FlightSystemsData::try_from(&data) {
                                    systems = Some(sys);
                                }
                            }

                            if let Some(aircraft) = aircraft {
                                let near_origin = aircraft.latitude.abs() < 1.0 && aircraft.longitude.abs() < 1.0;
                                if !near_origin {
                                    let raw_title = aircraft.title.trim_end_matches('\0').trim().to_string();
                                    let raw_atc = aircraft.atc_model.trim_end_matches('\0').trim().to_string();
                                    let atc_id_raw = aircraft.atc_id.trim_end_matches('\0').trim().to_string();
                                    let atc_flight_num = aircraft.atc_flight_number.trim_end_matches('\0').trim().to_string();
                                    let atc_airline_raw = aircraft.atc_airline.trim_end_matches('\0').trim().to_string();

                                    let raw_callsign = if !atc_id_raw.is_empty() {
                                        atc_id_raw
                                    } else if !atc_airline_raw.is_empty() && !atc_flight_num.is_empty() {
                                        format!("{}{}", atc_airline_raw, atc_flight_num)
                                    } else if !atc_flight_num.is_empty() {
                                        atc_flight_num
                                    } else {
                                        get_callsign_from_flt().unwrap_or_default()
                                    };

                                    if cached_aircraft_from_file.is_none() {
                                        if let Ok(from_file) = get_current_aircraft() {
                                            cached_aircraft_from_file = Some(from_file);
                                        }
                                    }

                                    let cache_key = format!("{}|{}", raw_title, raw_atc);
                                    let needs_lookup = cached_icao.is_none()
                                        || (cache_key != last_cache_key && !raw_atc.is_empty());

                                    if needs_lookup && attempts_without_icao < 30
                                        && (!raw_title.is_empty() || !raw_atc.is_empty())
                                    {
                                        last_cache_key = cache_key;
                                        let result = read_aircraft_icao(&app, &raw_title, &raw_atc);
                                        if result.is_some() {
                                            cached_icao = result;
                                            attempts_without_icao = 0;
                                        } else {
                                            attempts_without_icao += 1;
                                        }
                                    }

                                    let display_title = cached_aircraft_from_file.clone()
                                        .or_else(|| {
                                            cached_icao.as_ref().map(|icao| {
                                                if !raw_title.is_empty() && raw_title != *icao {
                                                    format!("{} ({})", icao, raw_title)
                                                } else { icao.clone() }
                                            })
                                        })
                                        .or_else(|| if !raw_title.is_empty() { Some(raw_title.clone()) } else { None })
                                        .unwrap_or_else(|| "Unknown Aircraft".to_string());

                                    let ts = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
                                    let is_moving = aircraft.ground_speed > 40.0;
                                    let is_airborne = !aircraft.on_ground
                                        && (aircraft.altitude > MIN_AIRBORNE_ALT_FT
                                            || aircraft.ground_speed > MIN_AIRBORNE_GS_KT);
                                    let dist_from_start = if flight_active {
                                        dist_m(flight_start_lat, flight_start_lon,
                                               aircraft.latitude, aircraft.longitude)
                                    } else { 0.0 };

                                    if !flight_active && is_airborne && is_moving {
                                        flight_active = true;
                                        flight_start = Some(ts);
                                        flight_start_lat = aircraft.latitude;
                                        flight_start_lon = aircraft.longitude;
                                        grounded_since = None;
                                        let _ = app.emit("flight-started", serde_json::json!({
                                            "latitude": aircraft.latitude, "longitude": aircraft.longitude,
                                            "aircraft": display_title, "timestamp": ts,
                                            "callsign": raw_callsign.clone(),
                                        }));
                                    }

                                    if flight_active {
                                        if !aircraft.on_ground {
                                            grounded_since = None;
                                        } else {
                                            if grounded_since.is_none() {
                                                grounded_since = Some(ts);
                                            }
                                            let grounded_for = ts.saturating_sub(grounded_since.unwrap_or(ts));
                                            let total_airborne = ts.saturating_sub(flight_start.unwrap_or(ts));

                                            let is_real_flight =
                                                total_airborne >= AIRBORNE_MIN_SECS
                                                && dist_from_start >= MIN_DEPARTURE_DIST_M;

                                            if is_real_flight && grounded_for >= GROUNDED_DWELL_SECS {
                                                flight_active = false;
                                                if let Some(start) = flight_start.take() {
                                                    let duration_secs = ts.saturating_sub(start);
                                                    let _ = app.emit("flight-ended", serde_json::json!({
                                                        "start_latitude": flight_start_lat, "start_longitude": flight_start_lon,
                                                        "end_latitude": aircraft.latitude, "end_longitude": aircraft.longitude,
                                                        "duration_seconds": duration_secs, "aircraft": display_title,
                                                        "landing_rate_fpm": last_vertical_speed, "timestamp": ts,
                                                    }));
                                                }
                                                grounded_since = None;
                                            }
                                        }
                                    }

                                    if !aircraft.on_ground { last_vertical_speed = aircraft.vertical_speed; }

                                    let sys = systems.take();
                                    let flaps_out = sys.as_ref().map(|s| s.flaps_index.round().clamp(0.0, 40.0) as i32).unwrap_or(0);
                                    let spoilers_out = sys.as_ref().map(|s| (s.spoilers_pct.max(0.0).min(1.0) * 100.0).round() as i32).unwrap_or(0);
                                    let exit0_out = sys.as_ref().map(|s| s.exit0_open.round().clamp(0.0, 100.0) as i32).unwrap_or(0);

                                    let payload = SimData {
                                        latitude: aircraft.latitude, longitude: aircraft.longitude, altitude: aircraft.altitude,
                                        ground_speed: aircraft.ground_speed, heading: aircraft.heading,
                                        on_ground: aircraft.on_ground, title: display_title, timestamp: ts,
                                        callsign: raw_callsign.clone(),

                                        light_landing: sys.as_ref().map(|s| s.light_landing).unwrap_or(false),
                                        light_taxi: sys.as_ref().map(|s| s.light_taxi).unwrap_or(false),
                                        light_strobe: sys.as_ref().map(|s| s.light_strobe).unwrap_or(false),
                                        light_beacon: sys.as_ref().map(|s| s.light_beacon).unwrap_or(false),
                                        light_nav: sys.as_ref().map(|s| s.light_nav).unwrap_or(false),
                                        light_logo: sys.as_ref().map(|s| s.light_logo).unwrap_or(false),
                                        light_wing: sys.as_ref().map(|s| s.light_wing).unwrap_or(false),
                                        light_recognition: sys.as_ref().map(|s| s.light_recognition).unwrap_or(false),
                                        light_cabin: sys.as_ref().map(|s| s.light_cabin).unwrap_or(false),

                                        ap_master: sys.as_ref().map(|s| s.ap_master).unwrap_or(false),
                                        ap_hdg: sys.as_ref().map(|s| s.ap_hdg).unwrap_or(false),
                                        ap_alt: sys.as_ref().map(|s| s.ap_alt).unwrap_or(false),
                                        ap_nav: sys.as_ref().map(|s| s.ap_nav).unwrap_or(false),
                                        ap_appr: sys.as_ref().map(|s| s.ap_appr).unwrap_or(false),
                                        ap_vs: sys.as_ref().map(|s| s.ap_vs).unwrap_or(false),
                                        at_armed: sys.as_ref().map(|s| s.at_armed).unwrap_or(false),

                                        flaps_index: flaps_out,
                                        gear_handle_down: sys.as_ref().map(|s| s.gear_handle_down).unwrap_or(false),
                                        spoilers_pct: spoilers_out,
                                        parking_brake: sys.as_ref().map(|s| s.parking_brake).unwrap_or(false),

                                        eng1_combustion: sys.as_ref().map(|s| s.eng1_combustion).unwrap_or(false),
                                        eng2_combustion: sys.as_ref().map(|s| s.eng2_combustion).unwrap_or(false),

                                        exit0_open: exit0_out,
                                        systems_valid: sys.is_some(),
                                    };
                                    let _ = app.emit("sim-data", &payload);
                                }
                            }
                        }
                        Ok(Some(_)) => {
                            saw_any_dispatch = true;
                            last_data_instant = Instant::now();
                        }
                        Ok(None) => {
                            saw_any_dispatch = true;
                            thread::sleep(Duration::from_millis(100));
                        }
                        Err(e) => {
                            let msg = format!("{:?}", e).to_lowercase();
                            let is_transition = msg.contains("disconnect")
                                || msg.contains("not connected")
                                || msg.contains("quit")
                                || msg.contains("invalid handle")
                                || msg.contains("no connection");

                            if is_transition {
                                log::debug!("SimConnect host reset (normal MSFS transition): {:?}", e);
                            } else {
                                log::warn!("SimConnect dispatch error: {:?}", e);
                                let _ = app.emit("simconnect-error", format!("{:?}", e));
                            }

                            let _ = app.emit("simconnect-connected", false);
                            break;
                        }
                    }
                }
                let _ = app.emit("simconnect-connected", false);
            }
            Err(_e) => {
                let _ = app.emit("simconnect-connected", false);
            }
        }
        thread::sleep(Duration::from_secs(2));
    }
}

#[tauri::command]
fn start_simconnect(app: AppHandle, state: tauri::State<SimState>) -> Result<(), String> {
    if state.running.load(Ordering::Relaxed) { return Ok(()); }
    state.running.store(true, Ordering::Relaxed);
    let stop = state.stop.clone();
    let app_clone = app.clone();
    thread::spawn(move || simconnect_worker(app_clone, stop));

    let stop2 = state.stop.clone();
    let app_clone2 = app.clone();
    thread::spawn(move || aircraft_detector_thread(app_clone2, stop2));

    Ok(())
}

#[tauri::command]
fn stop_simconnect(state: tauri::State<SimState>) -> Result<(), String> {
    state.stop.store(true, Ordering::Relaxed);
    state.running.store(false, Ordering::Relaxed);
    Ok(())
}

struct SimState { running: Arc<AtomicBool>, stop: Arc<AtomicBool> }

#[derive(serde::Serialize, Clone)]
struct NetworkPilot {
    source: String,
    callsign: String,
    name: String,
    logon_time: String,
    latitude: f64,
    longitude: f64,
    altitude: i32,
    groundspeed: i32,
    heading: i32,
    departure: String,
    arrival: String,
    aircraft: String,
}

#[tauri::command]
async fn fetch_network_traffic() -> Result<Vec<NetworkPilot>, String> {
    use rand::Rng;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent("Aervox/0.1")
        .build()
        .map_err(|e| format!("client build: {}", e))?;

    let mut pilots: Vec<NetworkPilot> = Vec::new();

    if let Ok(resp) = client.get("https://data.vatsim.net/v3/vatsim-data.json").send().await {
        if let Ok(json) = resp.json::<serde_json::Value>().await {
            if let Some(arr) = json["pilots"].as_array() {
                for p in arr {
                    let lat = p["latitude"].as_f64().unwrap_or(0.0);
                    let lon = p["longitude"].as_f64().unwrap_or(0.0);
                    if lat == 0.0 && lon == 0.0 { continue; }

                    let altitude = p["altitude"].as_i64().unwrap_or(0) as i32;
                    let groundspeed = p["groundspeed"].as_i64().unwrap_or(0) as i32;

                    if altitude == 0 && groundspeed < 30 { continue; }

                    pilots.push(NetworkPilot {
                        source: "VATSIM".into(),
                        callsign: p["callsign"].as_str().unwrap_or("").into(),
                        name: p["name"].as_str().unwrap_or("").into(),
                        logon_time: p["logon_time"].as_str().unwrap_or("").into(),
                        latitude: lat,
                        longitude: lon,
                        altitude,
                        groundspeed,
                        heading: p["heading"].as_i64().unwrap_or(0) as i32,
                        departure: p["flight_plan"]["departure"].as_str().unwrap_or("").into(),
                        arrival: p["flight_plan"]["arrival"].as_str().unwrap_or("").into(),
                        aircraft: p["flight_plan"]["aircraft_short"].as_str().unwrap_or("").into(),
                    });
                }
            }
        }
    }

    let cap = rand::thread_rng().gen_range(100..=300);
    if pilots.len() > cap {
        pilots.sort_by(|a, b| b.groundspeed.cmp(&a.groundspeed));
        pilots.truncate(cap);
    }

    Ok(pilots)
}

#[derive(serde::Serialize)]
struct MetarData {
    icao: String,
    raw: String,
    wind_dir: Option<i32>,
    wind_speed: Option<i32>,
    wind_gust: Option<i32>,
    visibility: Option<String>,
    weather: Option<String>,
    clouds: Option<String>,
    flight_category: Option<String>,
    temp: Option<f64>,
    dewpoint: Option<f64>,
    altimeter: Option<f64>,
    obs_time: Option<String>,
}

#[tauri::command]
async fn fetch_metar(icao: String) -> Result<MetarData, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .user_agent("MSFS-Company-App/0.1")
        .build()
        .map_err(|e| format!("client build: {}", e))?;

    let url = format!(
        "https://aviationweather.gov/api/data/metar?ids={}&format=json",
        icao.to_uppercase()
    );

    let resp = client.get(&url).send().await.map_err(|e| format!("network: {}", e))?;
    let status = resp.status();
    if !status.is_success() {
        return Err(format!("http-{}", status.as_u16()));
    }

    let body = resp.text().await.map_err(|e| format!("read: {}", e))?;
    let arr: Vec<serde_json::Value> = serde_json::from_str(&body)
        .map_err(|e| format!("json: {} — body starts: {}", e, body.chars().take(80).collect::<String>()))?;

    let v = match arr.first() {
        Some(v) => v,
        None => return Err("no-metar".to_string()),
    };

    let clouds = v["clouds"].as_array().map(|arr| {
        arr.iter()
            .filter_map(|c| {
                let cover = c["cover"].as_str()?;
                let base = c["base"].as_i64();
                Some(match base {
                    Some(b) => format!("{} {}", cover, b),
                    None => cover.to_string(),
                })
            })
            .collect::<Vec<_>>()
            .join(" · ")
    }).filter(|s| !s.is_empty());

    Ok(MetarData {
        icao: v["icaoId"].as_str().unwrap_or(&icao).to_string(),
        raw: v["rawOb"].as_str().unwrap_or("").to_string(),
        wind_dir: v["wdir"].as_i64().map(|n| n as i32),
        wind_speed: v["wspd"].as_i64().map(|n| n as i32),
        wind_gust: v["gust"].as_i64().map(|n| n as i32),
        visibility: v["visib"].as_str().map(|s| s.to_string()),
        weather: v["wxString"].as_str().map(|s| s.to_string()),
        clouds,
        flight_category: v["fltCat"].as_str().map(|s| s.to_string()),
        temp: v["temp"].as_f64(),
        dewpoint: v["dewp"].as_f64(),
        altimeter: v["altim"].as_f64(),
        obs_time: v["obsTime"].as_str().map(|s| s.to_string()),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_sql::Builder::default().build())
    .plugin(tauri_plugin_store::Builder::default().build())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .manage(SimState { running: Arc::new(AtomicBool::new(false)), stop: Arc::new(AtomicBool::new(false)) })
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())?;
      }
      Ok(())
    })
	.invoke_handler(tauri::generate_handler![
	  get_machine_info, verify_license, read_license_file, write_license_file,
	  hash_password, verify_password, start_simconnect, stop_simconnect,
	  save_packages_path, fetch_network_traffic, get_current_aircraft, fetch_metar
	])
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}