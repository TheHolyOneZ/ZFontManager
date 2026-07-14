

import { invoke } from "@tauri-apps/api/core";

export type SoundLevel = "off" | "subtle" | "on";

let level: SoundLevel = "off";

export function setSoundLevel(l: SoundLevel) {
  level = l;
}

function play(kind: string) {
  if (level === "off") return;
  void invoke("play_sound", { kind, level }).catch(() => {});
}

export function playToggle(on: boolean) {
  play(on ? "toggle-on" : "toggle-off");
}

export function playStar(on: boolean) {
  play(on ? "star-on" : "star-off");
}

export function playTick() {
  play("tick");
}

export function playTag(add: boolean) {
  play(add ? "tag-add" : "tag-remove");
}


export function playKind(kind: string) {
  play(kind);
}

export function playSuccess() {
  play("success");
}

export function playError() {
  play("error");
}
