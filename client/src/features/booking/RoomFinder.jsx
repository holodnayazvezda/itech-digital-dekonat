import SpaceBooking from "./SpaceBooking.jsx";
import SportsCatalogue from "../sports/SportsCatalogue.jsx";
import SportsBooking from "../sports/SportsBooking.jsx";
import { gym } from "../../shared/domain/campus-data.js";
export default function RoomFinder({
  sportsOnly,
  ...props
}) {
  if (gym && props.initial?.short === gym.short) return <SportsBooking {...props} />;
  return sportsOnly ? <SportsCatalogue {...props} /> : <SpaceBooking {...props} />;
}
