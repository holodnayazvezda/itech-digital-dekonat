import {Dumbbell,Flame,Heart,Wind,Music2,Shield,CircleDot,Waves,Mountain,Footprints,Target} from 'lucide-react';
const icons={dumbbell:Dumbbell,flame:Flame,heart:Heart,wind:Wind,music:Music2,shield:Shield,ball:CircleDot,waves:Waves,mountain:Mountain,footsteps:Footprints,racket:Target};
export default function SportSymbol({sport,...props}) {
  const Symbol=icons[sport?.icon] || Dumbbell;
  return <Symbol {...props}/>;
}
