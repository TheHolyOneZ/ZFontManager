import { motion } from "motion/react";
import { useState } from "react";
import { springBouncy } from "../springs";
import { playToggle } from "../../lib/sound";

interface Props {
  on: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
  label: string;
  size?: "sm" | "lg";
}


export function PillToggle({ on, disabled, onChange, label, size = "sm" }: Props) {
  const [pressed, setPressed] = useState(false);

  return (
    <motion.button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      className={`pill-toggle pill-${size} ${on ? "pill-on" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        playToggle(!on);
        onChange(!on);
      }}
      onPointerDown={() => !disabled && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      whileTap={disabled ? undefined : { scale: 0.94 }}
    >
      <motion.span
        className="pill-thumb"
        layout
        animate={{ scaleX: pressed ? 1.25 : 1 }}
        transition={springBouncy}
        style={{ originX: on ? 1 : 0 }}
      />
    </motion.button>
  );
}
