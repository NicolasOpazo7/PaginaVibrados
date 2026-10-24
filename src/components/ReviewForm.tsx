import {useEffect,useRef,useState,type FormEvent} from 'react';
import {CheckCircle2,ImagePlus,Send,Star,Trash2} from 'lucide-react';
import {reviewsApi,reviewsAvailable} from '../config';

export default function ReviewForm({onClose,onPrivacy}:{onClose:()=>void;onPrivacy:()=>void}){
  const [rating,setRating]=useState(5),[image,setImage]=useState<File|null>(null),[preview,setPreview]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false);
  const file=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(!image){setPreview('');return}const url=URL.createObjectURL(image);setPreview(url);return()=>URL.revokeObjectURL(url)},[image]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;
    setError('');setBusy(true);
    const data=new FormData(event.currentTarget);data.set('rating',String(rating));
    if(image)data.set('image',image);else data.delete('image');
    try{await reviewsApi({method:'POST',body:data});setSent(true)}catch(err){setError((err as Error).message)}finally{setBusy(false)}
  }
  if(sent)return <div className="review-receipt" role="status"><CheckCircle2 size={48}/><p className="eyebrow">RESEÑA RECIBIDA</p><h2>Gracias por compartir tu experiencia.</h2><p>Revisaremos tu comentario y tu imagen antes de publicarlos. Tu reseña todavía no es visible en la página.</p><button className="button" onClick={onClose}>Entendido</button></div>;
  return <div className="review-form-card"><p className="eyebrow">TU EXPERIENCIA CUENTA</p><h2>Agregar una reseña</h2><p>Cuéntanos cómo fue tu experiencia. Revisamos cada reseña antes de publicarla.</p><form className="modal-form" onSubmit={submit}>
    <label>Nombre o apodo<input name="name" maxLength={100} autoComplete="nickname" placeholder="Opcional · puedes publicar como Anónimo" disabled={busy}/></label>
    <fieldset disabled={busy}><legend>¿Cómo calificarías el servicio?</legend><div className="rating">{[1,2,3,4,5].map(n=><button type="button" key={n} aria-label={`${n} estrellas`} aria-pressed={rating===n} onClick={()=>setRating(n)}><Star fill={n<=rating?'#ffd000':'none'}/></button>)}<span>{rating} de 5</span></div></fieldset>
    <label>Descripción de tu experiencia *<textarea name="comment" required minLength={10} maxLength={2000} rows={4} placeholder="¿Qué trabajo realizamos y qué te pareció el resultado?" disabled={busy}/><small>Entre 10 y 2000 caracteres.</small></label>
    <div className="review-upload"><label htmlFor="review-photo"><ImagePlus size={20}/>Agregar una imagen <span>Opcional · JPG, PNG o WebP · hasta 5 MB</span></label><input ref={file} id="review-photo" name="image" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const next=e.target.files?.[0];setError('');if(!next){setImage(null);return}if(!['image/jpeg','image/png','image/webp'].includes(next.type)||next.size>5*1024*1024){setError('Selecciona una imagen JPG, PNG o WebP de hasta 5 MB.');e.target.value='';setImage(null);return}setImage(next)}}/>
    {preview&&<div className="review-upload-preview"><img src={preview} alt="Vista previa de la imagen seleccionada"/><button className="outline-button" type="button" disabled={busy} onClick={()=>{setImage(null);if(file.current)file.current.value=''}}><Trash2 size={16}/>Quitar imagen</button></div>}</div>
    <label className="checkbox"><input type="checkbox" name="consent" required disabled={busy}/>Autorizo la publicación de esta reseña y su imagen después de la revisión, y acepto la política de privacidad.</label>
    <button type="button" className="plain" onClick={onPrivacy}>Leer política de privacidad</button>
    {!reviewsAvailable&&<p className="review-form-error" role="status">El envío de reseñas aún no está disponible. Inténtalo más tarde.</p>}
    {error&&<p className="review-form-error" role="alert">{error}</p>}
    <button className="button" disabled={busy||!reviewsAvailable}>{busy?'Enviando…':'Enviar para revisión'}<Send size={17}/></button><small className="review-form-note">Tu reseña aparecerá cuando sea aprobada.</small>
  </form></div>;
}
