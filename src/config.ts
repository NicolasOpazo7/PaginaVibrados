import {useSupabase,listPublicReviews,submitSupabaseReview} from './services/supabaseReviews';
export const company = {about:'Cierres de hormigón resistentes y duraderos para proteger tu propiedad.',name:'Vibrados Lagunilla', whatsapp:'56932184992', phone:'999297952', address:'Camino Las Rastras, KM 12, Talca'};
export const wa = (text='Hola, me gustaría solicitar una cotización con Vibrados Lagunilla.') => `https://wa.me/${company.whatsapp}?text=${encodeURIComponent(text)}`;
export const staticSite=import.meta.env?.VITE_STATIC_SITE==='true';
// This public URL contains no credentials. Admin sessions stay on the Node server.
export const reviewsServer=(import.meta.env?.VITE_REVIEWS_API_URL||'').replace(/\/$/,'');
export const reviewsAvailable=useSupabase||!staticSite||Boolean(reviewsServer);
export async function reviewsApi(options:RequestInit={}){
  if(useSupabase){if(options.method==='POST'){if(!(options.body instanceof FormData))throw new Error('Formulario inválido.');return submitSupabaseReview(options.body)}return listPublicReviews()}
  if(!reviewsAvailable)throw new Error('El envío de reseñas aún no está disponible. Inténtalo más tarde.');
  let response:Response;
  try{response=await fetch(`${reviewsServer}/api/reviews`,{...options,credentials:'omit'})}
  catch{throw new Error('No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.')}
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(data?.error||(response.status===429?'Has realizado varios intentos. Inténtalo más tarde.':'No se pudo completar la solicitud. Inténtalo de nuevo.'));
  return Array.isArray(data)?data.map(review=>({...review,image:review.image?.startsWith('/uploads/')?reviewsServer+review.image:review.image})):data;
}
export function asset(path:string,base=import.meta.env?.BASE_URL||'/'){
  if(/^(?:[a-z]+:|\/\/)/i.test(path)||path.startsWith('/uploads/'))return path;
  if(base!=='/'&&path.startsWith(base))return path;
  return base+path.replace(/^\/+/, '');
}
export async function api(path:string, options:RequestInit={}) {const r=await fetch(`/api${path}`,{...options,headers:{...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),...options.headers}}); const data=await r.json(); if(!r.ok) throw new Error(data.error||'No fue posible completar la solicitud.');return data;}
export type ProjectMedia={id:number;type:'image'|'video';src:string;thumbnail?:string;alt:string;position:number};
export type Project={location?:string;id:number;title:string;category:string;description:string;image:string;position:number;media:ProjectMedia[]};
export type Review={id:number|string;name:string;rating:number;comment:string;created:string;status:string;response?:string;image?:string};
