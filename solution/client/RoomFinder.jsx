import SpaceBooking from "./SpaceBooking.jsx";
import SportsCatalogue from "./SportsCatalogue.jsx";
import SportsBooking from "./SportsBooking.jsx";
import { gym } from "../shared/campus-data.js";

export default function RoomFinder({ sportsOnly, ...props }) {
  if (gym && props.initial?.short === gym.short) return <SportsBooking {...props} />;
  return sportsOnly ? <SportsCatalogue {...props} /> : <SpaceBooking {...props} />;
}
