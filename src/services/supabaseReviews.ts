import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import type {Review} from '../config';
import projectConfig from '../../content/supabase.json';

export const supabaseUrl=(import.meta.env?.VITE_SUPABASE_URL||projectConfig.url).replace(/\/$/,'');
const key=import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY||projectConfig.publishableKey;
export const useSupabase=import.meta.env?.VITE_REVIEWS_PROVIDER!=='node'&&Boolean(supabaseUrl&&key);
if(key.startsWith('sb_secret_'))throw new Error('Usa únicamente la clave pública de Supabase en la web.');
const fields='id,name,rating,comment,image_path,created,status,response';
const bucket='review-images';
type Row=Omit<Review,'image'>&{image_path?:string|null};
let publicClient:SupabaseClient|null=null,adminClient:SupabaseClient|null=null;
function client(admin=false){
  if(!useSupabase)throw new Error('La conexión con Supabase aún no está configurada.');
  if(admin){
    // The administrator signs in again after a reload. No credentials/tokens in localStorage.
    return adminClient??=createClient(supabaseUrl,key,{auth:{persistSession:false,detectSessionInUrl:false,autoRefreshToken:true,storageKey:'vibrados-review-admin'}});
  }
  return publicClient??=createClient(supabaseUrl,key,{auth:{persistSession:false,detectSessionInUrl:false,autoRefreshToken:false,storageKey:'vibrados-review-public'}});
}
function fail(error:{code?:string;message?:string}|null){
  if(!error)return;
  if(['PGRST205','PGRST202','42P01','42883'].includes(error.code||''))throw new Error('El servicio de reseñas todavía está en configuración. Inténtalo más tarde.');
  throw new Error(error.message||'No se pudo completar la solicitud. Inténtalo de nuevo.');
}
async function withImages(rows:Row[],connection:SupabaseClient):Promise<Review[]>{
  const paths=rows.map(r=>r.image_path).filter((p):p is string=>Boolean(p));
  const images=new Map<string,string>();
  if(paths.length){
    const {data,error}=await connection.storage.from(bucket).createSignedUrls(paths,120);
    if(error)throw new Error('No se pudieron cargar las imágenes de las reseñas. Inténtalo de nuevo.');
    data?.forEach(item=>{if(item.path&&item.signedUrl)images.set(item.path,item.signedUrl)});
  }
  return rows.map(({image_path,...row})=>({...row,image:image_path?images.get(image_path):undefined}));
}
export async function listPublicReviews(){
  const connection=client();
  const {data,error}=await connection.from('reviews').select(fields).eq('status','approved').order('created',{ascending:false}).limit(200);
  fail(error);return withImages((data||[]) as Row[],connection);
}
export async function submitSupabaseReview(form:FormData){
  if(form.get('consent')!=='on')throw new Error('Debes aceptar la autorización de publicación.');
  const connection=client(),image=form.get('image');
  const file=image instanceof File&&image.size?image:null;
  const extension=file?({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'} as Record<string,string>)[file.type]:null;
  if(file&&(!extension||file.size>5*1024*1024))throw new Error('Selecciona una imagen JPG, PNG o WebP de hasta 5 MB.');
  const {data,error}=await connection.rpc('submit_review',{p_name:String(form.get('name')||''),p_rating:Number(form.get('rating')),p_comment:String(form.get('comment')||''),p_image_extension:extension,p_consent:true});
  fail(error);
  const submission=data?.[0];if(!submission)throw new Error('No se pudo iniciar el envío. Inténtalo de nuevo.');
  if(file){
    const upload=await connection.storage.from(bucket).upload(submission.image_path,file,{contentType:file.type,upsert:false,cacheControl:'60'});
    if(upload.error)throw new Error('No se pudo subir la imagen. Tu reseña todavía no se ha enviado para revisión.');
  }
  const completed=await connection.rpc('complete_review',{p_id:submission.review_id,p_upload_token:submission.upload_token});
  fail(completed.error);return {ok:true};
}
export async function listAdminReviews(){
  const connection=client(true);
  const {data:user,error:authError}=await connection.auth.getUser();
  if(authError||!user.user)throw new Error('Inicia sesión para continuar.');
  const membership=await connection.from('review_admins').select('user_id').eq('user_id',user.user.id).maybeSingle();
  if(membership.error||!membership.data)throw new Error('Esta cuenta no tiene permiso para administrar reseñas.');
  const {data,error}=await connection.from('reviews').select(fields).neq('status','draft').order('created',{ascending:false});
  fail(error);return withImages((data||[]) as Row[],connection);
}
export async function loginReviewsAdmin(email:string,password:string){
  const connection=client(true);
  const {error}=await connection.auth.signInWithPassword({email,password});
  if(error)throw new Error(error.status===429?'Demasiados intentos. Espera antes de volver a intentar.':'Correo o contraseña incorrectos.');
  try{await listAdminReviews()}catch(err){await connection.auth.signOut();throw err}
}
export async function logoutReviewsAdmin(){const {error}=await client(true).auth.signOut();fail(error)}
export async function moderateSupabaseReview(id:Review['id'],status:string){
  if(!['pending','approved','rejected'].includes(status))throw new Error('Estado inválido.');
  const {data,error}=await client(true).from('reviews').update({status}).eq('id',id).select('id').single();
  fail(error);if(!data)throw new Error('No se pudo modificar la reseña.');
}
export async function deleteSupabaseReview(id:Review['id']){
  const connection=client(true);
  const {data,error}=await connection.from('reviews').select('image_path').eq('id',id).single();fail(error);
  if(data?.image_path){const result=await connection.storage.from(bucket).remove([data.image_path]);fail(result.error)}
  const removed=await connection.from('reviews').delete().eq('id',id).select('id').single();fail(removed.error);
}
