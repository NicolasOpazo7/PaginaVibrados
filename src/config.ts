export const company = {about:'Cierres de hormigón resistentes y duraderos para proteger tu propiedad.',name:'Vibrados Lagunilla', whatsapp:'56932184992', phone:'999297952', address:'Camino Las Rastras, KM 12, Talca'};
export const wa = (text='Hola, me gustaría solicitar una cotización con Vibrados Lagunilla.') => `https://wa.me/${company.whatsapp}?text=${encodeURIComponent(text)}`;
export async function api(path:string, options:RequestInit={}) {const r=await fetch(`/api${path}`,{...options,headers:{...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),...options.headers}}); const data=await r.json(); if(!r.ok) throw new Error(data.error||'No fue posible completar la solicitud.');return data;}
export type ProjectMedia={id:number;type:'image'|'video';src:string;thumbnail?:string;alt:string;position:number};
export type Project={id:number;title:string;category:string;description:string;image:string;position:number;media:ProjectMedia[]};
export type Review={id:number;name:string;rating:number;comment:string;created:string;status:string;response?:string;image?:string};
