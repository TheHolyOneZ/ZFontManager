

use rodio::buffer::SamplesBuffer;
use rodio::OutputStream;
use std::sync::mpsc::{channel, Sender};
use std::sync::OnceLock;

const SAMPLE_RATE: u32 = 44_100;


fn tone(freq: f32, dur_ms: u32, vol: f32) -> Vec<f32> {
    let n = (SAMPLE_RATE * dur_ms / 1000) as usize;
    let attack = (SAMPLE_RATE as usize * 8) / 1000;
    (0..n)
        .map(|i| {
            let t = i as f32 / SAMPLE_RATE as f32;
            let env = if i < attack {
                i as f32 / attack as f32
            } else {
                let p = (i - attack) as f32 / (n - attack).max(1) as f32;
                (1.0 - p).powi(2)
            };
            (std::f32::consts::TAU * freq * t).sin() * env * vol
        })
        .collect()
}

fn seq(parts: &[(f32, u32, f32)]) -> Vec<f32> {
    let mut out = Vec::new();
    for &(f, d, v) in parts {
        out.extend(tone(f, d, v));
    }
    out
}


fn samples_for(kind: &str, vol: f32) -> Vec<f32> {
    match kind {
        "toggle-on" => tone(660.0, 70, vol),
        "toggle-off" => tone(480.0, 70, vol),

        "star-on" => seq(&[(1174.7, 40, vol * 0.75), (1760.0, 55, vol * 0.5)]),
        "star-off" => tone(880.0, 45, vol * 0.5),

        "tick" => tone(1000.0, 28, vol * 0.7),
        "tag-add" => tone(740.0, 38, vol * 0.7),
        "tag-remove" => tone(620.0, 38, vol * 0.6),

        "trash" => seq(&[(493.9, 70, vol), (329.6, 95, vol * 0.85)]),
        "restore" => seq(&[(329.6, 70, vol * 0.85), (493.9, 95, vol)]),
        "trash-empty" => tone(196.0, 160, vol * 0.9),

        "install" => seq(&[(523.3, 65, vol), (659.3, 65, vol * 0.9), (784.0, 115, vol * 0.85)]),
        "success" => seq(&[(587.0, 90, vol), (880.0, 120, vol * 0.8)]),
        "error" => tone(220.0, 140, vol * 0.9),
        _ => Vec::new(),
    }
}


fn sender() -> &'static Sender<(String, f32)> {
    static TX: OnceLock<Sender<(String, f32)>> = OnceLock::new();
    TX.get_or_init(|| {
        let (tx, rx) = channel::<(String, f32)>();
        std::thread::spawn(move || {

            let stream = OutputStream::try_default().ok();
            for (kind, vol) in rx {
                if let Some((_stream, handle)) = &stream {
                    let samples = samples_for(&kind, vol);
                    if !samples.is_empty() {
                        let _ = handle.play_raw(SamplesBuffer::new(1, SAMPLE_RATE, samples));
                    }
                }
            }
        });
        tx
    })
}

pub fn play(kind: &str, level: &str) {
    let vol = match level {
        "on" => 0.14,
        "subtle" => 0.055,
        _ => return,
    };
    let _ = sender().send((kind.to_string(), vol));
}
