// Orthographic camera: rotate the floor around Z, then tilt it around X.
export function mapProjection(viewBox, yawDegrees, tiltDegrees, wallHeight=24) {
  const [x,y,w,h]=viewBox, cx=x+w/2,cy=y+h/2;
  const yaw=yawDegrees*Math.PI/180, tilt=tiltDegrees*Math.PI/180;
  const c=Math.cos(yaw),s=Math.sin(yaw),p=Math.cos(tilt);
  const fit=Math.min(1,w/(Math.abs(c)*w+Math.abs(s)*h),h/(p*(Math.abs(s)*w+Math.abs(c)*h)+Math.sin(tilt)*wallHeight));
  const a=c*fit,b=p*s*fit,cc=-s*fit,d=p*c*fit;
  return {
    matrix:[a,b,cc,d,cx-a*cx-cc*cy,cy-b*cx-d*cy],
    point:([px,py])=>[a*px+cc*py+cx-a*cx-cc*cy,b*px+d*py+cy-b*cx-d*cy],
    wallOffset:[-s*Math.tan(tilt)*wallHeight,-c*Math.tan(tilt)*wallHeight],
    depth:([px,py])=>s*(px-cx)+c*(py-cy),
    front:([dx,dy])=>dy*s-dx*c>0,
  };
}
