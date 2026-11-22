export const minutes = time => Number(time.slice(0,2))*60+Number(time.slice(3));

// Intersecting events occupy separate lanes. Reuse a lane when its event ends.
export function eventLanes(events) {
  const result=[];
  let cluster=[], ends=[], clusterEnd=-1;
  function flush() {
    for(const item of cluster) result.push({...item,lanes:ends.length});
    cluster=[];ends=[];clusterEnd=-1;
  }
  for(const event of [...events].sort((a,b)=>a.time.localeCompare(b.time)||a.end.localeCompare(b.end))) {
    const start=minutes(event.time),end=minutes(event.end);
    if(start>=clusterEnd) flush();
    let lane=ends.findIndex(value=>value<=start);
    if(lane<0)lane=ends.length;
    ends[lane]=end;cluster.push({event,lane});clusterEnd=Math.max(clusterEnd,end);
  }
  flush();return result;
}
