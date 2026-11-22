import { ArrowUp, CornerUpLeft, CornerUpRight, Undo2 } from "lucide-react";

const arrows = { straight: ArrowUp, left: CornerUpLeft, right: CornerUpRight, "turn-back": Undo2 };

export default function CampusManeuver({ instruction }) {
  const Arrow = arrows[instruction.kind] || ArrowUp;
  return <span className="campus-maneuver" data-kind={instruction.kind}>
    <span className="campus-maneuver-icon"><Arrow size={17} strokeWidth={2.1} aria-hidden="true" /></span>
    <b>{instruction.label}</b>
    {instruction.meters !== null && <small>≈ {instruction.meters} м</small>}
  </span>;
}
