import { Files } from "lucide-react";
import { serviceDesign } from "./service-design.js";
import { useImagesReady, useRouteImages } from "./image-ready.js";

function tilePhoto(service) {
  const image = serviceDesign[service]?.image;
  return image ? import.meta.env.BASE_URL + image : null;
}

function ServiceSymbol({service, icon:Fallback}) {
  const props={className:"service-tile-symbol image-skeleton-icon",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.4,strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":true};
  if(service==="wifi") return <svg {...props} strokeWidth={1.9}><path d="M3 8a14 14 0 0 1 18 0M6.5 12a8.8 8.8 0 0 1 11 0M10 16a3.1 3.1 0 0 1 4 0"/><circle cx="12" cy="20" r="1" fill="currentColor" stroke="none"/></svg>;
  if(service==="navigator") return <svg {...props} stroke="none" fill="currentColor"><path d="M2.6 6.4 6 4.4Q7 3.8 7 5v12.4q0 .7-.6 1.1L3 20.5q-1 .6-1-.6V7.5q0-.7.6-1.1ZM10 4.2l4.4 2.2q.6.3.6 1v12.2q0 1.2-1 .7l-4.4-2.2q-.6-.3-.6-1V4.9q0-1.2 1-.7ZM17.6 6.4 21 4.4q1-.6 1 .6v12.4q0 .7-.6 1.1L18 20.5q-1 .6-1-.6V7.5q0-.7.6-1.1Z"/></svg>;
  if(service==="docs") return <svg {...props}><path d="M8 3h6.2a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v4a2 2 0 0 0 2 2h4M9.5 12.5h7M9.5 16.5h5"/></svg>;
  if(service==="booked") return <svg {...props}><path d="M6 5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2"/><rect x="8" y="2" width="8" height="5" rx="2.2"/><path d="m7.5 11.5 1.4 1.4 2.1-2.3m2.5 1.4h3m-9 5 1.4 1.4 2.1-2.3m2.5 1.4h3"/></svg>;
  return <Fallback className="service-tile-symbol image-skeleton-icon" size={120} strokeWidth={1.3} aria-hidden="true"/>;
}

function ServiceSection({ group, onSelect }) {
  const tiles = group.items.map(([, label, , service]) => ({ label, service, design: serviceDesign[service] }));
  const bento = group.kind === "campus" && tiles.length === 4 &&
    ["wifi", "sports", "spaces", "navigator"].every(service => tiles.some(tile => tile.service === service));
  const { pending, imageProps } = useImagesReady(tiles.map(({ service }) => tilePhoto(service)));

  return (
    <section className={"service-section service-section-" + group.kind}
      data-image-pending={pending || undefined} aria-busy={pending || undefined}>
      {group.title && <h2><span className="image-skeleton-text">{group.title}</span></h2>}
      <div className={"service-tiles" + (bento ? " service-tiles-bento" : "")}>
        {tiles.map(({ label, service, design }, index) => {
          const photo = imageProps[index];
          const showSymbol = !photo.src || photo["data-image-state"] === "error";
          return <button className={"service-tile" + (photo.src ? " service-tile-photo" : "")}
            data-service={service} style={{ "--service-accent": design?.color }} key={service}
            onClick={() => onSelect(service)} aria-label={label} disabled={pending}>
            {photo.src && <img className="service-tile-image" {...photo} alt=""
              loading={group.kind === "campus" ? "eager" : "lazy"} />}
            {showSymbol && <ServiceSymbol service={service} icon={design?.icon || Files} />}
            <span className="service-tile-copy"><b><span className="image-skeleton-text">{label}</span></b></span>
          </button>;
        })}
      </div>
    </section>
  );
}

export default function ServiceCatalog({groups, onSelect}) {
  useRouteImages(groups.flatMap(group => group.items.map(item => tilePhoto(item[3]))));
  return <div className="services-home">
    {groups.filter(group => group.items.length).map(group => <ServiceSection key={group.kind} group={group} onSelect={onSelect} />)}
  </div>;
}
